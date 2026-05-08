## Objetivo
Implementar 12 novos dashboards analíticos e redesenhar a página `/` (Painel gerencial) com hierarquia visual clara, agrupamento por contexto e tooltips de ajuda (ícone `i`) em cada indicador.

## Os 12 dashboards

| # | Nome | Fonte de dados | Visualização | O que responde |
|---|------|----------------|--------------|----------------|
| 1 | **Velocity semanal** | `todo` (status concluída/produção por semana, últimas 8 semanas) | Bar chart | Quantas tarefas a equipe entrega por semana? |
| 2 | **Lead time / Cycle time** | `todo` (created_at → concluida_em / data_prevista) | KPI duplo + sparkline | Quanto tempo, em média, uma tarefa leva do início ao fim? |
| 3 | **Throughput por colaborador** | `todo` (concluídas últimos 30d agrupado por responsável) | Bar horizontal | Quem entrega mais nos últimos 30 dias? |
| 4 | **Aging do backlog** | `todo` (ativas, idade = hoje − created_at, em buckets 0-3 / 4-7 / 8-15 / 16-30 / 30+ dias) | Stacked bar | Há tarefas paradas há muito tempo? |
| 5 | **Mapa de calor de prazos** | `todo` + `demanda` + `reuniao` (próximos 28 dias por dia) | Heatmap (grid 7x4) | Onde está concentrada a carga das próximas semanas? |
| 6 | **WIP por colaborador** | `todo` (status em_andamento + homologacao por responsável) | Bar horizontal + linha de "limite saudável" (5) | Quem está sobrecarregado agora? |
| 7 | **Taxa de reprovação em homologação** | `todo` (reprovada / (reprovada + aprovada) últimos 60d) | KPI grande + donut | Qualidade do que vai pra homologação |
| 8 | **Tempo médio por etapa** | `todo` (delta entre status — usando `updated_at` aproximado por agora) | Funnel/Bar | Onde as tarefas ficam mais tempo? |
| 9 | **Distribuição por categoria/origem** | `demanda` (categoria, origem) | Donut duplo | De onde vêm as demandas? |
| 10 | **Funil de relatórios (N8N)** | `solicitacoes_relatorios` (Pendente → Feito → Enviado) | Funnel | Acompanhamento ponta-a-ponta |
| 11 | **SLA por urgência** | `solicitacoes_relatorios` (urgência × tempo desde criado_em) | Bar agrupado | Estamos cumprindo prazo das urgentes? |
| 12 | **Top solicitantes** | `solicitacoes_relatorios` (ranking por solicitante_nome últimos 90d) | Bar horizontal Top 8 | Quem mais demanda relatórios? |

## Componentização

Para manter o `index.tsx` limpo, cada dashboard vira um componente isolado:

```
src/components/dashboard/analytics/
  ├─ VelocitySemanalCard.tsx        (#1)
  ├─ LeadTimeCard.tsx               (#2)
  ├─ ThroughputCard.tsx             (#3)
  ├─ AgingBacklogCard.tsx           (#4)
  ├─ HeatmapPrazosCard.tsx          (#5)
  ├─ WipColaboradorCard.tsx         (#6)
  ├─ TaxaReprovacaoCard.tsx         (#7)
  ├─ TempoPorEtapaCard.tsx          (#8)
  ├─ CategoriaOrigemCard.tsx        (#9)
  ├─ FunilRelatoriosCard.tsx        (#10)
  ├─ SlaUrgenciaCard.tsx            (#11)
  └─ TopSolicitantesCard.tsx        (#12)
```

Cada card recebe os arrays já carregados pelo `useDashboardData` (zero novas queries — performance preservada). Toda lógica de cálculo fica em `src/components/dashboard/analytics/lib/metrics.ts` para ser testável.

## Componentes de UX comuns

**`InfoHint`** — botão `(i)` com tooltip explicativo (usa `Tooltip` do shadcn já instalado). Aparece no header de cada Panel ao lado do título.

```tsx
<Panel
  title="Velocity semanal"
  hint="Quantas tarefas a equipe concluiu nas últimas 8 semanas. Tendência ascendente = aceleração."
  ...
/>
```

→ ajuste mínimo no `Panel` (em `KpiTile.tsx`) para aceitar a prop `hint` e renderizar o ícone `Info` da Lucide com tooltip on hover/focus (acessível por teclado).

**`SectionHeader`** — divisor de seções com título e descrição curta.

## Novo layout do dashboard (redesenho)

Seções coesas, da mais ampla (visão geral) à mais profunda (análise):

