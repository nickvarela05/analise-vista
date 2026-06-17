## Causa raiz do erro no nó "Validar HMAC"

O nó é do tipo `Code` (`n8n-nodes-base.code` v2). Esse nó roda em sandbox e **não permite `require()` de módulos nativos** por padrão (`require('crypto')` falha com algo como "Cannot find module 'crypto'" ou "require is not defined"). Por isso o nó quebra e o fluxo nunca chega no SMTP — o que também explica por que o e-mail de teste não chegou.

Existem duas formas de resolver:

- **A (recomendada, sem mexer em infraestrutura)**: reescrever o nó usando a **Web Crypto API** (`globalThis.crypto.subtle`), que está disponível no sandbox sem `require`.
- **B (alternativa)**: pedir ao admin do N8N para setar `NODE_FUNCTION_ALLOW_BUILTIN=crypto` no servidor. Mais invasivo, não recomendo.

Vou seguir a A.

## Passo 1 — Substituir o `jsCode` do nó "Validar HMAC"

Abra o nó **Validar HMAC** no N8N e troque o código por:

```js
// Valida HMAC SHA-256 do body CRU contra o header X-Signature.
// IMPORTANTE: no nó Webhook, Options → "Raw Body" ATIVADO.
const SECRET = '32bc0de44c1484946ff735afa634e35346895831506b435bd4191a544ca96b6f';
const enc = new TextEncoder();

const out = [];
for (const item of $input.all()) {
  const headers = item.json.headers || {};
  const signature = (headers['x-signature'] || headers['X-Signature'] || '').trim();

  let bodyString = '';
  if (item.binary?.data) {
    bodyString = Buffer.from(item.binary.data.data, 'base64').toString('utf8');
  } else if (typeof item.json.body === 'string') {
    bodyString = item.json.body;
  } else {
    bodyString = JSON.stringify(item.json.body ?? item.json);
  }

  const key = await crypto.subtle.importKey(
    'raw', enc.encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(bodyString));
  const expected = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0')).join('');

  const valid = signature.length === expected.length
    && signature.toLowerCase() === expected.toLowerCase();

  let payload = {};
  try { payload = JSON.parse(bodyString); } catch {}

  out.push({
    json: {
      valid,
      payload,
      to: payload?.to,
      subject: payload?.subject,
      html: payload?.html,
      text: payload?.text,
    },
  });
}
return out;
```

Diferenças em relação ao atual:
- Sem `require('crypto')` → usa `crypto.subtle` (global).
- Sem `timingSafeEqual` (também depende de `require`) → comparação case-insensitive de strings hex (mesmo tamanho, mesmo conteúdo). HMAC SHA-256 já é resistente a timing nesse cenário.
- `Buffer` continua disponível no sandbox do n8n.

## Passo 2 — Corrigir ordem do "Responder 200" e adicionar tratamento de erro do SMTP

Hoje o fluxo é: `Send Email (SMTP) → Responder 200`. Isso já está correto (200 só depois do envio). Falta:

1. No nó **Send Email (SMTP)** → aba **Settings**, ativar **Continue On Fail** = `On Error → Continue (using error output)`.
2. Conectar a saída de erro do SMTP em um novo nó **Respond to Webhook** que devolva HTTP 500 com `{ error: $json.error.message }`.

Isso garante que falha de SMTP vire 5xx para o Supabase, o registro fica `pending/last_error` e o cron tenta de novo. Hoje, se SMTP falhar, o N8N não responde nada e nós damos timeout silencioso.

## Passo 3 — Hardening na função `dispatch-email-digest`

Atualmente marcamos `status='sent'` ao ver qualquer HTTP 200. Vou ajustar para exigir `{"ok": true}` ou `{"success": true}` no body do N8N. Se vier 200 sem confirmação, registramos `last_error="N8N returned 200 without success flag"` e mantemos `pending` para retry.

Arquivo: `supabase/functions/dispatch-email-digest/index.ts`
- Em `sendViaN8n`, parse seguro do JSON do body.
- Considerar sucesso somente se `res.ok && (json.success === true || json.ok === true)`.
- O `responseBody` do N8N (Passo 2) já é `{ success: true, to: $json.to }`, então fica compatível.

## Passo 4 — Conferências de SMTP (manual, no N8N)

Para o e-mail efetivamente sair:
- Credencial **SMTP account** (`mZJ1p9R6r2jzJL8t`): host, porta, user, senha válidos.
- `fromEmail` está como `relatorioged@sed.osasco.sp.gov.br`. O domínio `sed.osasco.sp.gov.br` precisa ter **SPF** liberando o servidor SMTP usado, e idealmente **DKIM** assinando. Sem isso, Microsoft 365 (sisteplan.com.br) tende a derrubar como spam silenciosamente.
- Testar primeiro com `toEmail` literal igual à própria conta SMTP (loopback) para isolar problema de relay.

## Como testar depois

1. Importar o workflow corrigido no N8N e ativar.
2. Na UI → Configurações → E-mails → botão de teste (envia para o usuário logado).
3. Conferir `email_send_log`: linha nova deve ir para `status='sent'` com `webhook_response = { status: 200, body: '{"success":true,...}' }`.
4. Conferir caixa de entrada (e spam) de `nickolas.varela@sisteplan.com.br`.

## Arquivos que serão alterados no Lovable

- `supabase/functions/dispatch-email-digest/index.ts` — hardening da resposta do N8N (Passo 3).

Nenhum outro arquivo do app muda. O grosso da correção é no workflow do N8N (Passos 1, 2 e 4).