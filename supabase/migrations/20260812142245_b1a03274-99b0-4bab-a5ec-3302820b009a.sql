ALTER TYPE public.reuniao_transcricao_status ADD VALUE IF NOT EXISTS 'pausado';

ALTER TABLE public.reuniao
  ADD COLUMN IF NOT EXISTS transcricao_partes_feitas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transcricao_partes_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transcricao_rodadas integer NOT NULL DEFAULT 0;