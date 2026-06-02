CREATE TABLE public.unidades_rede (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_unidade text NOT NULL,
  tipo text NOT NULL,
  nome text NOT NULL,
  zona text,
  endereco text,
  bairro text,
  tecnicos uuid[] NOT NULL DEFAULT '{}',
  polo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_unidades_rede_tipo ON public.unidades_rede(tipo);
CREATE INDEX idx_unidades_rede_zona ON public.unidades_rede(zona);
CREATE INDEX idx_unidades_rede_bairro ON public.unidades_rede(bairro);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.unidades_rede TO authenticated;
GRANT ALL ON public.unidades_rede TO service_role;

ALTER TABLE public.unidades_rede ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe vê unidades"
  ON public.unidades_rede FOR SELECT TO authenticated USING (true);

CREATE POLICY "Gestor gerencia unidades"
  ON public.unidades_rede FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'gestor'::app_role));

CREATE TRIGGER trg_unidades_rede_updated_at
  BEFORE UPDATE ON public.unidades_rede
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();