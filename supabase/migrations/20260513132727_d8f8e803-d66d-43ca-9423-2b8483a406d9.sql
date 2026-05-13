
CREATE TABLE public.todo_importacao_lote (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  tipo text NOT NULL DEFAULT 'homologacao',
  total_tarefas integer NOT NULL DEFAULT 0,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.todo_importacao_lote ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe vê lotes de importação"
  ON public.todo_importacao_lote FOR SELECT TO authenticated USING (true);

CREATE POLICY "Autenticado cria lote de importação"
  ON public.todo_importacao_lote FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = criado_por);

CREATE POLICY "Criador ou gestor atualiza lote"
  ON public.todo_importacao_lote FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'gestor'::app_role) OR auth.uid() = criado_por);

CREATE POLICY "Criador ou gestor deleta lote"
  ON public.todo_importacao_lote FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'gestor'::app_role) OR auth.uid() = criado_por);

CREATE TRIGGER update_todo_importacao_lote_updated_at
  BEFORE UPDATE ON public.todo_importacao_lote
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.todo
  ADD COLUMN lote_importacao_id uuid REFERENCES public.todo_importacao_lote(id) ON DELETE SET NULL,
  ADD COLUMN origem_importacao text;

CREATE INDEX idx_todo_lote_importacao ON public.todo(lote_importacao_id);
CREATE INDEX idx_todo_origem_importacao ON public.todo(origem_importacao);
