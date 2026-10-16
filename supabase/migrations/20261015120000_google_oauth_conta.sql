-- Google Agenda por OAuth (15/10/2026): guarda o refresh token da conta da equipe
-- (relatorioged@). Sem nenhuma policy e sem grants: só o service role (servidor) lê
-- e escreve. Uma linha só (id = true), como google_calendar_config.
create table public.google_oauth_conta (
  id boolean primary key default true check (id),
  refresh_token text not null,
  email text,
  conectado_por uuid references auth.users(id) on delete set null,
  conectado_em timestamptz not null default now()
);
alter table public.google_oauth_conta enable row level security;
revoke all on public.google_oauth_conta from anon, authenticated;
