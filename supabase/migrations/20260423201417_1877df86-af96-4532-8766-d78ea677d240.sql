
DROP POLICY IF EXISTS "Autenticado atualiza checklist" ON public.todo_checklist;
DROP POLICY IF EXISTS "Autenticado remove checklist" ON public.todo_checklist;
DROP POLICY IF EXISTS "Autenticado cria checklist" ON public.todo_checklist;

CREATE POLICY "Envolvido cria checklist" ON public.todo_checklist
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

CREATE POLICY "Envolvido atualiza checklist" ON public.todo_checklist
  FOR UPDATE TO authenticated
  USING (
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

CREATE POLICY "Envolvido remove checklist" ON public.todo_checklist
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.todo t
      WHERE t.id = todo_id
        AND (
          has_role(auth.uid(), 'gestor'::app_role)
          OR t.criado_por = auth.uid()
          OR t.responsavel_id = auth.uid()
          OR auth.uid() = ANY(t.responsaveis_ids)
        )
    )
  );
