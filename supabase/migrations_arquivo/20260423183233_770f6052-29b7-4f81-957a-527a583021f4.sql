-- 1. Enum
CREATE TYPE public.evento_tipo AS ENUM ('folga','falta','atestado','atraso','ferias_avulso');

-- 2. Tabela
CREATE TABLE public.colaborador_evento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.colaborador(id) ON DELETE CASCADE,
  tipo public.evento_tipo NOT NULL,
  data date NOT NULL,
  hora_inicio time,
  hora_fim time,
  observacao text,
  anexo_url text,
  registrado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (colaborador_id, data, tipo)
);

CREATE INDEX idx_colaborador_evento_data ON public.colaborador_evento(data);
CREATE INDEX idx_colaborador_evento_colab ON public.colaborador_evento(colaborador_id);

-- 3. RLS
ALTER TABLE public.colaborador_evento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe vê eventos"
  ON public.colaborador_evento FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Dev anon read colaborador_evento"
  ON public.colaborador_evento FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Gestor gerencia eventos"
  ON public.colaborador_evento FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'gestor'::app_role));

-- 4. Trigger updated_at
CREATE TRIGGER update_colaborador_evento_updated_at
  BEFORE UPDATE ON public.colaborador_evento
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Bucket de anexos (privado)
INSERT INTO storage.buckets (id, name, public)
VALUES ('colaborador-eventos', 'colaborador-eventos', false)
ON CONFLICT (id) DO NOTHING;

-- 6. Storage policies (apenas gestor)
CREATE POLICY "Gestor lê anexos de eventos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'colaborador-eventos' AND public.has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Gestor envia anexos de eventos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'colaborador-eventos' AND public.has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Gestor atualiza anexos de eventos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'colaborador-eventos' AND public.has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Gestor apaga anexos de eventos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'colaborador-eventos' AND public.has_role(auth.uid(), 'gestor'::app_role));