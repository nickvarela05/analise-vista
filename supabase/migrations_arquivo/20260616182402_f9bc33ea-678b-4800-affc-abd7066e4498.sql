CREATE OR REPLACE FUNCTION public.gerar_notificacoes_prazo()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  v_user UUID;
  v_users UUID[];
BEGIN
  FOR r IN
    SELECT id, titulo, data_prevista, responsavel_id, responsaveis_ids
      FROM public.todo
     WHERE status NOT IN ('concluida', 'cancelada')
       AND data_prevista IS NOT NULL
       AND data_prevista::timestamptz BETWEEN now() AND now() + INTERVAL '24 hours'
  LOOP
    v_users := COALESCE(r.responsaveis_ids, ARRAY[]::UUID[]);
    IF r.responsavel_id IS NOT NULL THEN v_users := v_users || r.responsavel_id; END IF;

    FOREACH v_user IN ARRAY (SELECT array_agg(DISTINCT u) FROM unnest(v_users) u WHERE u IS NOT NULL) LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.notificacao
         WHERE user_id = v_user AND tipo = 'tarefa_prazo'
           AND created_at > now() - INTERVAL '23 hours'
           AND metadata->>'tarefa_id' = r.id::text
      ) THEN
        PERFORM public.enqueue_notificacao(
          v_user, 'tarefa_prazo'::notificacao_tipo,
          'Prazo se aproximando',
          r.titulo || ' — vence em ' || to_char(r.data_prevista, 'DD/MM'),
          '/tarefas?id=' || r.id::text,
          jsonb_build_object('tarefa_id', r.id)
        );
      END IF;
    END LOOP;
  END LOOP;

  FOR r IN
    SELECT id, titulo, prazo, responsavel_id, responsaveis_ids
      FROM public.chamado_externo
     WHERE status <> 'finalizado'
       AND prazo IS NOT NULL
       AND prazo < CURRENT_DATE
  LOOP
    v_users := COALESCE(r.responsaveis_ids, ARRAY[]::UUID[]);
    IF r.responsavel_id IS NOT NULL THEN v_users := v_users || r.responsavel_id; END IF;

    FOREACH v_user IN ARRAY (SELECT array_agg(DISTINCT u) FROM unnest(v_users) u WHERE u IS NOT NULL) LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.notificacao
         WHERE user_id = v_user AND tipo = 'chamado_sla'
           AND created_at > now() - INTERVAL '23 hours'
           AND metadata->>'chamado_id' = r.id::text
      ) THEN
        PERFORM public.enqueue_notificacao(
          v_user, 'chamado_sla'::notificacao_tipo,
          'SLA estourado',
          r.titulo || ' — prazo era ' || to_char(r.prazo, 'DD/MM'),
          '/atividades',
          jsonb_build_object('chamado_id', r.id)
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$function$;