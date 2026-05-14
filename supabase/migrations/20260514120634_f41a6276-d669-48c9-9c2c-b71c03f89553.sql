
CREATE TABLE public.relatorio_inativo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  solicitacao_id TEXT NOT NULL UNIQUE,
  inativado_por UUID,
  inativado_por_nome TEXT,
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.relatorio_inativo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe vê inativações"
  ON public.relatorio_inativo FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Autenticado inativa"
  ON public.relatorio_inativo FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Autor ou gestor reativa"
  ON public.relatorio_inativo FOR DELETE
  TO authenticated USING (auth.uid() = inativado_por OR has_role(auth.uid(), 'gestor'::app_role));

CREATE INDEX idx_relatorio_inativo_solic ON public.relatorio_inativo(solicitacao_id);
