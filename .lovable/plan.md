## Objetivo
Conectar o sistema ao webhook do N8N e validar o envio de e-mails end-to-end.

## Dados recebidos
- **Production URL:** `https://n8n.srv1186169.hstgr.cloud/webhook/email-digest`
- **HMAC Secret:** `32bc0de44c1484946ff735afa634e35346895831506b435bd4191a544ca96b6f` (mesmo valor que você configurou em `N8N_HMAC_SECRET` no container do n8n)

## Pré-requisito (do seu lado)
Confirmar que no servidor Hostinger do n8n:
1. A env var `N8N_HMAC_SECRET` foi adicionada com o valor acima
2. O container do n8n foi **reiniciado** (`docker restart n8n` ou equivalente) — env vars novas só sobem após restart
3. No nó **Webhook**, a opção **Raw Body** está ativada (Options → Raw Body: ON)

Se algum desses 3 não estiver feito, o teste vai falhar com 401 ou erro de "secret não configurado".

## Etapas que vou executar

### 1. Cadastrar 2 secrets no Lovable Cloud
- `N8N_EMAIL_WEBHOOK_URL` = `https://n8n.srv1186169.hstgr.cloud/webhook/email-digest`
- `N8N_EMAIL_HMAC_SECRET` = `32bc0de44c1484946ff735afa634e35346895831506b435bd4191a544ca96b6f`

Esses secrets ficam disponíveis como `Deno.env.get(...)` na edge function `dispatch-email-digest`.

### 2. Disparar uma chamada de teste pra `dispatch-email-digest`
Vou invocar a edge function manualmente com `mode: "imediato"` pra ver:
- Se ela consegue ler os secrets
- Se a chamada HTTP pro seu n8n responde 200
- Se algum e-mail pendente é processado

### 3. Verificar logs e resultado
- Logs da edge function (procurando por sucesso/erro de HTTP)
- Tabela `email_send_log` (status: `pending` → `sent` ou `failed`)
- Caso falhe: te mostro o erro exato (HMAC inválido, timeout, conexão recusada, etc.)

### 4. Teste end-to-end pela UI
Você abre `/configuracoes` → aba **E-mails** → clica em **"Testar envio para mim"**. Se o e-mail chegar na sua caixa, o setup tá 100%.

## O que acontece automaticamente depois
Com os secrets cadastrados, o sistema passa a operar sozinho:
- **A cada 5 min** (cron `pg_cron`) → processa e-mails urgentes da fila (`demanda_urgente`, `chamado_sla`, `aviso_critico`)
- **Todo dia às 8h** → consolida notificações das últimas 24h em 1 digest por usuário e dispara

## Riscos e mitigações
| Risco | Sinal | Como recupero |
|---|---|---|
| HMAC errado nos 2 lados | n8n responde 401 | Você confirma a env var; reinicio teste |
| Raw Body não ativo no n8n | n8n responde 401 mesmo com secret igual | Te aviso pra ativar Options → Raw Body |
| URL errada/inacessível | Timeout ou DNS error nos logs | Você reativa o workflow / verifica firewall |
| Edge function não acha secret | Log: "N8N_EMAIL_WEBHOOK_URL não configurado" | Re-cadastro secret e refaço deploy |

## Critério de sucesso
- Botão "Testar envio" entrega e-mail na sua caixa em <2 min
- `email_send_log.status` = `sent` pro registro de teste
- Nenhum erro nos logs da edge function
