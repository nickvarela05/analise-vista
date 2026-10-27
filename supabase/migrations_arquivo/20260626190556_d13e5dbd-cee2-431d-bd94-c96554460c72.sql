DROP POLICY IF EXISTS "Autenticado vê anexos de tarefa" ON storage.objects;

CREATE POLICY "Participante vê anexos de tarefa"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'tarefa-anexos'
  AND (
    public.has_role(auth.uid(), 'gestor'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.todo t
      WHERE (t.id)::text = (storage.foldername(objects.name))[1]
        AND (
          t.criado_por = auth.uid()
          OR t.responsavel_id = auth.uid()
          OR auth.uid() = ANY (t.responsaveis_ids)
          OR t.equipe_toda = true
        )
    )
  )
);