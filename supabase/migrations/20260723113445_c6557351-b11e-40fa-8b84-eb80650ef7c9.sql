
-- 1) Config única (linha singleton) - somente gestor
CREATE TABLE public.google_calendar_config (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  google_calendar_id TEXT,
  sync_ativo BOOLEAN NOT NULL DEFAULT false,
  dias_horizonte INTEGER NOT NULL DEFAULT 30 CHECK (dias_horizonte BETWEEN 1 AND 180),
  ultima_sync_em TIMESTAMPTZ,
  ultimo_erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.google_calendar_config TO authenticated;
GRANT ALL ON public.google_calendar_config TO service_role;
ALTER TABLE public.google_calendar_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestor gerencia config google calendar"
ON public.google_calendar_config
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'gestor'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'gestor'::app_role));

CREATE TRIGGER trg_google_calendar_config_updated
BEFORE UPDATE ON public.google_calendar_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.google_calendar_config (id) VALUES (true) ON CONFLICT DO NOTHING;

-- 2) Mapeamento entre itens do Nexus e eventos do Google
CREATE TABLE public.google_calendar_evento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fonte TEXT NOT NULL CHECK (fonte IN ('reuniao','tarefa','demanda','chamado')),
  fonte_id UUID NOT NULL,
  google_event_id TEXT NOT NULL,
  google_calendar_id TEXT NOT NULL,
  conteudo_hash TEXT NOT NULL,
  ultima_sync_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fonte, fonte_id)
);
CREATE INDEX idx_gcal_evento_fonte ON public.google_calendar_evento (fonte, fonte_id);

GRANT SELECT ON public.google_calendar_evento TO authenticated;
GRANT ALL ON public.google_calendar_evento TO service_role;
ALTER TABLE public.google_calendar_evento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem mapa"
ON public.google_calendar_evento
FOR SELECT
TO authenticated
USING (true);
