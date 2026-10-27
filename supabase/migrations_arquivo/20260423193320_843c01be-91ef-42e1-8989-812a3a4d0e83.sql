-- 1) Multi-destinatários no aviso_gestor
ALTER TABLE public.aviso_gestor
  ADD COLUMN IF NOT EXISTS colaboradores_ids uuid[] NOT NULL DEFAULT '{}';

-- 2) Tabela de leituras
CREATE TABLE IF NOT EXISTS public.aviso_leitura (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aviso_id uuid NOT NULL REFERENCES public.aviso_gestor(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  lido_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (aviso_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_aviso_leitura_user ON public.aviso_leitura(user_id);
CREATE INDEX IF NOT EXISTS idx_aviso_leitura_aviso ON public.aviso_leitura(aviso_id);

ALTER TABLE public.aviso_leitura ENABLE ROW LEVEL SECURITY;

-- Cada usuário vê suas leituras; gestor vê tudo
CREATE POLICY "Usuário vê suas leituras"
  ON public.aviso_leitura FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Usuário marca como lida"
  ON public.aviso_leitura FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuário remove sua leitura"
  ON public.aviso_leitura FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Dev anon read (mesmo padrão das demais tabelas)
CREATE POLICY "Dev anon read aviso_leitura"
  ON public.aviso_leitura FOR SELECT
  TO anon
  USING (true);