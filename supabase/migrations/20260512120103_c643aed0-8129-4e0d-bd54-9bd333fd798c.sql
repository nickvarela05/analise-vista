CREATE TABLE public.ia_prompt_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  prompt_sistema text NOT NULL,
  instrucoes_extras text,
  ativo boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ia_prompt_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticado lê prompts de IA"
  ON public.ia_prompt_config FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Gestor gerencia prompts de IA"
  ON public.ia_prompt_config FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestor'::app_role));

CREATE TRIGGER update_ia_prompt_config_updated_at
  BEFORE UPDATE ON public.ia_prompt_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.ia_prompt_config (chave, prompt_sistema, instrucoes_extras, ativo)
VALUES (
  'analise_reuniao',
  'Você é um analista de reuniões. Receberá a transcrição de uma reunião em português. Extraia informações estruturadas, objetivas e profissionais. Não invente nada.',
  NULL,
  true
);