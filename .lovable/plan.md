## Objetivo

Adicionar dois novos fluxos de e-mail reutilizando a infra existente (`email_send_log` + função `dispatch-email-digest` + webhook N8N):

1. **Resumo diário** enviado às **10h** para cada colaborador.
2. **Alerta imediato** quando um relatório (chamado externo) é criado.

## 1. Resumo diário (10h)

Conteúdo por usuário (apenas itens onde ele é responsável):

- **Demandas do dia** — `prazo = hoje` e status ativo
- **Reuniões do dia** — `data_reuniao` entre hoje 00h e 23h59 e status ativo
- **Tarefas em alerta** — qualquer uma destas:
  - `em_teste = true` **e** `data_prevista < hoje` (em teste atrasada)
  - `data_prevista` entre hoje e hoje+3 dias (perto do prazo) e status ativo
- **Relatórios solicitados nas últimas 24h** — chamados externos com `criado_em >= ontem` e status `pendente`/`enviado`

E-mail é enviado **apenas se houver pelo menos um item** (sem spam de e-mail vazio).

### Implementação

- Novo modo `mode: "resumo_diario"` em `supabase/functions/dispatch-email-digest/index.ts`:
  - Itera `profiles` com e-mail válido
  - Para cada um, consulta as 4 listas acima filtrando por `responsavel_id` ou `auth.uid() = ANY(responsaveis_ids)` (ou `equipe_toda` quando aplicável)
  - Monta HTML em 4 seções com contadores, links diretos (`/tarefas?id=...`, `/demandas?id=...`, `/reunioes`, `/atividades`)
  - Insere linha em `email_send_log` com `status='pending'` e envia na mesma execução
- Cron job (via `supabase--insert` em `cron.job`): `0 13 * * *` UTC = **10h BRT**, chama a função com `Authorization: Bearer <service_role>` e `body: {mode:"resumo_diario"}`

## 2. Alerta imediato de novo relatório

Quando um `chamado_externo` é inserido:

- Destinatários: `responsaveis_ids` + `responsavel_id`, OU **todos os colaboradores ativos** se `equipe_toda = true`
- Enfileira notificação in-app (tipo novo `relatorio_novo`) e e-mail imediato (subject `[Novo relatório] <titulo>`)

### Implementação

- Migração SQL:
  - Novo valor no enum `notificacao_tipo`: `'relatorio_novo'`
  - Função `notify_chamado_externo_criado()` (SECURITY DEFINER) acionada por trigger `AFTER INSERT` em `public.chamado_externo`
  - Resolve destinatários conforme regra acima e chama `public.enqueue_notificacao(...)` para cada um
  - Estende `public.enqueue_email_imediato` para reconhecer `'relatorio_novo'` como crítico (envio imediato), OU insere diretamente em `email_send_log`
- O cron já existente de modo `imediato` (a cada 5min) garante despacho rápido; nada a fazer aí

## 3. Reforço no resumo (já coberto)

A seção "Relatórios solicitados nas últimas 24h" do resumo diário já cumpre o reforço pedido.

## 4. WhatsApp (futuro)

Fora do escopo agora. Quando entrar, o caminho será: adicionar canal `whatsapp` em `notificacao_preferencia`, criar tabela/fila análoga a `email_send_log` e dispatcher próprio chamando o webhook N8N do WhatsApp. Apenas registro do plano — sem código nesta entrega.

## Arquivos / mudanças

- `supabase/functions/dispatch-email-digest/index.ts` — novo modo `resumo_diario` + helper de query por usuário
- Migração: enum `relatorio_novo`, trigger `chamado_externo_after_insert_notify`, função `notify_chamado_externo_criado`
- Cron: agendar `resumo-diario-10h` (`0 13 * * *` UTC)

## Validação

- Disparar manualmente `dispatch-email-digest` com `mode:"resumo_diario"` via console gestor (botão de teste) e conferir `email_send_log`
- Criar um chamado externo de teste e conferir nova linha pendente em `email_send_log` + notificação in-app