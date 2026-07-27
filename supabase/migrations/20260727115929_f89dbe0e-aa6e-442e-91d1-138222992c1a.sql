
-- Função: gera notificações de aproximação de processos anuais
CREATE OR REPLACE FUNCTION public.notify_processo_proximo()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_user UUID;
  v_users UUID[];
  v_dias INT;
  v_tipo notificacao_tipo;
  v_titulo TEXT;
BEGIN
  FOR r IN
    SELECT p.id, p.nome, p.previsto_inicio, p.previsto_fim, p.alerta_dias_antes,
           p.responsaveis_ids, p.equipe_toda, p.status
      FROM public.processo_anual p
     WHERE p.status IN ('planejado','em_andamento','atrasado')
       AND p.previsto_inicio IS NOT NULL
       AND p.previsto_inicio >= CURRENT_DATE
       AND p.previsto_inicio <= (CURRENT_DATE + (COALESCE(p.alerta_dias_antes, 14) || ' days')::interval)::date
  LOOP
    v_dias := (r.previsto_inicio - CURRENT_DATE);

    IF r.equipe_toda = true THEN
      SELECT COALESCE(array_agg(user_id), ARRAY[]::UUID[])
        INTO v_users
        FROM public.profiles
       WHERE email IS NOT NULL AND email <> '';
    ELSE
      -- responsaveis_ids contém colaborador_id; resolver para user_id via profiles
      SELECT COALESCE(array_agg(pr.user_id), ARRAY[]::UUID[])
        INTO v_users
        FROM public.profiles pr
       WHERE pr.colaborador_id = ANY(COALESCE(r.responsaveis_ids, ARRAY[]::UUID[]));
    END IF;

    IF v_users IS NULL OR array_length(v_users, 1) IS NULL THEN
      CONTINUE;
    END IF;

    -- Prioridade: crítico se ≤3 dias, senão informativo
    IF v_dias <= 3 THEN
      v_tipo := 'aviso_critico'::notificacao_tipo;
      v_titulo := 'Processo se aproxima (' || v_dias || 'd)';
    ELSE
      v_tipo := 'sistema'::notificacao_tipo;
      v_titulo := 'Processo previsto em ' || v_dias || ' dias';
    END IF;

    FOREACH v_user IN ARRAY v_users LOOP
      -- Evita duplicar nas últimas 23h
      IF NOT EXISTS (
        SELECT 1 FROM public.notificacao
         WHERE user_id = v_user
           AND created_at > now() - INTERVAL '23 hours'
           AND metadata->>'processo_id' = r.id::text
      ) THEN
        PERFORM public.enqueue_notificacao(
          v_user,
          v_tipo,
          v_titulo,
          r.nome || ' — início previsto ' || to_char(r.previsto_inicio, 'DD/MM/YYYY'),
          '/processos',
          jsonb_build_object('processo_id', r.id, 'dias', v_dias)
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_processo_proximo() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_processo_proximo() TO service_role;

-- Agenda diária às 07:00 (America/Sao_Paulo ≈ 10:00 UTC)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-processo-proximo-diario') THEN
    PERFORM cron.unschedule('notify-processo-proximo-diario');
  END IF;
  PERFORM cron.schedule(
    'notify-processo-proximo-diario',
    '0 10 * * *',
    $cron$ SELECT public.notify_processo_proximo(); $cron$
  );
END $$;
