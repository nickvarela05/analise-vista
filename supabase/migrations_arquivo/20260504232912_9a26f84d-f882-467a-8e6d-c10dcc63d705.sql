
DELETE FROM public.todo_historico;
DELETE FROM public.todo_comentario;
DELETE FROM public.todo_checklist;
DELETE FROM public.todo_anexo;
DELETE FROM public.todo;
DELETE FROM public.demanda;
DELETE FROM public.chamado_externo;
DELETE FROM public.reuniao;
DELETE FROM public.aviso_leitura;
DELETE FROM public.aviso_gestor;
DELETE FROM public.colaborador_evento;
DELETE FROM public.colaborador_ferias;
DELETE FROM public.colaborador_horario;
DELETE FROM public.colaborador;

DROP POLICY IF EXISTS "Dev anon read aviso_gestor" ON public.aviso_gestor;
DROP POLICY IF EXISTS "Dev anon read aviso_leitura" ON public.aviso_leitura;
DROP POLICY IF EXISTS "Dev anon read chamado_externo" ON public.chamado_externo;
DROP POLICY IF EXISTS "Dev anon read colaborador" ON public.colaborador;
DROP POLICY IF EXISTS "Dev anon read colaborador_evento" ON public.colaborador_evento;
DROP POLICY IF EXISTS "Dev anon read colaborador_ferias" ON public.colaborador_ferias;
DROP POLICY IF EXISTS "Dev anon read colaborador_horario" ON public.colaborador_horario;
DROP POLICY IF EXISTS "Dev anon read demanda" ON public.demanda;
DROP POLICY IF EXISTS "Dev anon read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Dev anon read reuniao" ON public.reuniao;
DROP POLICY IF EXISTS "Dev anon read todo" ON public.todo;
DROP POLICY IF EXISTS "Dev anon read todo_anexo" ON public.todo_anexo;
DROP POLICY IF EXISTS "Dev anon read todo_checklist" ON public.todo_checklist;
DROP POLICY IF EXISTS "Dev anon read todo_comentario" ON public.todo_comentario;
DROP POLICY IF EXISTS "Dev anon read todo_historico" ON public.todo_historico;

DROP POLICY IF EXISTS "Autenticado cria anexo" ON public.todo_anexo;
CREATE POLICY "Autenticado cria anexo" ON public.todo_anexo
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = autor_id);

DROP POLICY IF EXISTS "Autenticado faz upload de áudio" ON storage.objects;
CREATE POLICY "Autenticado faz upload de áudio" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'reuniao-audios'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Autenticado remove anexo de tarefa" ON storage.objects;
CREATE POLICY "Autor ou gestor remove anexo de tarefa" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'tarefa-anexos'
    AND (
      public.has_role(auth.uid(), 'gestor'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.todo_anexo a
        WHERE a.storage_path = storage.objects.name
          AND a.autor_id = auth.uid()
      )
    )
  );

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, public;

CREATE TABLE IF NOT EXISTS public.invite_token (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  email text NOT NULL,
  role app_role NOT NULL DEFAULT 'analista',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invite_token_email ON public.invite_token(lower(email));
CREATE INDEX IF NOT EXISTS idx_invite_token_token ON public.invite_token(token);

ALTER TABLE public.invite_token ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gestor gerencia convites" ON public.invite_token;
CREATE POLICY "Gestor gerencia convites" ON public.invite_token
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'gestor'::app_role));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first BOOLEAN;
  v_invite RECORD;
  v_role app_role;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first;

  IF is_first THEN
    v_role := 'gestor';
  ELSE
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

  INSERT INTO public.profiles (user_id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS trg_invite_token_updated ON public.invite_token;
CREATE TRIGGER trg_invite_token_updated
  BEFORE UPDATE ON public.invite_token
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
