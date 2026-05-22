ALTER TABLE public.todo
  ADD COLUMN IF NOT EXISTS em_teste boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_todo_em_teste ON public.todo (em_teste) WHERE em_teste = true;