-- Adiciona coluna para vincular um usuário (login) a um colaborador
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS colaborador_id uuid REFERENCES public.colaborador(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_colaborador_id_unique
  ON public.profiles(colaborador_id)
  WHERE colaborador_id IS NOT NULL;