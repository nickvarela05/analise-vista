
-- ============================================
-- FASE 2.5 — Email via N8N + FASE 3 — IA
-- ============================================

-- email_send_log: auditoria de envios
CREATE TABLE public.email_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT,
  notificacao_ids UUID[],
  status TEXT NOT NULL DEFAULT 'pending', -- pending | sent | failed | skipped
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  webhook_response JSONB,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_send_log_status ON public.email_send_log(status, scheduled_for);
CREATE INDEX idx_email_send_log_user ON public.email_send_log(user_id, created_at DESC);

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestor lê email_send_log"
  ON public.email_send_log FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'gestor'::app_role));

CREATE TRIGGER trg_email_send_log_updated_at
  BEFORE UPDATE ON public.email_send_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_email_send_log_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.email_send_log
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- resumo_semanal: histórico de resumos da IA
CREATE TABLE public.resumo_semanal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  semana_inicio DATE NOT NULL,
  semana_fim DATE NOT NULL,
  conteudo_md TEXT NOT NULL,
  metricas JSONB,
  insights TEXT[],
  modelo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, semana_inicio)
);

CREATE INDEX idx_resumo_semanal_user ON public.resumo_semanal(user_id, semana_inicio DESC);

ALTER TABLE public.resumo_semanal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário lê seu resumo"
  ON public.resumo_semanal FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'gestor'::app_role));

-- adiciona tipo "resumo_semanal" ao enum
ALTER TYPE public.notificacao_tipo ADD VALUE IF NOT EXISTS 'resumo_semanal';

-- agenda envio imediato pra notificação crítica
CREATE OR REPLACE FUNCTION public.enqueue_email_imediato()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_pref_ativo BOOLEAN;
  v_subject TEXT;
BEGIN
  -- só agenda envio imediato para tipos críticos
  IF NEW.tipo NOT IN ('demanda_urgente', 'chamado_sla', 'aviso_critico') THEN
    RETURN NEW;
  END IF;

  -- respeita preferência de e-mail (default = ativo)
  SELECT ativo INTO v_pref_ativo
    FROM public.notificacao_preferencia
   WHERE user_id = NEW.user_id AND evento = NEW.tipo AND canal = 'email';
  IF v_pref_ativo IS FALSE THEN RETURN NEW; END IF;

  SELECT email INTO v_email FROM public.profiles WHERE user_id = NEW.user_id;
  IF v_email IS NULL OR v_email = '' THEN RETURN NEW; END IF;

  v_subject := '[URGENTE] ' || NEW.titulo;

  INSERT INTO public.email_send_log (user_id, recipient_email, subject, body_text, notificacao_ids, status, scheduled_for)
  VALUES (
    NEW.user_id, v_email, v_subject, COALESCE(NEW.mensagem, ''), ARRAY[NEW.id],
    'pending', now()
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notificacao_email_imediato
  AFTER INSERT ON public.notificacao
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_email_imediato();

REVOKE EXECUTE ON FUNCTION public.enqueue_email_imediato() FROM PUBLIC, anon, authenticated;

-- pg_cron + pg_net (já habilitados normalmente)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- cron 1: digest diário 8h (chama edge function)
SELECT cron.schedule(
  'dispatch-email-digest-diario',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://tcapurryhrqfykvzxsfq.supabase.co/functions/v1/dispatch-email-digest',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjYXB1cnJ5aHJxZnlrdnp4c2ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NDY1OTQsImV4cCI6MjA5MjAyMjU5NH0.cqvuCum0XylPjryUM_vWzYxVSN3f3-J0bFR_iCGSTFs"}'::jsonb,
    body := '{"mode": "digest"}'::jsonb
  );
  $$
);

-- cron 2: processa e-mails pendentes a cada 5min (pega os imediatos)
SELECT cron.schedule(
  'dispatch-email-imediato',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tcapurryhrqfykvzxsfq.supabase.co/functions/v1/dispatch-email-digest',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjYXB1cnJ5aHJxZnlrdnp4c2ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NDY1OTQsImV4cCI6MjA5MjAyMjU5NH0.cqvuCum0XylPjryUM_vWzYxVSN3f3-J0bFR_iCGSTFs"}'::jsonb,
    body := '{"mode": "imediato"}'::jsonb
  );
  $$
);

-- cron 3: resumo semanal todas as segundas 7h
SELECT cron.schedule(
  'gerar-resumo-semanal',
  '0 7 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://tcapurryhrqfykvzxsfq.supabase.co/functions/v1/gerar-resumo-semanal',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjYXB1cnJ5aHJxZnlrdnp4c2ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NDY1OTQsImV4cCI6MjA5MjAyMjU5NH0.cqvuCum0XylPjryUM_vWzYxVSN3f3-J0bFR_iCGSTFs"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
