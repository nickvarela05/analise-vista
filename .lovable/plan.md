
## Parte 1 — Redesenho da tela de Processos

Objetivo: tornar o calendário anual a peça central da tela, com leitura imediata de "onde estamos no ano", "o que vem", "o que atrasou" e comparação previsto x real sem depender de tooltip.

### 1.1 Novo layout da rota `/processos`

```text
┌─────────────────────────────────────────────────────────────────────┐
│ PageHero — Processos 2026                                           │
│  [KPI] Em andamento 3 · Próximos 30d 2 · Atrasados 1 · Concluídos 5│
│  [◀ 2025]  [2026 ▼]  [2027 ▶]     [Ver: Timeline | Grade | Lista] │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ FAIXA "AGORA" (sticky no topo do calendário)                        │
│  ● Em curso agora: Vestibular (dia 14/62)   ▓▓▓▓▓░░░░░ 23%          │
│  ● Próximo em 12 dias: Matrículas          [ver detalhes]           │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ TIMELINE ANUAL (view padrão)                                        │
│         J  F  M  A  M  J  J  A  S  O  N  D                          │
│  Trilha por processo (1 linha = 1 processo, agrupada por status):   │
│                                                                     │
│  Vestibular      ░░░▓▓▓▓▓▓░░░░ ← barra dupla previsto/real sobreposta│
│                     └ 12/03 → 05/04 · previsto                     │
│                     ▓ 15/03 → 08/04 · real (+3d atraso)            │
│  Matrículas         ░░░░░▓▓▓░░░                                    │
│  Rematrícula                       ░░▓▓▓▓                          │
│                                                                     │
│  ↑ linha vertical "hoje" atravessando toda a grade                  │
└─────────────────────────────────────────────────────────────────────┘
```

Mudanças-chave em relação ao atual:

- **Uma linha por processo** (em vez de trilha dupla empilhada). Previsto e real ficam na mesma linha, sobrepostos: previsto como faixa tracejada de fundo, real como barra sólida colorida por cima. É o padrão usado em Notion/Linear e resolve o "empilhamento" que ainda confunde.
- **Linha vertical "Hoje"** cruzando toda a grade, com data flutuante — dá referência temporal sem precisar contar meses.
- **Faixa "Agora"** sticky no topo mostrando o processo em curso com % de progresso e o próximo com contagem regressiva. Elimina a necessidade de "caçar" no calendário.
- **KPIs no hero** (Em andamento / Próximos 30d / Atrasados / Concluídos) — hoje esses números só aparecem contando manualmente na lista.
- **Seletor de ano** com navegação ◀ ▶ e dropdown; hoje o filtro de ano está no meio da tela.
- **3 views**: Timeline (novo padrão), Grade (o atual mensal 12 colunas — mantido para quem prefere), Lista (cards atuais).
- **Cor da barra** = cor do processo; **hachura diagonal** indica trecho atrasado (dias reais além do previsto). Legenda pequena no rodapé.
- **Hover em qualquer barra** mostra card lateral fixo (não tooltip flutuante) com previsto, real, desvio, responsáveis, vínculos e ações rápidas (editar, marcar concluído).

### 1.2 Melhorias de fluxo

- **Duplicar processo do ano anterior**: botão "Copiar de 2025" no seletor de ano — cria os processos do ano novo com previsto = datas do ano anterior, real vazio. Resolve o padrão "todo ano são os mesmos processos".
- **Ação inline "Confirmar datas reais"** na faixa Agora quando o processo entra em curso — abre só os 2 campos (real_inicio/real_fim), sem abrir o dialog inteiro.
- **Filtro rápido por responsável** no header (chip com foto) — reaproveita `AssigneeCombobox`.

### 1.3 Escopo do que muda em código

- `src/routes/processos.tsx`: reescrever `CalendarioAnual` para o modelo de trilha única com sobreposição previsto/real, adicionar linha "Hoje", faixa "Agora", KPIs no hero, seletor de ano e ação "Copiar de <ano-1>".
- Extrair `ProcessoTimeline`, `ProcessoAgora` e `ProcessoKpis` para arquivos próprios em `src/components/processos/` — o arquivo atual tem 1525 linhas e concentra tudo (ver auditoria abaixo).

Nada de mudança de schema.

---

## Parte 2 — Auditoria e quick wins

