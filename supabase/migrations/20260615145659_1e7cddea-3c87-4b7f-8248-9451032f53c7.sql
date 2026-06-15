ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS recebe_resumo_diario boolean NOT NULL DEFAULT true;