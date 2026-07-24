
# Plano em 2 fases (5 créditos/dia)

Objetivo: entregar (1) tela de **Calendário Anual de Processos** com previsto x real, atribuições, vínculos e alertas; (2) ajustar filtro do **resumo diário** para tarefas em teste e investigar falhas de disparo.

---

## Fase 1 — HOJE (foco: base de dados + tela funcional)

Prioridade: ter a tela usável, salvando dados, sem quebrar orçamento.

### 1.1 Banco (1 migração única)
Tabela `public.processo_anual`:
- `ano` (int), `nome`, `descricao`, `cor` (para o calendário)
- `previsto_inicio`, `previsto_fim` (date, nullable)
- `real_inicio`, `real_fim` (date, nullable)
- `responsaveis_ids` (uuid[]), `equipe_toda` (bool)
- `status` (enum: `planejado`, `em_andamento`, `concluido`, `atrasado`)
- `alerta_dias_antes` (int, default 14)
- `criado_por`, timestamps

Tabela de vínculo `public.processo_anual_vinculo`:
- `processo_id`, `tipo` (`tarefa`|`demanda`), `ref_id`

GRANTs + RLS (leitura autenticada, escrita gestor/admin), trigger `updated_at`.

### 1.2 Rota + tela
`src/routes/processos.tsx` com:
- `PageHero` no padrão do sistema, tone `indigo`
- **Visão calendário anual**: grid de 12 meses (linhas = processos, colunas = semanas/dias) — timeline horizontal tipo Gantt anual leve. Barras: previsto (contorno) x real (preenchido) sobrepostas.
- **Visão lista**: cards colapsáveis por processo com status, responsáveis, badges de vínculos.
- Toggle entre visões (Tabs).
- Filtro por ano (seletor), status, responsável.

### 1.3 Dialog de processo (`ProcessoDialog.tsx`)
Campos: nome, descrição, cor, previsto/real (2 range pickers), `AssigneeCombobox`, `alerta_dias_antes`, vínculos (multiselect de tarefas/demandas — reutiliza dados já carregados no app).

### 1.4 Sidebar/nav
Item "Processos" em `AppSidebar.tsx`.

**Créditos estimados fase 1: ~3–4** (1 migração + 4 arquivos novos + 1 edit no sidebar).

---

## Fase 2 — AMANHÃ (alertas + resumo diário + investigação)

### 2.1 Alertas de aproximação (in-app + e-mail)
Função SQL `notify_processo_proximo()` agendada via `pg_cron` diária (07:00):
- Para cada processo cujo `previsto_inicio - alerta_dias_antes <= hoje < previsto_inicio` e não concluído → `enqueue_notificacao` para responsáveis (ou equipe toda), tipo `aviso_critico` se ≤3 dias, senão `sistema`.
- Também insere linha no `email_send_log` (aproveitando fluxo do resumo diário) marcando prioridade.

### 2.2 Resumo diário — filtro de tarefas em teste
Ajuste na edge function `dispatch-email-digest`:
- Seção "Em teste" só inclui `todo` onde `status = 'homologacao' AND em_teste = true`.
- Adicionar seção "Processos próximos" (próx. 14 dias) no template do resumo.

### 2.3 Investigação de e-mails que não chegam
Checagens dentro do mesmo turno:
- Consultar `email_send_log` últimas 30 execuções: status `sent` mas sem `provider_id`? attempts > 1?
- Verificar `suppressed_emails` do n8n webhook.
- Confirmar HMAC + retries no `N8N_EMAIL_WEBHOOK_URL`.
- Provável causa (hipótese): resposta 2xx do n8n mas erro downstream sem retry. Fix: registrar `message_id` retornado pelo n8n e implementar retry em `dispatch-email-digest` quando ausente.

**Créditos estimados fase 2: ~3–4** (1 migração cron + edit edge function + investigação/patch).

---

## Detalhes técnicos (para referência)

```text
processos.tsx
 ├─ PageHero (ícone Calendar, tone indigo, stats: total, em_andamento, atrasados, próximos)
 ├─ Tabs [Calendário | Lista]
 │   ├─ CalendarioAnual (SVG/grid: 12 colunas mês, linhas processos, barras previsto vs real)
 │   └─ ProcessosLista (cards com progresso, responsáveis, vínculos)
 └─ ProcessoDialog (create/edit)
```

Padrões respeitados: `AssigneeCombobox`, `DialogSection`, `StatPill`, tokens semânticos, sem cores hardcoded, schemas Zod em `src/lib/schemas/processo.ts`.

---

## Ordem de execução
1. Aprovação do plano → começo pela fase 1 já no próximo turno.
2. Amanhã, você me pede "fase 2" e sigo com alertas/resumo/investigação.

Confirma?