```
┌─────────────────────────────────────────────────────────────────┐
│ PageHeader + AvisosBanner                                       │
├─────────────────────────────────────────────────────────────────┤
│ 🟦 VISÃO GERAL                                                   │
│ [ KPI ] [ KPI ] [ KPI ] [ KPI ] [ KPI ]   (5 tiles atuais)      │
├─────────────────────────────────────────────────────────────────┤
│ 🟦 MEU TRABALHO                                                  │
│ [ Minhas atribuições — full width ]                             │
├─────────────────────────────────────────────────────────────────┤
│ 🟦 PRODUTIVIDADE                                                 │
│ [ #1 Velocity 8sem ][ #2 Lead time ][ #3 Throughput 30d ]       │
├─────────────────────────────────────────────────────────────────┤
│ 🟦 SAÚDE DO BACKLOG                                              │
│ [ #4 Aging — 2 cols ][ #6 WIP — 1 col ]                         │
│ [ #5 Heatmap próximos 28d — full width ]                        │
├─────────────────────────────────────────────────────────────────┤
│ 🟦 QUALIDADE & FLUXO                                             │
│ [ #7 Taxa reprovação ][ #8 Tempo por etapa ][ #9 Cat./Origem ]  │
├─────────────────────────────────────────────────────────────────┤
│ 🟦 RELATÓRIOS (N8N)                                              │
│ [ #10 Funil ][ #11 SLA urgência ][ #12 Top solicitantes ]       │
├─────────────────────────────────────────────────────────────────┤
│ 🟦 EQUIPE & AGENDA                                               │
│ [ Atividades semana — 2 cols ][ Equipe ativa — 1 col ]          │
│ [ Atribuições por colab. — 2 cols ][ Status tarefas — 1 col ]   │
│ [ Horários — full width ]                                       │
└─────────────────────────────────────────────────────────────────┘
```

Princípios aplicados:
- **Agrupamento por intenção** (não por tipo de gráfico)
- **F-pattern**: KPIs no topo, drill-down conforme desce
- **Densidade controlada**: máx. 3 cards por linha em desktop, 1 no mobile
- **Tooltips `(i)`** em todo card analítico explicando fórmula e período
- **Estado vazio amigável** em cada card (mensagem + dica de ação)
- **Skeleton states** durante loading (já existem `loading.*` no hook)

## Mudanças de arquivos

**Novos**
- `src/components/dashboard/analytics/lib/metrics.ts` (funções puras de cálculo + testes)
- 12 cards listados acima
- `src/components/dashboard/SectionHeader.tsx`

**Editados**
- `src/components/KpiTile.tsx` → `Panel` ganha prop opcional `hint?: string` que renderiza `<InfoHint>`
- `src/routes/index.tsx` → reorganizado em seções; importa os 12 novos cards
- `src/components/dashboard/DashboardCharts.tsx` → adicionar `hint` aos panels existentes

**Não alterados**
- Schema do banco (tudo é derivado dos dados já carregados)
- `useDashboardData.ts` (todas as queries necessárias já existem)

## Testes
- Adicionar `src/components/dashboard/analytics/lib/__tests__/metrics.test.ts` cobrindo os cálculos críticos: lead time, aging buckets, velocity por semana, taxa de reprovação, SLA por urgência.

## Detalhes técnicos
- Recharts já está instalado — usar `BarChart`, `LineChart`, `PieChart`, `FunnelChart` (precisa importar de `recharts`).
- Heatmap (#5) feito com grid CSS puro (sem dependência nova) — cores via `color-mix` do token `--primary`.
- Datas: usar `date-fns` (já instalado) — `startOfWeek`, `differenceInDays`, `eachDayOfInterval`.
- Tipo de "tempo por etapa" (#8): sem coluna de transição histórica, usar aproximação por `updated_at − created_at` agrupado por status atual; deixar nota no `hint` explicando.

## Riscos / observações
- **#8 Tempo por etapa** é aproximado (não há tabela de eventos). Se quiser precisão real, criar tabela `todo_status_log` em migração futura — fora deste escopo.
- N8N (#10–#12) depende de `solicitacoes_relatorios` estar acessível; reaproveita query já existente.

## Ordem de execução
1. Criar `metrics.ts` + testes
2. Atualizar `Panel` com prop `hint` + componente `InfoHint`
3. Criar os 12 cards em paralelo (componentes pequenos e isolados)
4. Reorganizar `index.tsx` com a nova grade
5. QA visual no preview (responsivo desktop/tablet/mobile)
