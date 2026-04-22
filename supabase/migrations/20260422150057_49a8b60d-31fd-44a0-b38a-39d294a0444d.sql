-- 1) Estender enum todo_status com novos status do workflow
ALTER TYPE public.todo_status ADD VALUE IF NOT EXISTS 'aberta';
ALTER TYPE public.todo_status ADD VALUE IF NOT EXISTS 'encaminhada';
ALTER TYPE public.todo_status ADD VALUE IF NOT EXISTS 'homologacao';
ALTER TYPE public.todo_status ADD VALUE IF NOT EXISTS 'producao';
ALTER TYPE public.todo_status ADD VALUE IF NOT EXISTS 'reprovada';

-- 2) Tabela de horários por colaborador
CREATE TABLE IF NOT EXISTS public.colaborador_horario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL REFERENCES public.colaborador(id) ON DELETE CASCADE,
  dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  expediente_inicio TIME,
  expediente_fim TIME,
  almoco_inicio TIME,
  almoco_fim TIME,
  local_almoco TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (colaborador_id, dia_semana)
);

ALTER TABLE public.colaborador_horario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe vê horarios" ON public.colaborador_horario
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Gestor gerencia horarios" ON public.colaborador_horario
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Dev anon read colaborador_horario" ON public.colaborador_horario
  FOR SELECT TO anon USING (true);

CREATE TRIGGER update_colaborador_horario_updated_at
  BEFORE UPDATE ON public.colaborador_horario
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Tabela de férias por colaborador
CREATE TABLE IF NOT EXISTS public.colaborador_ferias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL REFERENCES public.colaborador(id) ON DELETE CASCADE,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (data_fim >= data_inicio)
);

ALTER TABLE public.colaborador_ferias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe vê ferias" ON public.colaborador_ferias
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Gestor gerencia ferias" ON public.colaborador_ferias
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Dev anon read colaborador_ferias" ON public.colaborador_ferias
  FOR SELECT TO anon USING (true);

CREATE TRIGGER update_colaborador_ferias_updated_at
  BEFORE UPDATE ON public.colaborador_ferias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Enums e tabela de chamados externos (Relatórios)
DO $$ BEGIN
  CREATE TYPE public.chamado_externo_status AS ENUM (
    'aberto','encaminhado','homologacao','producao','concluido','reprovado','cancelado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.chamado_externo_prioridade AS ENUM ('baixa','media','alta','critica');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.chamado_externo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  cliente TEXT,
  modulo TEXT,
  responsavel_id UUID REFERENCES public.colaborador(id) ON DELETE SET NULL,
  status public.chamado_externo_status NOT NULL DEFAULT 'aberto',
  prioridade public.chamado_externo_prioridade NOT NULL DEFAULT 'media',
  abertura TIMESTAMPTZ NOT NULL DEFAULT now(),
  prazo DATE,
  origem TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chamado_externo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe vê chamados externos" ON public.chamado_externo
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Equipe gerencia chamados externos" ON public.chamado_externo
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Dev anon read chamado_externo" ON public.chamado_externo
  FOR SELECT TO anon USING (true);

CREATE TRIGGER update_chamado_externo_updated_at
  BEFORE UPDATE ON public.chamado_externo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_chamado_externo_status ON public.chamado_externo(status);
CREATE INDEX IF NOT EXISTS idx_chamado_externo_prioridade ON public.chamado_externo(prioridade);

-- 5) Vincular avisos a um colaborador (opcional)
ALTER TABLE public.aviso_gestor
  ADD COLUMN IF NOT EXISTS colaborador_id UUID REFERENCES public.colaborador(id) ON DELETE SET NULL;