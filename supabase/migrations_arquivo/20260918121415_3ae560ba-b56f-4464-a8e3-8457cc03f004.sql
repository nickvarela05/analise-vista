ALTER TABLE public.aviso_gestor
  ADD COLUMN IF NOT EXISTS email_assunto TEXT,
  ADD COLUMN IF NOT EXISTS email_html TEXT,
  ADD COLUMN IF NOT EXISTS email_texto TEXT;

CREATE OR REPLACE FUNCTION public.html_escape(_t TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT replace(replace(replace(replace(COALESCE(_t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;')
$$;

CREATE OR REPLACE FUNCTION public.gerar_avisos_processos_proximos()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  v_dias INT;
  v_duracao INT;
  v_tipo aviso_tipo;
  v_titulo TEXT;
  v_msg TEXT;
  v_dest UUID[];
  v_resp TEXT;
  v_inicio_fmt TEXT;
  v_fim_fmt TEXT;
  v_count INT := 0;
  v_cor TEXT;
  v_cor_suave TEXT;
  v_rotulo TEXT;
  v_contagem TEXT;
  v_acao TEXT;
  v_assunto TEXT;
  v_html TEXT;
  v_linhas TEXT;
  v_app TEXT := 'https://analise-vista.lovable.app/processos';
BEGIN
  UPDATE public.aviso_gestor a
     SET ativo = false, updated_at = now()
   WHERE a.processo_id IS NOT NULL
     AND a.ativo = true
     AND NOT EXISTS (
       SELECT 1 FROM public.processo_anual p
        WHERE p.id = a.processo_id
          AND p.status IN ('planejado','em_andamento','atrasado')
          AND p.previsto_inicio IS NOT NULL
          AND p.previsto_inicio >= CURRENT_DATE
          AND p.previsto_inicio <= (CURRENT_DATE + (COALESCE(p.alerta_dias_antes, 14) || ' days')::interval)::date
     );

  FOR r IN
    SELECT p.id, p.nome, p.descricao, p.previsto_inicio, p.previsto_fim,
           p.responsaveis_ids, p.equipe_toda
      FROM public.processo_anual p
     WHERE p.status IN ('planejado','em_andamento','atrasado')
       AND p.previsto_inicio IS NOT NULL
       AND p.previsto_inicio >= CURRENT_DATE
       AND p.previsto_inicio <= (CURRENT_DATE + (COALESCE(p.alerta_dias_antes, 14) || ' days')::interval)::date
  LOOP
    v_dias := (r.previsto_inicio - CURRENT_DATE);

    IF v_dias <= 3 THEN
      v_tipo := 'critico'::aviso_tipo;  v_cor := '#dc2626'; v_cor_suave := '#fef2f2'; v_rotulo := 'Crítico';
    ELSIF v_dias <= 7 THEN
      v_tipo := 'alerta'::aviso_tipo;   v_cor := '#d97706'; v_cor_suave := '#fffbeb'; v_rotulo := 'Atenção';
    ELSE
      v_tipo := 'informativo'::aviso_tipo; v_cor := '#2563eb'; v_cor_suave := '#eff6ff'; v_rotulo := 'Informativo';
    END IF;

    v_contagem := CASE
      WHEN v_dias = 0 THEN 'Começa hoje'
      WHEN v_dias = 1 THEN 'Começa amanhã'
      ELSE 'Faltam ' || v_dias || ' dias'
    END;

    v_titulo := CASE
      WHEN v_dias = 0 THEN 'Processo começa hoje: ' || r.nome
      WHEN v_dias = 1 THEN 'Processo começa amanhã: ' || r.nome
      ELSE 'Processo em ' || v_dias || ' dias: ' || r.nome
    END;

    v_inicio_fmt := to_char(r.previsto_inicio, 'DD/MM/YYYY') || ' (' ||
      CASE extract(isodow FROM r.previsto_inicio)
        WHEN 1 THEN 'segunda-feira' WHEN 2 THEN 'terça-feira'
        WHEN 3 THEN 'quarta-feira'  WHEN 4 THEN 'quinta-feira'
        WHEN 5 THEN 'sexta-feira'   WHEN 6 THEN 'sábado'
        ELSE 'domingo'
      END || ')';

    v_fim_fmt := NULL;
    v_duracao := NULL;
    IF r.previsto_fim IS NOT NULL THEN
      v_fim_fmt := to_char(r.previsto_fim, 'DD/MM/YYYY');
      v_duracao := GREATEST((r.previsto_fim - r.previsto_inicio) + 1, 1);
    END IF;

    v_resp := NULL;
    IF NOT r.equipe_toda AND r.responsaveis_ids IS NOT NULL AND array_length(r.responsaveis_ids, 1) > 0 THEN
      SELECT string_agg(c.nome, ', ' ORDER BY c.nome)
        INTO v_resp
        FROM public.colaborador c
       WHERE c.id = ANY (r.responsaveis_ids);
    END IF;

    v_acao := CASE
      WHEN v_dias = 0 THEN 'O processo começa hoje. Iniciem as atividades e registrem o andamento na tela de Processos.'
      WHEN v_dias = 1 THEN 'O processo começa amanhã. Deixem materiais, acessos e pendências prontos hoje.'
      WHEN v_dias <= 3 THEN 'Faltam apenas ' || v_dias || ' dias. Priorizem o preparo: revisem pendências e alinhem as entregas com os responsáveis.'
      WHEN v_dias <= 7 THEN 'Falta 1 semana ou menos. Confirmem o planejamento e antecipem possíveis impedimentos.'
      ELSE 'Faltam ' || v_dias || ' dias. Aproveitem para planejar com calma e alinhar expectativas com a equipe.'
    END;

    v_msg := 'O processo "' || r.nome || '" tem início previsto para ' || v_inicio_fmt || '.'
      || CASE
           WHEN v_fim_fmt IS NOT NULL THEN
             E'\nTérmino previsto: ' || v_fim_fmt || ' — duração estimada de ' || v_duracao ||
             CASE WHEN v_duracao = 1 THEN ' dia.' ELSE ' dias.' END
           ELSE ''
         END
      || COALESCE(E'\n\nSobre o processo: ' || NULLIF(btrim(r.descricao), ''), '')
      || E'\n\n' || CASE
           WHEN r.equipe_toda THEN 'Este processo envolve toda a equipe.'
           WHEN v_resp IS NOT NULL THEN 'Responsáveis: ' || v_resp || '.'
           ELSE 'Nenhum responsável definido no cadastro do processo.'
         END
      || E'\n\n' || v_acao;

    v_assunto := CASE
      WHEN v_dias = 0 THEN 'Hoje: ' || r.nome
      WHEN v_dias = 1 THEN 'Amanhã: ' || r.nome
      ELSE 'Em ' || v_dias || ' dias: ' || r.nome
    END;

    v_linhas :=
      '<tr><td style="padding:10px 0;border-bottom:1px solid #eef1f5;color:#64748b;font-size:13px;width:150px">Início previsto</td>'
      || '<td style="padding:10px 0;border-bottom:1px solid #eef1f5;color:#0f172a;font-size:14px;font-weight:600">'
      || public.html_escape(v_inicio_fmt) || '</td></tr>'
      || CASE WHEN v_fim_fmt IS NOT NULL THEN
           '<tr><td style="padding:10px 0;border-bottom:1px solid #eef1f5;color:#64748b;font-size:13px">Término previsto</td>'
           || '<td style="padding:10px 0;border-bottom:1px solid #eef1f5;color:#0f172a;font-size:14px;font-weight:600">'
           || public.html_escape(v_fim_fmt) || ' · ' || v_duracao
           || CASE WHEN v_duracao = 1 THEN ' dia' ELSE ' dias' END || '</td></tr>'
         ELSE '' END
      || '<tr><td style="padding:10px 0;border-bottom:1px solid #eef1f5;color:#64748b;font-size:13px">Responsáveis</td>'
      || '<td style="padding:10px 0;border-bottom:1px solid #eef1f5;color:#0f172a;font-size:14px;font-weight:600">'
      || CASE
           WHEN r.equipe_toda THEN 'Toda a equipe'
           WHEN v_resp IS NOT NULL THEN public.html_escape(v_resp)
           ELSE '<span style="color:#94a3b8;font-weight:500">Não definido</span>'
         END
      || '</td></tr>';

    v_html :=
      '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">'
      || '<meta name="viewport" content="width=device-width,initial-scale=1">'
      || '<title>' || public.html_escape(v_titulo) || '</title></head>'
      || '<body style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif">'
      || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><td align="center">'
      || '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0">'
      || '<tr><td style="height:6px;background:' || v_cor || '"></td></tr>'
      || '<tr><td style="padding:24px 28px 8px">'
      || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
      || '<td style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:' || v_cor || '">Nexus · Processo anual</td>'
      || '<td align="right"><span style="display:inline-block;background:' || v_cor_suave || ';color:' || v_cor
      || ';font-size:11px;font-weight:700;padding:5px 12px;border-radius:999px">' || v_rotulo || '</span></td>'
      || '</tr></table></td></tr>'
      || '<tr><td style="padding:4px 28px 0">'
      || '<h1 style="margin:8px 0 6px;font-size:21px;line-height:1.3;color:#0f172a">' || public.html_escape(r.nome) || '</h1>'
      || '<p style="margin:0 0 18px;font-size:14px;color:' || v_cor || ';font-weight:700">' || v_contagem || '</p>'
      || '</td></tr>'
      || '<tr><td style="padding:0 28px">'
      || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-top:1px solid #eef1f5">'
      || v_linhas || '</table></td></tr>'
      || CASE WHEN NULLIF(btrim(r.descricao), '') IS NOT NULL THEN
           '<tr><td style="padding:18px 28px 0"><div style="background:#f8fafc;border:1px solid #eef1f5;border-radius:10px;padding:14px 16px">'
           || '<div style="font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#94a3b8;margin-bottom:6px">Sobre o processo</div>'
           || '<div style="font-size:14px;line-height:1.6;color:#334155">'
           || replace(public.html_escape(btrim(r.descricao)), E'\n', '<br>') || '</div></div></td></tr>'
         ELSE '' END
      || '<tr><td style="padding:18px 28px 0"><div style="background:' || v_cor_suave || ';border-left:4px solid ' || v_cor
      || ';border-radius:8px;padding:14px 16px;font-size:14px;line-height:1.6;color:#334155">'
      || public.html_escape(v_acao) || '</div></td></tr>'
      || '<tr><td align="center" style="padding:24px 28px 4px">'
      || '<a href="' || v_app || '" style="display:inline-block;background:' || v_cor
      || ';color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 26px;border-radius:8px">Abrir calendário anual</a>'
      || '</td></tr>'
      || '<tr><td style="padding:22px 28px 26px"><hr style="border:none;border-top:1px solid #eef1f5;margin:0 0 14px">'
      || '<p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8">Aviso automático do Nexus, gerado a partir do calendário de processos anuais. '
      || 'Acompanhe e atualize o andamento diretamente no sistema.</p></td></tr>'
      || '</table></td></tr></table></body></html>';

    IF r.equipe_toda THEN
      v_dest := ARRAY[]::UUID[];
    ELSE
      v_dest := COALESCE(r.responsaveis_ids, ARRAY[]::UUID[]);
    END IF;

    INSERT INTO public.aviso_gestor (titulo, mensagem, tipo, ativo, expira_em, processo_id, colaboradores_ids,
                                     email_assunto, email_html, email_texto)
    VALUES (v_titulo, v_msg, v_tipo, true,
            (r.previsto_inicio + 1)::timestamptz, r.id, v_dest,
            v_assunto, v_html, v_msg)
    ON CONFLICT (processo_id) WHERE processo_id IS NOT NULL
    DO UPDATE SET titulo = EXCLUDED.titulo,
                  mensagem = EXCLUDED.mensagem,
                  tipo = EXCLUDED.tipo,
                  ativo = true,
                  expira_em = EXCLUDED.expira_em,
                  colaboradores_ids = EXCLUDED.colaboradores_ids,
                  email_assunto = EXCLUDED.email_assunto,
                  email_html = EXCLUDED.email_html,
                  email_texto = EXCLUDED.email_texto,
                  updated_at = now();
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.gerar_avisos_processos_proximos() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gerar_avisos_processos_proximos() TO service_role;

SELECT public.gerar_avisos_processos_proximos();