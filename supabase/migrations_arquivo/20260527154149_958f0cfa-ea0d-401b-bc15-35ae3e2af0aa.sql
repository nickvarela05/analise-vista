DROP POLICY IF EXISTS "Autor ou gestor reativa" ON public.relatorio_inativo;

CREATE POLICY "Autenticado reativa"
ON public.relatorio_inativo
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);