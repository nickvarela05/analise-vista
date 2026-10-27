-- Sincronização automática do Google Agenda a cada 15 min (16/10/2026, autorizado pelo Nickolas).
-- A tela sempre prometeu "a cada 15 min", mas o agendamento nunca existiu. O endpoint respeita
-- o interruptor sync_ativo de google_calendar_config.
select cron.schedule(
  'sync-google-agenda-15min',
  '*/15 * * * *',
  $cron$
  select net.http_post(
    url := 'https://nexus.nickvarela127.workers.dev/api/public/hooks/sync-google-calendar',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'CRON_SECRET' limit 1)),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000);
  $cron$
);
