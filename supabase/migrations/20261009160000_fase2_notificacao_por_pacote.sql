-- Fase 2 do layout, parte 2: uma notificação por pacote (T2 da análise de uso). Aplicar só no
-- merge, porque muda o comportamento do sistema em uso.
--
-- Antes: cada tarefa atribuída gerava uma notificação. Ao receber ou distribuir um pacote, a
-- pessoa ganhava 19 avisos iguais (em 01/10: 543 notificações "tarefa atribuída", nenhuma lida).
-- Agora as atribuições próximas no tempo (15 min) para a mesma pessoa viram uma só, enquanto ela
-- não foi lida: "5 tarefas atribuídas a você".
--
-- Corrige junto: quem atribui uma tarefa a si mesmo não é mais notificado. A regra antiga
-- comparava o colaborador com o criador da tarefa (ids de tipos diferentes), e nunca batia.

CREATE OR REPLACE FUNCTION public.notificar_atribuicao(p_destino uuid, p_tarefa_id uuid, p_titulo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_ativo boolean;
  v_id uuid;
  v_ids jsonb;
  v_n int;
BEGIN
  IF p_destino IS NULL THEN RETURN; END IF;

  -- O destino pode vir como colaborador ou como login (mesma resolução de enqueue_notificacao).
  SELECT p.user_id INTO v_user FROM public.profiles p WHERE p.user_id = p_destino;
  IF v_user IS NULL THEN
    SELECT p.user_id INTO v_user FROM public.profiles p WHERE p.colaborador_id = p_destino LIMIT 1;
  END IF;
  IF v_user IS NULL OR v_user = auth.uid() THEN RETURN; END IF;

  SELECT ativo INTO v_ativo FROM public.notificacao_preferencia
   WHERE user_id = v_user AND evento = 'tarefa_atribuida' AND canal = 'in_app';
  IF v_ativo IS FALSE THEN RETURN; END IF;

  SELECT id, COALESCE(metadata->'tarefa_ids', '[]'::jsonb) INTO v_id, v_ids
    FROM public.notificacao
   WHERE user_id = v_user
     AND tipo = 'tarefa_atribuida'
     AND lida_em IS NULL
     AND created_at > now() - interval '15 minutes'
     AND metadata ? 'tarefa_ids'
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF v_id IS NULL THEN
    INSERT INTO public.notificacao (user_id, tipo, titulo, mensagem, link, metadata)
    VALUES (v_user, 'tarefa_atribuida', 'Nova tarefa atribuída', p_titulo, '/tarefas?id=' || p_tarefa_id,
            jsonb_build_object('tarefa_id', p_tarefa_id, 'tarefa_ids', jsonb_build_array(p_tarefa_id)));
    RETURN;
  END IF;

  IF v_ids ? p_tarefa_id::text THEN RETURN; END IF;
  v_ids := v_ids || to_jsonb(p_tarefa_id::text);
  v_n := jsonb_array_length(v_ids);
  UPDATE public.notificacao SET
    titulo = v_n || ' tarefas atribuídas a você',
    mensagem = 'A última: ' || p_titulo || '. Veja em "Meu dia", na Central.',
    link = '/',
    metadata = metadata || jsonb_build_object('tarefa_ids', v_ids)
  WHERE id = v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.notificar_atribuicao(uuid, uuid, text) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_tarefa_atribuida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_resp uuid;
  v_old_set uuid[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_old_set := ARRAY[]::uuid[];
  ELSE
    v_old_set := COALESCE(OLD.responsaveis_ids, ARRAY[]::uuid[]) ||
                 CASE WHEN OLD.responsavel_id IS NOT NULL THEN ARRAY[OLD.responsavel_id] ELSE ARRAY[]::uuid[] END;
  END IF;

  IF NEW.responsavel_id IS NOT NULL AND NOT (NEW.responsavel_id = ANY (v_old_set)) THEN
    PERFORM public.notificar_atribuicao(NEW.responsavel_id, NEW.id, NEW.titulo);
  END IF;

  IF NEW.responsaveis_ids IS NOT NULL THEN
    FOREACH v_resp IN ARRAY NEW.responsaveis_ids LOOP
      IF NOT (v_resp = ANY (v_old_set)) AND v_resp IS DISTINCT FROM NEW.responsavel_id THEN
        PERFORM public.notificar_atribuicao(v_resp, NEW.id, NEW.titulo);
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;
