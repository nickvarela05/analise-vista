-- Agenda a limpeza dos áudios de reunião (função limpar-audios-reuniao), todo dia às 3h de
-- Brasília (6h UTC). APLICAR SÓ DEPOIS da confirmação do Nickolas sobre a primeira execução,
-- que apaga de uma vez os áudios antigos já transcritos (13 reuniões, ~150 MB, em 14/10/2026).
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
