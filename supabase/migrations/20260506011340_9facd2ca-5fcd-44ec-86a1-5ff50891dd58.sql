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
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first;

  IF is_first THEN
    v_role := 'gestor'::app_role;
  ELSE
    v_admin_created := COALESCE((NEW.raw_app_meta_data ->> 'created_by_admin')::boolean, false);

    IF v_admin_created THEN
      -- Criação administrativa: usa role do app_metadata, que não é controlável por signup público.
      BEGIN
        v_role := COALESCE(
          (NEW.raw_app_meta_data ->> 'role')::app_role,
          'analista'::app_role
        );
      EXCEPTION WHEN OTHERS THEN
        v_role := 'analista'::app_role;
      END;
    ELSE
      -- Signup público: exige convite válido.
      SELECT * INTO v_invite
        FROM public.invite_token
       WHERE lower(email) = lower(NEW.email)
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