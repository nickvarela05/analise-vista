-- 1. profiles.telefone
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telefone TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_telefone_unique ON public.profiles(telefone) WHERE telefone IS NOT NULL;

-- 2. chat_whatsapp_log
CREATE TABLE public.chat_whatsapp_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  telefone TEXT NOT NULL,
  pergunta TEXT NOT NULL,
  resposta TEXT,
  tools_chamadas JSONB DEFAULT '[]'::jsonb,
  tokens_input INTEGER,
  tokens_output INTEGER,
  latencia_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'ok',
  erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX chat_whatsapp_log_telefone_idx ON public.chat_whatsapp_log(telefone, created_at DESC);
CREATE INDEX chat_whatsapp_log_user_idx ON public.chat_whatsapp_log(user_id, created_at DESC);
GRANT SELECT ON public.chat_whatsapp_log TO authenticated;
GRANT ALL ON public.chat_whatsapp_log TO service_role;
ALTER TABLE public.chat_whatsapp_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gestores leem logs do chat" ON public.chat_whatsapp_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'::app_role));

-- 3. chat_rate_limit
CREATE TABLE public.chat_rate_limit (
  telefone TEXT NOT NULL,
  janela_inicio TIMESTAMPTZ NOT NULL,
  contagem INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (telefone, janela_inicio)
);
CREATE INDEX chat_rate_limit_janela_idx ON public.chat_rate_limit(janela_inicio);
GRANT ALL ON public.chat_rate_limit TO service_role;
ALTER TABLE public.chat_rate_limit ENABLE ROW LEVEL SECURITY;
-- sem policies para authenticated/anon: só service_role acessa