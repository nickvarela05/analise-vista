DROP POLICY IF EXISTS "Equipe gerencia chamados externos" ON public.chamado_externo;

CREATE POLICY "Autenticado cria chamado externo" ON public.chamado_externo
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticado atualiza chamado externo" ON public.chamado_externo
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Gestor deleta chamado externo" ON public.chamado_externo
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'gestor'::app_role));