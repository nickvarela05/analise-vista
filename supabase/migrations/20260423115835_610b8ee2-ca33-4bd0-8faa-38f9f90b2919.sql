-- 1. Add multi-assignment columns
ALTER TABLE public.demanda
  ADD COLUMN IF NOT EXISTS responsaveis_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS equipe_toda boolean NOT NULL DEFAULT false;

ALTER TABLE public.todo
  ADD COLUMN IF NOT EXISTS responsaveis_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS equipe_toda boolean NOT NULL DEFAULT false;

ALTER TABLE public.reuniao
  ADD COLUMN IF NOT EXISTS responsaveis_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS equipe_toda boolean NOT NULL DEFAULT false;

ALTER TABLE public.chamado_externo
  ADD COLUMN IF NOT EXISTS responsaveis_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS equipe_toda boolean NOT NULL DEFAULT false;

-- Backfill: if there is a single responsavel_id, seed the array with it
UPDATE public.demanda SET responsaveis_ids = ARRAY[responsavel_id]
  WHERE responsavel_id IS NOT NULL AND (responsaveis_ids IS NULL OR cardinality(responsaveis_ids) = 0);
UPDATE public.todo SET responsaveis_ids = ARRAY[responsavel_id]
  WHERE responsavel_id IS NOT NULL AND (responsaveis_ids IS NULL OR cardinality(responsaveis_ids) = 0);
UPDATE public.reuniao SET responsaveis_ids = ARRAY[responsavel_id]
  WHERE responsavel_id IS NOT NULL AND (responsaveis_ids IS NULL OR cardinality(responsaveis_ids) = 0);
UPDATE public.chamado_externo SET responsaveis_ids = ARRAY[responsavel_id]
  WHERE responsavel_id IS NOT NULL AND (responsaveis_ids IS NULL OR cardinality(responsaveis_ids) = 0);

-- 2. Reduce chamado_externo_status to 3 values: aberto, encaminhado, finalizado
-- Create new enum
CREATE TYPE public.chamado_externo_status_new AS ENUM ('aberto', 'encaminhado', 'finalizado');

-- Drop default, convert column with mapping, then restore default
ALTER TABLE public.chamado_externo ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.chamado_externo
  ALTER COLUMN status TYPE public.chamado_externo_status_new
  USING (
    CASE status::text
      WHEN 'aberto' THEN 'aberto'
      WHEN 'encaminhado' THEN 'encaminhado'
      WHEN 'homologacao' THEN 'encaminhado'
      WHEN 'producao' THEN 'encaminhado'
      WHEN 'concluido' THEN 'finalizado'
      WHEN 'reprovado' THEN 'finalizado'
      WHEN 'cancelado' THEN 'finalizado'
      ELSE 'aberto'
    END
  )::public.chamado_externo_status_new;

-- Replace old enum
DROP TYPE public.chamado_externo_status;
ALTER TYPE public.chamado_externo_status_new RENAME TO chamado_externo_status;

ALTER TABLE public.chamado_externo
  ALTER COLUMN status SET DEFAULT 'aberto'::public.chamado_externo_status;