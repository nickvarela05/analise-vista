-- Agenda a limpeza dos áudios de reunião (função limpar-audios-reuniao), todo dia às 3h de
-- Brasília (6h UTC). Aplicada em 14/10/2026 com confirmação do Nickolas ("ligue"), depois da
-- primeira execução manual (13 áudios, 148 MB, transcrições preservadas).
-- Mesmo padrão dos outros crons: segredo lido do Vault, sem chave em texto no comando.
SELECT cron.schedule(
  'limpar-audios-reuniao',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://toatihyfgqnrxwgotwrn.supabase.co/functions/v1/limpar-audios-reuniao',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)),
    body := '{}'::jsonb);
  $$
);
