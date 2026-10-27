-- Corrige dois bugs de notificação que vinham da Lovable (maio a setembro de 2026).
--
-- 1. Triggers duplicados: quatro tabelas tinham dois triggers chamando a mesma função,
--    gerando cada notificação duas vezes. Mantém-se, em cada par, o de maior cobertura.
DROP TRIGGER IF EXISTS trg_todo_atribuida ON public.todo;                         -- idêntico a trg_notify_tarefa_atribuida
DROP TRIGGER IF EXISTS trg_demanda_atribuida ON public.demanda;                   -- trg_notify_demanda_atribuida também cobre prioridade
DROP TRIGGER IF EXISTS trg_notify_aviso_critico ON public.aviso_gestor;           -- trg_aviso_gestor_notify cobre INSERT e UPDATE
DROP TRIGGER IF EXISTS trg_chamado_externo_email ON public.chamado_externo;       -- idêntico a trg_chamado_externo_after_insert_notify

-- 2. Destinatário errado: tarefas e demandas guardam o ID do colaborador em
--    responsavel_id/responsaveis_ids, e a notificação era gravada com esse ID. O sino
--    (policy auth.uid() = user_id), as preferências e o e-mail imediato usam o ID de
--    login, então essas notificações nunca chegavam a ninguém. Agora o ID de colaborador
--    é convertido para o ID de login via profiles.colaborador_id. IDs que já são de login
--    seguem iguais; colaboradores sem login continuam sem notificação (não têm sino).
CREATE OR REPLACE FUNCTION public.enqueue_notificacao(
  _user_id uuid,
  _tipo public.notificacao_tipo,
  _titulo text,
  _mensagem text DEFAULT NULL::text,
  _link text DEFAULT NULL::text,
  _metadata jsonb DEFAULT NULL::jsonb
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
  v_ativo BOOLEAN;
  v_destino UUID;
BEGIN
  IF _user_id IS NULL THEN RETURN NULL; END IF;

  -- resolve o destinatário para o ID de login
  SELECT p.user_id INTO v_destino FROM public.profiles p WHERE p.user_id = _user_id;
  IF v_destino IS NULL THEN
    SELECT p.user_id INTO v_destino FROM public.profiles p WHERE p.colaborador_id = _user_id LIMIT 1;
  END IF;
  IF v_destino IS NULL THEN RETURN NULL; END IF;

  -- respeita preferência in-app (default = ativo)
  SELECT ativo INTO v_ativo
    FROM public.notificacao_preferencia
   WHERE user_id = v_destino AND evento = _tipo AND canal = 'in_app';

  IF v_ativo IS FALSE THEN RETURN NULL; END IF;

  INSERT INTO public.notificacao (user_id, tipo, titulo, mensagem, link, metadata)
  VALUES (v_destino, _tipo, _titulo, _mensagem, _link, _metadata)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

-- Mantém as permissões da origem (só service_role executa diretamente).
REVOKE ALL ON FUNCTION public.enqueue_notificacao(uuid, public.notificacao_tipo, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.enqueue_notificacao(uuid, public.notificacao_tipo, text, text, text, jsonb) TO service_role;
