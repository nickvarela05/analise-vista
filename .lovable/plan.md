# Plano: Notificações por e-mail via N8N + Fase 3 IA

Vamos rodar dois trilhos em paralelo. Você não precisa esperar o TI da prefeitura — o N8N cuida do envio com a infraestrutura que você já tem.

---

## 🔌 Trilho A — Disparo de e-mail via N8N

### Como vai funcionar

```
Sistema → Cron 8h da manhã → Edge Function "dispatch-email-digest"
                                    ↓
                     Lê notificações pendentes não enviadas
                                    ↓
                     Agrupa por destinatário (1 e-mail por pessoa, não 1 por notificação)
                                    ↓
                     POST → Webhook N8N (com HMAC pra segurança)
                                    ↓
                     N8N envia o e-mail (Gmail, SMTP, SendGrid, o que você tiver lá)
                                    ↓
                     Marca no email_send_log: enviado / falhou
```

**Vantagem:** o N8N usa o que já estiver configurado nele (provavelmente já tem credencial SMTP ou Gmail conectada). Não precisa de domínio próprio, NS, nem aprovação de TI.

**Alertas críticos** (urgente, SLA estourado, aviso crítico) saem **na hora**, não esperam o digest das 8h.

### O que vou fazer

1. **Tabela `email_send_log`** — auditoria de envios (status, tentativas, erros, payload)
2. **Edge Function `dispatch-email-digest`** — lê pendentes, monta payload HTML, dispara webhook
3. **Pg_cron diário (8h)** — chama o digest
4. **Trigger imediato** — para tipos críticos (`demanda_urgente`, `chamado_sla`, `aviso_critico`), envia na hora
5. **Secret `N8N_EMAIL_WEBHOOK_URL`** + **`N8N_EMAIL_HMAC_SECRET`** — você cola a URL do webhook do N8N e um segredo qualquer (eu te ajudo a gerar)
6. **Página `/configuracoes/emails`** (só gestor) — vê histórico de envios, falhas, reenvio manual

### Do seu lado (5 min no N8N)

1. Criar workflow novo no N8N: **Webhook (POST) → Verify HMAC → Send Email**
2. Configurar o nó "Send Email" com a credencial SMTP/Gmail que você já tem
3. Me passar a URL do webhook (`https://seu-n8n.com/webhook/email-digest`)
4. Eu te dou o template do workflow pronto pra importar

---

## 🤖 Trilho B — Fase 3 IA (em paralelo)

### Funcionalidade 1: Resumo semanal automático

**Toda segunda-feira às 7h**, cada gestor recebe (in-app + futuramente e-mail) um resumo da semana anterior:

- Tarefas concluídas vs criadas
- Demandas em atraso
- Chamados externos com SLA estourado
- Top 3 colaboradores com mais entregas
- Insights da IA: "Demandas urgentes aumentaram 30%", "Carlos tem 8 tarefas em atraso", etc.

Implementação:
- Edge function `gerar-resumo-semanal` chama Lovable AI Gateway (`google/gemini-2.5-flash`)
- Pg_cron toda segunda 7h
- Resultado salvo em nova tabela `resumo_semanal` + notificação in-app com link

### Funcionalidade 2: Busca em linguagem natural

Barra de busca global (Cmd+K ou ícone no header) onde o usuário digita:

- *"demandas urgentes do Carlos esse mês"*
- *"chamados externos abertos há mais de 7 dias"*
- *"tarefas atrasadas da equipe pedagógica"*

A IA traduz pra query SQL segura (com guardrails — só SELECT, só tabelas permitidas, escopo do usuário) e mostra resultados clicáveis.

Implementação:
- Edge function `busca-natural` recebe pergunta
- Lovable AI gera SQL parametrizado
- Validação rígida: bloqueia INSERT/UPDATE/DELETE/DROP, limita a tabelas allowlisted
- Executa via Supabase com role do usuário (RLS aplica)
- Componente `<BuscaGlobalIA />` no header

---

## 🔒 Segurança (mantendo prioridade Robustez)

- HMAC SHA-256 no webhook N8N (impede chamadas falsas)
- `email_send_log` com RLS (só gestor lê)
- Edge functions com `verify_jwt = true` exceto o cron (que usa service_role)
- Busca natural: SQL gerado pela IA passa por **whitelist de tabelas** + **parser** que rejeita qualquer coisa fora de SELECT
- Rate-limit no endpoint de busca (10 req/min por usuário)

---

## ⏱️ Ordem de execução

1. ✅ Migração: `email_send_log` + `resumo_semanal` + RLS
2. ✅ Edge function `dispatch-email-digest` + secrets
3. ✅ Edge function `gerar-resumo-semanal` + cron
4. ✅ Edge function `busca-natural` + componente UI
5. ✅ Página `/configuracoes/emails` (histórico de envios)
6. 🟡 Você configura o workflow no N8N e me passa a URL → eu cadastro o secret

Enquanto você ainda não cadastrou o webhook N8N, os e-mails ficam **enfileirados** em `email_send_log` com status `pending`. Quando o secret entrar, o próximo cron processa tudo de uma vez. Nada se perde.

---

## ❓ Confirma pra eu começar?

Só me diga se posso seguir. Vou começar pela migração + edge functions (não preciso da URL do N8N agora — você me passa quando criar o workflow lá).