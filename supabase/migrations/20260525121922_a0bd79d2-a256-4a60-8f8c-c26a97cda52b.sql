SELECT cron.unschedule('gerar-resumo-semanal');

SELECT cron.schedule(
  'gerar-resumo-semanal',
  '0 10 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://tcapurryhrqfykvzxsfq.supabase.co/functions/v1/gerar-resumo-semanal',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjYXB1cnJ5aHJxZnlrdnp4c2ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NDY1OTQsImV4cCI6MjA5MjAyMjU5NH0.cqvuCum0XylPjryUM_vWzYxVSN3f3-J0bFR_iCGSTFs"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);