
-- 1) Novos valores no enum todo_status
ALTER TYPE todo_status ADD VALUE IF NOT EXISTS 'aprovado';
ALTER TYPE todo_status ADD VALUE IF NOT EXISTS 'aprovado_ressalvas';

-- 2) Tabela de comentários
CREATE TABLE IF NOT EXISTS public.todo_comentario (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  todo_id UUID NOT NULL REFERENCES public.todo(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL,
  autor_nome TEXT,
  conteudo TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_todo_comentario_todo ON public.todo_comentario(todo_id);
ALTER TABLE public.todo_comentario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe vê comentários" ON public.todo_comentario
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Dev anon read todo_comentario" ON public.todo_comentario
  FOR SELECT TO anon USING (true);
CREATE POLICY "Autenticado cria comentário" ON public.todo_comentario
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = autor_id);
CREATE POLICY "Autor ou gestor remove comentário" ON public.todo_comentario
  FOR DELETE TO authenticated
  USING (auth.uid() = autor_id OR has_role(auth.uid(), 'gestor'::app_role));

-- 3) Tabela de histórico
CREATE TABLE IF NOT EXISTS public.todo_historico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  todo_id UUID NOT NULL REFERENCES public.todo(id) ON DELETE CASCADE,
  autor_id UUID,
  autor_nome TEXT,
  campo TEXT NOT NULL,
  valor_antigo TEXT,
  valor_novo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_todo_historico_todo ON public.todo_historico(todo_id);
ALTER TABLE public.todo_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe vê histórico" ON public.todo_historico
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Dev anon read todo_historico" ON public.todo_historico
  FOR SELECT TO anon USING (true);
CREATE POLICY "Autenticado cria histórico" ON public.todo_historico
  FOR INSERT TO authenticated WITH CHECK (true);

-- 4) Tabela de checklist
CREATE TABLE IF NOT EXISTS public.todo_checklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  todo_id UUID NOT NULL REFERENCES public.todo(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  concluido BOOLEAN NOT NULL DEFAULT false,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_todo_checklist_todo ON public.todo_checklist(todo_id);
ALTER TABLE public.todo_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe vê checklist" ON public.todo_checklist
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Dev anon read todo_checklist" ON public.todo_checklist
  FOR SELECT TO anon USING (true);
CREATE POLICY "Autenticado gerencia checklist" ON public.todo_checklist
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_todo_checklist_updated_at
  BEFORE UPDATE ON public.todo_checklist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Tabela de anexos
CREATE TABLE IF NOT EXISTS public.todo_anexo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  todo_id UUID NOT NULL REFERENCES public.todo(id) ON DELETE CASCADE,
  autor_id UUID,
  autor_nome TEXT,
  nome_arquivo TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  tamanho_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_todo_anexo_todo ON public.todo_anexo(todo_id);
ALTER TABLE public.todo_anexo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe vê anexos" ON public.todo_anexo
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Dev anon read todo_anexo" ON public.todo_anexo
  FOR SELECT TO anon USING (true);
CREATE POLICY "Autenticado cria anexo" ON public.todo_anexo
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autor ou gestor remove anexo" ON public.todo_anexo
  FOR DELETE TO authenticated
  USING (auth.uid() = autor_id OR has_role(auth.uid(), 'gestor'::app_role));

-- 6) Bucket de storage privado para anexos de tarefas
INSERT INTO storage.buckets (id, name, public)
VALUES ('tarefa-anexos', 'tarefa-anexos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Autenticado vê anexos de tarefa"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'tarefa-anexos');
CREATE POLICY "Autenticado faz upload em tarefa-anexos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tarefa-anexos');
CREATE POLICY "Autenticado remove anexo de tarefa"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'tarefa-anexos');
