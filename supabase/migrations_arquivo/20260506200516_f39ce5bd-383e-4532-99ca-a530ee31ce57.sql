DO $$ BEGIN
  CREATE TYPE public.local_trabalho AS ENUM ('escritorio', 'rua');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.colaborador
  ADD COLUMN IF NOT EXISTS local_trabalho public.local_trabalho NOT NULL DEFAULT 'escritorio';