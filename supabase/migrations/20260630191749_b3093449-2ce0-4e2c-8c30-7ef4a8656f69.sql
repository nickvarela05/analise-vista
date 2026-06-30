DROP POLICY IF EXISTS "Autenticado atualiza tarefas" ON public.todo;

CREATE POLICY "Update tarefa por gestor, criador ou responsavel"
ON public.todo
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'gestor'::app_role)
  OR auth.uid() = criado_por
  OR auth.uid() = responsavel_id
  OR auth.uid() = ANY(COALESCE(responsaveis_ids, ARRAY[]::uuid[]))
)
WITH CHECK (
  public.has_role(auth.uid(), 'gestor'::app_role)
  OR auth.uid() = criado_por
  OR auth.uid() = responsavel_id
  OR auth.uid() = ANY(COALESCE(responsaveis_ids, ARRAY[]::uuid[]))
);