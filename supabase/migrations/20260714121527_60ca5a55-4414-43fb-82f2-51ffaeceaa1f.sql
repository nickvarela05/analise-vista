
CREATE TABLE IF NOT EXISTS public.email_digest_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  dias_semana smallint[] NOT NULL DEFAULT ARRAY[1,2,3,4,5]::smallint[],
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.email_digest_config TO authenticated;
GRANT ALL ON public.email_digest_config TO service_role;

ALTER TABLE public.email_digest_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "digest_config_select_gestor" ON public.email_digest_config;
CREATE POLICY "digest_config_select_gestor" ON public.email_digest_config
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'::app_role));

DROP POLICY IF EXISTS "digest_config_write_gestor" ON public.email_digest_config;
CREATE POLICY "digest_config_write_gestor" ON public.email_digest_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'gestor'::app_role));

INSERT INTO public.email_digest_config (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
