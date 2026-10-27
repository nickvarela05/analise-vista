
-- 1) handle_new_user: verificar valor do token de convite
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_first BOOLEAN;
  v_invite RECORD;
  v_role app_role;
  v_admin_created BOOLEAN;
  v_token TEXT;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first;

  IF is_first THEN
    v_role := 'gestor'::app_role;
  ELSE
    v_admin_created := COALESCE((NEW.raw_app_meta_data ->> 'created_by_admin')::boolean, false);

    IF v_admin_created THEN
      BEGIN
        v_role := COALESCE(
          (NEW.raw_app_meta_data ->> 'role')::app_role,
          'analista'::app_role
        );
      EXCEPTION WHEN OTHERS THEN
        v_role := 'analista'::app_role;
      END;
    ELSE
      v_token := NULLIF(trim(NEW.raw_user_meta_data ->> 'invite_token'), '');
      IF v_token IS NULL THEN
        RAISE EXCEPTION 'Cadastro requer convite válido. Solicite ao gestor.'
          USING ERRCODE = 'P0001';
      END IF;

      SELECT * INTO v_invite
        FROM public.invite_token
       WHERE token = v_token
         AND lower(email) = lower(NEW.email)
         AND used_at IS NULL
         AND expires_at > now()
       ORDER BY created_at DESC
       LIMIT 1;

      IF v_invite.id IS NULL THEN
        RAISE EXCEPTION 'Cadastro requer convite válido. Solicite ao gestor.'
          USING ERRCODE = 'P0001';
      END IF;

      v_role := v_invite.role;
      UPDATE public.invite_token SET used_at = now() WHERE id = v_invite.id;
    END IF;
  END IF;

  INSERT INTO public.profiles (user_id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);
  RETURN NEW;
END;
$function$;

-- 2) ia_prompt_config: restringe SELECT a gestores
DROP POLICY IF EXISTS "Autenticado lê prompts de IA" ON public.ia_prompt_config;
CREATE POLICY "Gestor lê prompts de IA"
  ON public.ia_prompt_config
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'::app_role));

-- 3) chat_rate_limit: políticas explícitas de negação para usuários (apenas service_role escreve)
ALTER TABLE public.chat_rate_limit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Bloquear acesso a chat_rate_limit" ON public.chat_rate_limit;
CREATE POLICY "Bloquear acesso a chat_rate_limit"
  ON public.chat_rate_limit
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- 4) Revoga EXECUTE de anon em funções administrativas SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.auto_encerrar_tarefas_antigas() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.limpar_atribuicoes_finalizadas() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.executar_busca_natural(text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_encerrar_tarefas_antigas() TO service_role;
GRANT EXECUTE ON FUNCTION public.limpar_atribuicoes_finalizadas() TO service_role;
GRANT EXECUTE ON FUNCTION public.executar_busca_natural(text) TO authenticated, service_role;
