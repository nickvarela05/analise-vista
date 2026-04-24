
DO $$ BEGIN
  CREATE TYPE public.reuniao_transcricao_status AS ENUM ('pendente', 'processando', 'concluido', 'erro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.reuniao
  ADD COLUMN IF NOT EXISTS transcricao_status public.reuniao_transcricao_status NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS transcricao_erro text,
  ADD COLUMN IF NOT EXISTS decisoes text[],
  ADD COLUMN IF NOT EXISTS participantes_detectados text[];

ALTER TABLE public.reuniao REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.reuniao;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
