
DROP POLICY IF EXISTS "Autenticado cria histórico" ON public.todo_historico;
CREATE POLICY "Envolvido cria histórico" ON public.todo_historico
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.todo t
      WHERE t.id = todo_id
        AND (
          has_role(auth.uid(), 'gestor'::app_role)
          OR t.criado_por = auth.uid()
          OR t.responsavel_id = auth.uid()
          OR auth.uid() = ANY(t.responsaveis_ids)
          OR t.equipe_toda = true
        )
    )
  );
