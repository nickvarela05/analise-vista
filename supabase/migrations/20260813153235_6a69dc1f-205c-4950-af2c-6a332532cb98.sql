CREATE OR REPLACE FUNCTION public.marcar_transcricoes_travadas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.reuniao
     SET transcricao_status = 'pausado',
         transcricao_erro = COALESCE(
           'Processamento interrompido — retomando automaticamente'
           || CASE WHEN transcricao_partes_total > 0
                   THEN ' (parte ' || transcricao_partes_feitas || ' de ' || transcricao_partes_total || ')'
                   ELSE '' END, 'Retomando automaticamente')
   WHERE transcricao_status = 'processando'
     AND updated_at < now() - INTERVAL '15 minutes';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.marcar_transcricoes_travadas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_transcricoes_travadas() TO service_role, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'marcar-transcricoes-travadas') THEN
    PERFORM cron.unschedule('marcar-transcricoes-travadas');
  END IF;
  PERFORM cron.schedule(
    'marcar-transcricoes-travadas',
    '*/10 * * * *',
    $cron$ SELECT public.marcar_transcricoes_travadas(); $cron$
  );
END $$;