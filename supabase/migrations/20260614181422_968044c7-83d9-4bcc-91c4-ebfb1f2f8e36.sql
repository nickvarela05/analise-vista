-- Função: notifica e enfileira e-mail imediato para responsáveis quando um novo chamado externo é criado
CREATE OR REPLACE FUNCTION public.notify_chamado_externo_criado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID;
  v_destinatarios UUID[];
  v_email TEXT;
  v_nome TEXT;
  v_subject TEXT;
  v_html TEXT;
  v_text TEXT;
  v_notif_id UUID;
BEGIN
  -- Resolve destinatários
  IF NEW.equipe_toda = true THEN
    SELECT COALESCE(array_agg(user_id), ARRAY[]::UUID[])
      INTO v_destinatarios
      FROM public.profiles
      WHERE email IS NOT NULL AND email <> '';
  ELSE
    v_destinatarios := COALESCE(NEW.responsaveis_ids, ARRAY[]::UUID[]);
    IF NEW.responsavel_id IS NOT NULL THEN
      v_destinatarios := v_destinatarios || NEW.responsavel_id;
    END IF;
  END IF;

  IF v_destinatarios IS NULL OR array_length(v_destinatarios, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  FOR v_user IN
    SELECT DISTINCT u FROM unnest(v_destinatarios) u WHERE u IS NOT NULL
  LOOP
    -- Notificação in-app
    v_notif_id := public.enqueue_notificacao(
      v_user,
      'relatorio_novo'::notificacao_tipo,
      'Novo relatório solicitado',
      COALESCE(NEW.titulo, '') || CASE WHEN NEW.cliente IS NOT NULL THEN ' — ' || NEW.cliente ELSE '' END,
      '/atividades',
      jsonb_build_object('chamado_id', NEW.id, 'codigo', NEW.codigo)
    );

    -- E-mail imediato
    SELECT email, nome INTO v_email, v_nome
      FROM public.profiles WHERE user_id = v_user;

    IF v_email IS NULL OR v_email = '' THEN
      CONTINUE;
    END IF;

    v_subject := '[Novo relatório] ' || COALESCE(NEW.titulo, NEW.codigo);
    v_text := 'Um novo relatório foi solicitado e atribuído a você.' || E'\n\n'
              || 'Código: ' || NEW.codigo || E'\n'
              || 'Título: ' || COALESCE(NEW.titulo, '') || E'\n'
              || CASE WHEN NEW.cliente IS NOT NULL THEN 'Cliente: ' || NEW.cliente || E'\n' ELSE '' END
              || CASE WHEN NEW.prazo IS NOT NULL THEN 'Prazo: ' || to_char(NEW.prazo, 'DD/MM/YYYY') || E'\n' ELSE '' END
              || CASE WHEN NEW.descricao IS NOT NULL THEN E'\n' || NEW.descricao ELSE '' END;
    v_html := '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">'
              || '<h2 style="color:#1f2937">📄 Novo relatório solicitado</h2>'
              || '<p style="color:#555">Olá ' || COALESCE(v_nome, '') || ',</p>'
              || '<p style="color:#333">Um novo relatório foi atribuído a você:</p>'
              || '<table style="border-collapse:collapse;width:100%;margin:12px 0">'
              || '<tr><td style="padding:6px 8px;color:#666"><b>Código</b></td><td style="padding:6px 8px">' || NEW.codigo || '</td></tr>'
              || '<tr><td style="padding:6px 8px;color:#666"><b>Título</b></td><td style="padding:6px 8px">' || replace(COALESCE(NEW.titulo,''), '<', '&lt;') || '</td></tr>'
              || CASE WHEN NEW.cliente IS NOT NULL THEN '<tr><td style="padding:6px 8px;color:#666"><b>Cliente</b></td><td style="padding:6px 8px">' || replace(NEW.cliente,'<','&lt;') || '</td></tr>' ELSE '' END
              || '<tr><td style="padding:6px 8px;color:#666"><b>Prioridade</b></td><td style="padding:6px 8px">' || NEW.prioridade::text || '</td></tr>'
              || CASE WHEN NEW.prazo IS NOT NULL THEN '<tr><td style="padding:6px 8px;color:#666"><b>Prazo</b></td><td style="padding:6px 8px">' || to_char(NEW.prazo, 'DD/MM/YYYY') || '</td></tr>' ELSE '' END
              || '</table>'
              || CASE WHEN NEW.descricao IS NOT NULL THEN '<p style="color:#444">' || replace(NEW.descricao,'<','&lt;') || '</p>' ELSE '' END
              || '<p style="margin-top:16px;color:#888;font-size:12px">Acesse o sistema para mais detalhes.</p>'
              || '</div>';

    INSERT INTO public.email_send_log (user_id, recipient_email, subject, body_html, body_text, notificacao_ids, status, scheduled_for)
    VALUES (
      v_user, v_email, v_subject, v_html, v_text,
      CASE WHEN v_notif_id IS NOT NULL THEN ARRAY[v_notif_id] ELSE NULL END,
      'pending', now()
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Revogar execução por usuários autenticados (apenas trigger usa)
REVOKE EXECUTE ON FUNCTION public.notify_chamado_externo_criado() FROM PUBLIC, anon, authenticated;

-- Trigger
DROP TRIGGER IF EXISTS trg_chamado_externo_after_insert_notify ON public.chamado_externo;
CREATE TRIGGER trg_chamado_externo_after_insert_notify
AFTER INSERT ON public.chamado_externo
FOR EACH ROW
EXECUTE FUNCTION public.notify_chamado_externo_criado();
