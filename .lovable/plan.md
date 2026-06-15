## 1. Avaliação do fluxo n8n

O fluxo está **funcionalmente correto**:

```text
Webhook (POST /email-digest, rawBody) → Validar HMAC (timingSafeEqual)
   └─ válido → Send Email (SMTP) → Responder 200
   └─ inválido → Responder 401
```

Bate exatamente com o que a Edge Function `dispatch-email-digest` envia:
- POST JSON `{ to, subject, html, text }`
- header `X-Signature` = HMAC-SHA256(body, `N8N_EMAIL_HMAC_SECRET`)

Pontos a corrigir/observar (não bloqueiam o funcionamento, mas vale ajustar no n8n):

- **Segredo em código aberto.** O `SECRET` está hard-coded no nó "Validar HMAC". Mover para **Credentials → Header Auth / Env** do n8n e ler via `process.env.SISTEPLAN_HMAC_SECRET`. Se esse JSON vazar (export/print), o segredo vaza junto.
- **Sem tratamento de erro do SMTP.** Hoje, se o SMTP falhar, o n8n responde com erro genérico e o `email_send_log` fica preso em `pending`/`failed` sem detalhe. Sugerido: adicionar branch `On Error` no nó SMTP → "Responder 500" com a mensagem do erro, para o backend marcar `failed` com `last_error`.
- **Sem `text` fallback.** O nó SMTP só usa `html`. Bom incluir `text: $json.text` em Options → Text para clientes que bloqueiam HTML.
- **Idempotência.** O fluxo não deduplica entregas. Se o backend reenfileirar (ex: cron retry), pode mandar 2x. Posso passar a incluir um `Message-Id` único no payload e usar nas headers do SMTP.

Nenhuma alteração no projeto Lovable é necessária para o fluxo — ele já funciona como está. Os ajustes acima são feitos dentro do próprio n8n.

## 2. Gestão de destinatários do resumo diário

Hoje o resumo diário é enviado para **todos** os perfis com e-mail, salvo se o usuário tenha desativado a preferência `sistema/email`. Não há painel pra gestor controlar quem recebe.

### O que adicionar

**a) Coluna nova `recebe_resumo_diario` em `profiles`** (default `true`).
- Gestor pode ler/atualizar essa coluna em qualquer perfil.
- Usuário comum continua só com acesso ao próprio perfil.

**b) Filtro novo no `dispatch-email-digest` (modo `resumo_diario`)**:
- `from('profiles').select('user_id, email, nome, recebe_resumo_diario')`
- pula quando `recebe_resumo_diario === false`.
- A preferência individual em `notificacao_preferencia` (sistema/email) continua sendo respeitada como override do próprio usuário.

**c) Card novo em "Configurações → E-mails"** (somente gestor), abaixo do card "Envio de e-mails (N8N)":

```text
Destinatários do resumo diário
┌─────────────────────────────────────────────────────────┐
│  Buscar usuário…           [ Ativar todos ] [ Desativ. ]│
├─────────────────────────────────────────────────────────┤
│ ✓  Joana Silva     joana@…       [toggle ON ]           │
│ ✓  Pedro Souza     pedro@…       [toggle ON ]           │
│ ✗  Marcos Lima     marcos@…      [toggle OFF]           │
└─────────────────────────────────────────────────────────┘
N usuários · M recebem · K não recebem
```

- Lista paginada/scroll com busca por nome/e-mail.
- Toggle individual chama update em `profiles.recebe_resumo_diario`.
- Botões "Ativar todos" / "Desativar todos" (ação em lote).
- Linha desabilitada (cinza) para perfis sem e-mail (não pode receber de qualquer forma).

### Arquivos afetados

- **Migration**:
  - `ALTER TABLE public.profiles ADD COLUMN recebe_resumo_diario boolean NOT NULL DEFAULT true`
  - Política nova de UPDATE em `profiles` permitindo `has_role(auth.uid(),'gestor')` alterar essa coluna em qualquer linha (ou ampliar política existente, dependendo do que já está em `profiles`).
- **Edge function** `supabase/functions/dispatch-email-digest/index.ts`: filtrar `recebe_resumo_diario` no modo `resumo_diario`.
- **Frontend**:
  - Novo componente `src/components/notificacoes/DestinatariosResumoDiario.tsx`.
  - Render dentro de `ConfiguracoesEmails.tsx` (somente quando `role === 'gestor'`).
  - Queries via `@tanstack/react-query` + `supabase` direto (não precisa server fn — RLS gestor já protege).

### Fora de escopo

- Notificações WhatsApp (já marcadas como próximo passo).
- Mudanças no próprio fluxo n8n — fica como recomendação acima.
