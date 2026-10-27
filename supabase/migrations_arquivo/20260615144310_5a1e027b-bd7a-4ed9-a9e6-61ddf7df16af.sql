DROP POLICY IF EXISTS "Autenticado reativa" ON public.relatorio_inativo;

CREATE POLICY "Autor ou gestor reativa"
ON public.relatorio_inativo
FOR DELETE
TO authenticated
USING (
  auth.uid() = inativado_por
  OR public.has_role(auth.uid(), 'gestor'::app_role)
);