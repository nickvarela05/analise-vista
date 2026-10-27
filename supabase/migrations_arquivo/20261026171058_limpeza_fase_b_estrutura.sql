-- Fase B do plano de limpeza (autorizada pelo Nickolas em 26/10/2026): itens 1, 2, 3, 5 e 6.

-- B1: busca por linguagem natural sem uso (a edge function busca-natural sai do repositório).
DROP FUNCTION IF EXISTS public.executar_busca_natural(text);

-- B2: tabelas do chat de WhatsApp, vazias e sem uso no código.
DROP TABLE IF EXISTS public.chat_whatsapp_log;
DROP TABLE IF EXISTS public.chat_rate_limit;

-- B3: função da rotina já desligada.
DROP FUNCTION IF EXISTS public.limpar_atribuicoes_finalizadas();

-- B5: auditoria. log_audit_event aceita, opcionalmente, uma lista de colunas (separadas por
-- vírgula) que ficam fora do registro; mudanças só nelas não geram linha.
CREATE OR REPLACE FUNCTION public.log_audit_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_changed text[];
  v_record_id uuid;
  v_fora text[] := CASE WHEN TG_NARGS > 0 THEN string_to_array(TG_ARGV[0], ',') ELSE ARRAY[]::text[] END;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD) - v_fora;
    v_new := NULL;
    v_record_id := OLD.id;
  ELSIF TG_OP = 'INSERT' THEN
    v_old := NULL;
    v_new := to_jsonb(NEW) - v_fora;
    v_record_id := NEW.id;
  ELSE
    v_old := to_jsonb(OLD) - v_fora;
    v_new := to_jsonb(NEW) - v_fora;
    v_record_id := NEW.id;
    SELECT array_agg(key)
      INTO v_changed
      FROM jsonb_each(v_new)
     WHERE v_new -> key IS DISTINCT FROM v_old -> key
       AND key NOT IN ('updated_at');
    IF v_changed IS NULL OR array_length(v_changed,1) = 0 THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.audit_log (table_name, record_id, operation, changed_by, old_data, new_data, changed_fields)
  VALUES (TG_TABLE_NAME, v_record_id, TG_OP, auth.uid(), v_old, v_new, v_changed);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

-- Reunião: sem a transcrição (texto inteiro copiado a cada atualização) e sem o progresso dela.
DROP TRIGGER IF EXISTS audit_reuniao ON public.reuniao;
CREATE TRIGGER audit_reuniao AFTER INSERT OR DELETE OR UPDATE ON public.reuniao
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event(
    'transcricao,transcricao_status,transcricao_erro,transcricao_partes_feitas,transcricao_partes_total,transcricao_rodadas'
  );

-- E-mails: o próprio email_send_log já é um log; auditar ele era log de log.
DROP TRIGGER IF EXISTS trg_email_send_log_audit ON public.email_send_log;

-- B6: histórico de execução das rotinas guarda 14 dias (todo dia às 03:30 UTC).
SELECT cron.schedule(
  'limpar-historico-rotinas',
  '30 3 * * *',
  $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '14 days'$$
);
