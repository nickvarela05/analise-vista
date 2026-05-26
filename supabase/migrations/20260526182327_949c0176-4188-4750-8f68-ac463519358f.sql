
CREATE OR REPLACE FUNCTION public.notify_tarefa_comentario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tarefa RECORD;
  v_destinatarios UUID[];
  v_unicos UUID[];
  v_user UUID;
BEGIN
  SELECT id, titulo, criado_por, responsavel_id, responsaveis_ids
    INTO v_tarefa FROM public.todo WHERE id = NEW.todo_id;
  IF v_tarefa.id IS NULL THEN RETURN NEW; END IF;

  v_destinatarios := COALESCE(v_tarefa.responsaveis_ids, ARRAY[]::UUID[]);
  IF v_tarefa.criado_por IS NOT NULL THEN v_destinatarios := v_destinatarios || v_tarefa.criado_por; END IF;
  IF v_tarefa.responsavel_id IS NOT NULL THEN v_destinatarios := v_destinatarios || v_tarefa.responsavel_id; END IF;

  SELECT COALESCE(array_agg(DISTINCT u), ARRAY[]::UUID[])
    INTO v_unicos
    FROM unnest(v_destinatarios) u
    WHERE u IS NOT NULL AND u <> NEW.autor_id;

  IF array_length(v_unicos, 1) IS NULL THEN RETURN NEW; END IF;

  FOREACH v_user IN ARRAY v_unicos LOOP
    PERFORM public.enqueue_notificacao(
      v_user, 'tarefa_comentario'::notificacao_tipo,
      'Novo comentário em "' || v_tarefa.titulo || '"',
      COALESCE(NEW.autor_nome, 'Alguém') || ': ' || left(NEW.conteudo, 140),
      '/tarefas?id=' || v_tarefa.id::text,
      jsonb_build_object('tarefa_id', v_tarefa.id, 'comentario_id', NEW.id)
    );
  END LOOP;

  RETURN NEW;
END;
$function$;
