CREATE OR REPLACE FUNCTION public.notify_demanda_atribuida()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_resp UUID;
  v_old_set UUID[];
  v_tipo notificacao_tipo;
  v_titulo TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_old_set := ARRAY[]::UUID[];
  ELSE
    v_old_set := COALESCE(OLD.responsaveis_ids, ARRAY[]::UUID[]) ||
                 CASE WHEN OLD.responsavel_id IS NOT NULL THEN ARRAY[OLD.responsavel_id] ELSE ARRAY[]::UUID[] END;
  END IF;

  v_tipo := CASE WHEN NEW.prioridade = 'critica' THEN 'demanda_urgente'::notificacao_tipo ELSE 'demanda_atribuida'::notificacao_tipo END;
  v_titulo := CASE WHEN NEW.prioridade = 'critica' THEN 'Demanda URGENTE atribuída' ELSE 'Nova demanda atribuída' END;

  IF NEW.responsavel_id IS NOT NULL AND NOT (NEW.responsavel_id = ANY(v_old_set)) AND NEW.responsavel_id <> COALESCE(NEW.criado_por, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    PERFORM public.enqueue_notificacao(NEW.responsavel_id, v_tipo, v_titulo, NEW.titulo, '/demandas?id=' || NEW.id::text, jsonb_build_object('demanda_id', NEW.id));
  END IF;

  IF NEW.responsaveis_ids IS NOT NULL THEN
    FOREACH v_resp IN ARRAY NEW.responsaveis_ids LOOP
      IF NOT (v_resp = ANY(v_old_set)) AND v_resp <> COALESCE(NEW.criado_por, '00000000-0000-0000-0000-000000000000'::uuid) THEN
        PERFORM public.enqueue_notificacao(v_resp, v_tipo, v_titulo, NEW.titulo, '/demandas?id=' || NEW.id::text, jsonb_build_object('demanda_id', NEW.id));
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;