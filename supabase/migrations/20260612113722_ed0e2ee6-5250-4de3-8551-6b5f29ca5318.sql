CREATE OR REPLACE FUNCTION public.limpar_atribuicoes_finalizadas()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_todo int := 0;
  v_demanda int := 0;
  v_reuniao int := 0;
BEGIN
  -- Tarefas
  UPDATE public.todo
     SET responsaveis_ids = '{}'::uuid[],
         responsavel_id = NULL,
         equipe_toda = false,
         em_teste = false
   WHERE (
           (status IN ('encerrada','concluida','producao')
            AND updated_at < now() - INTERVAL '3 days')
           OR
           (data_prevista IS NOT NULL
            AND data_prevista < (CURRENT_DATE - INTERVAL '3 days'))
         )
     AND (
           equipe_toda = true
           OR em_teste = true
           OR responsavel_id IS NOT NULL
           OR array_length(responsaveis_ids, 1) > 0
         );
  GET DIAGNOSTICS v_todo = ROW_COUNT;

  -- Demandas
  UPDATE public.demanda
     SET responsaveis_ids = '{}'::uuid[],
         responsavel_id = NULL,
         equipe_toda = false
   WHERE (
           (status IN ('concluida','cancelada')
            AND updated_at < now() - INTERVAL '3 days')
           OR
           (prazo IS NOT NULL
            AND prazo < (CURRENT_DATE - INTERVAL '3 days'))
         )
     AND (
           equipe_toda = true
           OR responsavel_id IS NOT NULL
           OR array_length(responsaveis_ids, 1) > 0
         );
  GET DIAGNOSTICS v_demanda = ROW_COUNT;

  -- Reuniões
  UPDATE public.reuniao
     SET responsaveis_ids = '{}'::uuid[],
         responsavel_id = NULL,
         equipe_toda = false
   WHERE (
           (status IN ('realizada','cancelada')
            AND updated_at < now() - INTERVAL '3 days')
           OR
           (data_reuniao < now() - INTERVAL '3 days')
         )
     AND (
           equipe_toda = true
           OR responsavel_id IS NOT NULL
           OR array_length(responsaveis_ids, 1) > 0
         );
  GET DIAGNOSTICS v_reuniao = ROW_COUNT;

  RETURN jsonb_build_object(
    'todo', v_todo,
    'demanda', v_demanda,
    'reuniao', v_reuniao,
    'executado_em', now()
  );
END;
$$;