Varredura já feita nas 3 dimensões que você marcou. Só entram na execução desta rodada os itens **[Quick win]**; o restante fica listado como roadmap para você priorizar depois.

### 2.1 Performance / queries

**[Quick win] Refetch global de 60s é agressivo demais.** `src/router.tsx` define `refetchInterval: 60_000` para *todas* as queries. Isso faz o dashboard, atividades, tarefas e processos re-buscarem tudo a cada minuto — foi o que causou o bug do form de processos limpar sozinho e é custo desnecessário no Supabase. Trocar por:
- default sem `refetchInterval`
- opt-in explícito só onde faz sentido (dashboard, notificações, jobs de reunião).

**[Quick win] `useDashboardData` e `atividades.tsx` buscam os mesmos dados com keys diferentes.** `qk.dash.tarefas()` e `qk.atividades.tarefas()` fazem `select * from todo` — quem navega Dashboard → Atividades faz duas leituras completas da mesma tabela. Consolidar em uma única query compartilhada com `queryKey: ["tarefas", "ativas"]` reduz ~40% das leituras dessas duas rotas.

**[Quick win] `select("*")` em tabelas pesadas.** `reunioes` traz transcrição inteira no listing; `todo` traz descrição completa. Trocar por select explícito nas telas de listagem (drawer/detail continua buscando o full row on-demand).

**[Roadmap — não faço agora]** Migrar as queries repetidas para `queryOptions` + `ensureQueryData` no loader das rotas (padrão TanStack). Ganho grande mas é refactor de várias rotas.

### 2.2 Regras de domínio duplicadas

**[Quick win] "Tarefa ativa" / "Demanda ativa" / "Reunião ativa" reimplementadas.** A mesma regra aparece em `src/routes/index.tsx` (linhas 219–229), em `MinhasAtribuicoesPainel`, em `atividades.tsx` e em `useDashboardData`. Centralizar em `src/lib/domain/atividades.ts` (arquivo já existe) como `isTarefaAtiva`, `isDemandaAtiva`, `isReuniaoAtiva`, `isChamadoAtivo`.

**[Quick win] Cálculo "atrasado" espalhado.** `prazo && new Date(prazo) < new Date()` aparece em ≥5 lugares. Extrair para `isAtrasado(prazo)` no mesmo módulo.

**[Roadmap]** Consolidar mapa de status → cor/label (hoje cada tela redefine `STATUS_LABEL`/`STATUS_TONE`). Vira `src/lib/domain/status.ts`.

### 2.3 UI/UX repetida

**[Quick win] Blocos KPI/StatPill duplicados.** `KpiTile`, `StatCard`, `StatPill` e blocos ad-hoc dentro de cada rota fazem a mesma coisa com pequenas variações. Documentar qual usar (StatPill para hero, KpiTile para cards) e substituir os ad-hoc — sem criar componente novo.

**[Roadmap]** `processos.tsx` (1525 linhas), `reunioes.tsx` (1419) e `relatorios.tsx` (899) precisam ser quebrados em subcomponentes. Faço a quebra do `processos.tsx` na Parte 1 (já necessário para o redesenho); os outros dois ficam como próxima rodada.

**[Roadmap]** Padronizar headers de página — hoje uns usam `PageHero`, outros `PageHeader`, outros header inline. Escolher `PageHero` como padrão único.

---

## O que sai desta rodada

1. Redesenho completo da tela `/processos` (Parte 1).
2. `refetchInterval` removido do default do router; opt-in nos pontos que precisam.
3. Query compartilhada de tarefas/demandas/reuniões entre Dashboard e Atividades.
4. `select` explícito nas listagens de reuniões e tarefas.
5. Helpers `isTarefaAtiva/isDemandaAtiva/isReuniaoAtiva/isChamadoAtivo/isAtrasado` centralizados e aplicados em Dashboard, Atividades e Minhas Atribuições.
6. Substituição dos blocos KPI ad-hoc pelos componentes existentes.

## O que fica como roadmap (só listo, não implemento)

- Migração para `queryOptions` + loader `ensureQueryData` nas rotas principais.
- Módulo único `src/lib/domain/status.ts`.
- Quebra de `reunioes.tsx` e `relatorios.tsx` em subcomponentes.
- Padronização de `PageHero` como header único.

## Custo estimado

Cabe em 1 crédito de execução (Parte 1 concentra o gasto; os quick wins da Parte 2 são mudanças pequenas e paralelas).
