# Plano: Fluxo N8N pronto + Finalizar Fase 3 (UI)

Dois entregáveis em paralelo: (A) workflow N8N completo pra você importar, (B) interface visual da Fase 3.

---

## 🔌 PARTE A — Fluxo N8N "pronto pra importar"

Vou gerar um arquivo `n8n-workflow-email.json` que você baixa e importa no N8N em 30 segundos. O fluxo terá **5 nós**:

```
[1. Webhook] → [2. Validar HMAC] → [3. IF assinatura ok?]
                                       ├─ true  → [4. Send Email (SMTP)] → [5. Response 200]
                                       └─ false → [5. Response 401]
```

### Detalhes técnicos de cada nó

**1. Webhook (POST)**
- Path: `/email-digest`
- Authentication: None (a segurança é via HMAC)
- Response Mode: "Response Node" (responde no nó 5, não imediato)

**2. Code node — Validar HMAC**
- JavaScript que recalcula HMAC-SHA256 do body recebido com o secret
- Compara em tempo constante com o header `X-Signature`
- Output: `{ valid: true/false, payload: {...} }`

**3. IF node**
- Checa `{{ $json.valid }} === true`

**4. Send Email node**
- Tipo: SMTP (compatível com Gmail, Outlook, qualquer servidor)
- From: configurável (vai sair do gestor)
- To: `{{ $json.payload.to }}`
- Subject: `{{ $json.payload.subject }}`
- HTML: `{{ $json.payload.html }}`
- Text: `{{ $json.payload.text }}`

**5. Respond to Webhook**
- 200 + `{success: true}` no caminho válido
- 401 + `{error: "Invalid signature"}` no caminho inválido

### Guia de setup (vou escrever junto)

Markdown passo a passo:
1. Como importar o JSON no N8N
2. Como configurar a credencial SMTP (3 opções: Gmail App Password, Outlook, SMTP corporativo)
3. Como pegar a URL do webhook depois de "Activate"
4. Como gerar um HMAC secret forte (`openssl rand -hex 32` ou eu gero pra você)
5. Como cadastrar os 2 secrets no Lovable
6. Teste end-to-end (eu disparo um e-mail de teste pelo botão "Testar envio" na página de e-mails)

### Arquivos que vou criar

- `/mnt/documents/n8n-workflow-email.json` — workflow pronto pra importar
- `/mnt/documents/n8n-setup-guide.md` — guia passo a passo
- Disponíveis no chat como artefatos pra download

---

## 🎨 PARTE B — UI da Fase 3 (em paralelo)

### B1. Componente `<BuscaGlobalIA />` no header

- Botão de busca no header (ícone 🔍 + atalho Ctrl/Cmd+K)
- Dialog modal com input grande tipo command palette
- Exemplos clicáveis: *"minhas demandas urgentes"*, *"chamados com SLA estourado"*, *"tarefas atrasadas esta semana"*
- Loading state, exibe SQL gerado (recolhível, pra transparência), tabela de resultados clicáveis
- Erro tratado: rate-limit, query inválida, timeout
- Disponível pra todos os usuários autenticados

### B2. Página `/resumo-semanal`

- Lista os resumos semanais do usuário (do mais recente pro mais antigo)
- Card com:
  - Período (ex.: "07 a 13 de Maio")
  - Métricas em destaque (cards: tarefas, demandas, chamados)
  - Conteúdo markdown renderizado
  - Lista de insights (bullets)
- Botão "Gerar agora" pra forçar atualização (gestor)
- Link na sidebar e no menu de notificações

### B3. Página `/configuracoes/emails` (só gestor)

Adicionar nova aba "E-mails" em Configurações:
- **Status do webhook:** verde (configurado) / amarelo (faltam secrets) / vermelho (último envio falhou)
- **Histórico:** tabela com filtros (status, destinatário, data) — última coluna mostra erro se falhou
- **Stats:** enviados últimos 7 dias, taxa de sucesso, fila pendente
- **Botão "Testar envio"** — dispara um e-mail de teste pra você confirmar o setup do N8N
- **Botão "Reprocessar falhados"** — reseta `attempts=0` e marca como pending pros que falharam por erro temporário

### B4. Sininho de notificação — adicionar tipo `resumo_semanal`

Atualizar `NotificationBell` pra reconhecer o novo tipo com ícone 📊 e cor.

---

## 🔒 Segurança (mantida)

- Página `/configuracoes/emails` protegida por role gestor
- Botão "Testar envio" envia só pro próprio e-mail do gestor logado (evita spam)
- Botão "Reprocessar" tem confirm dialog
- HMAC secret nunca aparece no front

---

## ⏱️ Ordem de execução

1. Gerar `n8n-workflow-email.json` + guia (artefatos pra download)
2. Criar componente `BuscaGlobalIA` + integrar no header
3. Criar página `/resumo-semanal` + rota
4. Criar página `/configuracoes/emails` (aba) + endpoint de teste
5. Atualizar sininho com tipo `resumo_semanal`
6. Você importa no N8N → me passa a URL → eu peço secrets → testamos

---

## ❓ Antes de começar, 1 pergunta pequena

Pra eu personalizar o "From" do e-mail no fluxo N8N, qual e-mail de origem você vai usar? (ex.: `seugestor@gmail.com` se for Gmail App Password, ou `noreply@suaempresa.com` se for SMTP corporativo). Se ainda não decidiu, deixo `notifications@example.com` como placeholder e você ajusta no N8N depois.