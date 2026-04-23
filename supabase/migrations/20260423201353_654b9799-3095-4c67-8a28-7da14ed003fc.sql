
-- Histórico: exige autenticação para inserir
DROP POLICY IF EXISTS "Autenticado cria histórico" ON public.todo_historico;
CREATE POLICY "Autenticado cria histórico" ON public.todo_historico
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Checklist: separa policies em vez de ALL com true
DROP POLICY IF EXISTS "Autenticado gerencia checklist" ON public.todo_checklist;
CREATE POLICY "Autenticado cria checklist" ON public.todo_checklist
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Autenticado atualiza checklist" ON public.todo_checklist
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Autenticado remove checklist" ON public.todo_checklist
  FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Storage: restringe upload e delete a autenticados (já estavam, reforça com IS NOT NULL)
DROP POLICY IF EXISTS "Autenticado faz upload em tarefa-anexos" ON storage.objects;
CREATE POLICY "Autenticado faz upload em tarefa-anexos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tarefa-anexos' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Autenticado remove anexo de tarefa" ON storage.objects;
CREATE POLICY "Autenticado remove anexo de tarefa"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'tarefa-anexos' AND auth.uid() IS NOT NULL);
