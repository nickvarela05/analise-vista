DROP POLICY IF EXISTS "Atualiza tarefa própria ou gestor" ON public.todo;
CREATE POLICY "Autenticado atualiza tarefas"
  ON public.todo FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);