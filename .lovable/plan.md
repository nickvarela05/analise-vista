# Plano de evolução do sistema

Foco principal: **robustez e segurança**, seguido de **IA aplicada**, **notificações automáticas**, **filtros globais no dashboard** e **performance**. WhatsApp fica para uma fase posterior — entrego in-app + e-mail, e a arquitetura já fica pronta para plugar Twilio/WhatsApp depois sem refatorar.

A entrega é dividida em **5 fases independentes**. Cada fase é incremental e pode ser pausada/aprovada separadamente.

---

## Fase 1 — Robustez e segurança (base de tudo)

Antes de adicionar features novas, fechar lacunas que vi auditando o schema:

1. **Tabela de auditoria** (`audit_log`) — quem alterou o quê, quando, valor antigo/novo. Hoje só `todo_historico` registra mudanças; demandas, reuniões, chamados externos e colaboradores não têm rastro.
2. **Revisão de RLS** — algumas policies usam `USING (true)` para SELECT (ex.: `colaborador_evento`, `colaborador_ferias`, `aviso_gestor`). Para dados sensíveis de RH (férias, eventos) restringir a gestor + o próprio colaborador.
3. **Política de UPDATE em `chamado_externo`** — hoje qualquer autenticado atualiza qualquer chamado. Restringir a responsável + gestor.
4. **Trigger `updated_at`** — várias tabelas têm a coluna mas não o trigger ativo. Padronizar usando `update_updated_at_column()` que já existe.
5. **Rodar o linter de segurança do Supabase** e corrigir tudo que aparecer como `error`.

---

## Fase 2 — Notificações (in-app + e-mail)

### Modelo de dados
- Tabela `notificacao` (id, user_id, tipo, titulo, mensagem, link, lida_em, created_at).
- Tabela `notificacao_preferencia` (user_id, canal `in_app|email`, evento, ativo) — cada usuário escolhe o que quer receber.

### Eventos cobertos
- **Para o colaborador**: tarefa atribuída a ele, prazo em 24h, comentário em tarefa sua, status mudou.
- **Para gestores**: SLA de chamado externo estourado, reprovação em homologação, novo aviso crítico, demanda urgente sem responsável há >24h.

### Entrega
- **In-app**: sino no header com badge de contagem + dropdown com últimas 10. Realtime via Supabase (`postgres_changes` na tabela `notificacao`).
- **E-mail**: usar Lovable Emails (built-in, zero config). Resumo diário às 8h com pendências do dia + alertas críticos imediatos.
- **Arquitetura preparada para WhatsApp**: a função `enqueueNotification(userId, evento, payload)` despacha por canal. Adicionar WhatsApp depois é só implementar mais um adapter.

### Cron
- Job `pg_cron` a cada 15min varre prazos vencendo, SLA, etc., e insere em `notificacao`.
- Job diário 8h dispara o digest por e-mail.

---

## Fase 3 — IA aplicada

### 3.1 Resumo semanal automático
- Toda segunda às 7h, edge function/server function coleta dados da semana anterior (tarefas concluídas, demandas abertas/fechadas, reuniões, top performers, gargalos).
- Envia para Lovable AI (`google/gemini-3-flash-preview`) com prompt estruturado.
- Salva em nova tabela `resumo_semanal` e exibe um **card "Resumo da semana"** no topo do dashboard, com botão "ver completo" abrindo modal.
- Gestores recebem por e-mail também.

### 3.2 Busca em linguagem natural
- Barra de busca no header (atalho **Cmd/Ctrl+K**).
- Usuário digita: *"tarefas atrasadas do João nos últimos 30 dias"*, *"demandas urgentes sem responsável"*, *"reuniões da semana sobre orçamento"*.
- Server function envia para Lovable AI usando **structured output** (`Output.object` do Vercel AI SDK) — IA retorna um JSON com filtros tipados (entidade, responsável, status, período, palavras-chave).
- App executa a query no Supabase com esses filtros e mostra resultados agrupados (tarefas / demandas / reuniões / chamados).
- Sem alucinação: a IA só decide *como filtrar*, não inventa dados.

---

## Fase 4 — Filtros globais no dashboard

Hoje os 10+ indicadores são fixos. Adicionar:
- **Seletor de período** no topo: 7d / 30d / 90d / customizado.
- **Filtro por colaborador** (multi-select) para gestores verem o painel de uma pessoa específica.
- **Filtro por categoria/origem** das demandas.
- Estado dos filtros persistido em URL (query params) — links compartilháveis.
- Cada card respeita os filtros via context React + recálculo memoizado.

---

## Fase 5 — Performance

- Migrar `useDashboardData` para **React Query** com queries separadas e paralelas (hoje busca tudo em sequência num único hook).
- `staleTime` de 30s + `refetchOnWindowFocus`.
- Mover cálculos pesados dos cards analíticos para `useMemo` por card (hoje recalcula tudo a cada render do dashboard).
- Lazy-load das seções abaixo do fold (intersection observer).
- Skeleton loaders por card em vez de um único spinner global.

---

## O que NÃO está neste plano (pode entrar depois)

- WhatsApp (Twilio) — adiado a pedido. Arquitetura de notificações já fica pronta.
- Transcrição automática de reuniões — útil mas escopo grande, melhor isolar.
- Sugestão de prioridade ao criar tarefa — pode entrar como Fase 6.
- App mobile dedicado.

---

## Detalhes técnicos (referência)

- Notificações realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacao` + canal client-side.
- Server functions em `src/lib/*.functions.ts` (createServerFn) com `requireSupabaseAuth`.
- IA via `createLovableAiGatewayProvider` + Vercel AI SDK, em server route `/api/ai/*`.
- Cron via `pg_cron` + `pg_net` chamando rotas `/api/public/hooks/*` autenticadas com `apikey` header.
- E-mail via Lovable Emails (sem necessidade de configurar Resend manualmente).
- Migrations separadas por fase para permitir rollback.

---

## Ordem sugerida e tempo estimado

| Fase | Conteúdo | Por que nessa ordem |
|------|----------|---------------------|
| 1 | Auditoria + RLS + linter | Base de segurança antes de novos dados |
| 2 | Notificações in-app + e-mail | Maior valor percebido, infra reaproveitada por IA |
| 3 | IA: resumo semanal + busca natural | Diferencial competitivo |
| 4 | Filtros globais | UX, mas requer dados/contexto das fases anteriores |
| 5 | Performance + React Query | Otimização final, com tudo já implementado |

Posso começar pela Fase 1 assim que você aprovar — ou, se preferir começar por outra fase (ex.: já ir direto para notificações ou IA), me avise.