# Security Notes — Riscos Aceitos

## has_role() — SECURITY DEFINER executável por authenticated

- **Função:** `public.has_role(_user_id uuid, _role app_role)`
- **Grant:** `EXECUTE` para `authenticated` (necessário para RLS policies).
- **Risco:** enumeração de papel de terceiros via RPC (usuário autenticado pode consultar `has_role(<outro_id>, 'gestor')`).
- **Severidade:** baixa.
- **Aceito conscientemente em:** 2026-07-01.
- **Contexto:** sistema interno de equipe fechada; todos os usuários pertencem à mesma organização e papéis não são informação sensível nesse contexto.
- **Revisitar se:** sistema for aberto para múltiplas organizações ou usuários externos.
