
DO $$ BEGIN
  CREATE TYPE public.processo_status AS ENUM ('planejado','em_andamento','concluido','atrasado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.processo_anual (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ano INT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  cor TEXT NOT NULL DEFAULT 'indigo',
  previsto_inicio DATE,
  previsto_fim DATE,
  real_inicio DATE,
  real_fim DATE,
  responsaveis_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  equipe_toda BOOLEAN NOT NULL DEFAULT false,
  status public.processo_status NOT NULL DEFAULT 'planejado',
  alerta_dias_antes INT NOT NULL DEFAULT 14,
  observacoes TEXT,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.processo_anual TO authenticated;
GRANT ALL ON public.processo_anual TO service_role;

ALTER TABLE public.processo_anual ENABLE ROW LEVEL SECURITY;

CREATE POLICY "processo_anual_select_auth" ON public.processo_anual
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "processo_anual_insert_gestor" ON public.processo_anual
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "processo_anual_update_gestor" ON public.processo_anual
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "processo_anual_delete_gestor" ON public.processo_anual
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'));

CREATE TRIGGER trg_processo_anual_updated_at
  BEFORE UPDATE ON public.processo_anual
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_processo_anual_ano ON public.processo_anual(ano);
CREATE INDEX IF NOT EXISTS idx_processo_anual_previsto ON public.processo_anual(previsto_inicio, previsto_fim);

CREATE TABLE IF NOT EXISTS public.processo_anual_vinculo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_anual(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('tarefa','demanda')),
  ref_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (processo_id, tipo, ref_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.processo_anual_vinculo TO authenticated;
GRANT ALL ON public.processo_anual_vinculo TO service_role;

ALTER TABLE public.processo_anual_vinculo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "processo_vinculo_select_auth" ON public.processo_anual_vinculo
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "processo_vinculo_write_gestor" ON public.processo_anual_vinculo
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'gestor'));

CREATE INDEX IF NOT EXISTS idx_processo_vinculo_processo ON public.processo_anual_vinculo(processo_id);
