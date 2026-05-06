CREATE TABLE public.colaborador_galeria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador_id UUID NOT NULL,
  foto_url TEXT NOT NULL,
  legenda TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.colaborador_galeria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe vê galeria"
ON public.colaborador_galeria FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Gestor gerencia galeria"
ON public.colaborador_galeria FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'gestor'::app_role))
WITH CHECK (has_role(auth.uid(), 'gestor'::app_role));

CREATE INDEX idx_colaborador_galeria_colab ON public.colaborador_galeria(colaborador_id, ordem);

CREATE TRIGGER update_colaborador_galeria_updated_at
BEFORE UPDATE ON public.colaborador_galeria
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();