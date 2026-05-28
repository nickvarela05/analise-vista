
## Redesign — Aba Tarefas (tom emerald)

Aplicar a mesma linguagem visual da Dashboard e do Insights & IA, sem alterar lógica de negócio, dados, RLS ou queries.

### Arquivos afetados
- `src/routes/tarefas.tsx` — substituir `PageHeader` + `StatCard` por hero novo; reestilizar toolbar.
- `src/components/tarefas/TarefaKanban.tsx` — redesenhar header/colunas/empty-state.
- `src/components/tarefas/TarefaCard.tsx` — redesenhar card (gradiente sutil, accent bar, hover, progress de checklist).
- `src/components/shared/PageHero.tsx` — **novo** componente reutilizável (será reusado nas demais abas).
- `src/components/shared/StatPill.tsx` — **novo** KPI pill reutilizável.

### 1) Hero (novo componente compartilhado `PageHero`)
- Card com `rounded-2xl border bg-gradient-to-br from-{tone}/10 via-background to-background shadow-sm`.
- Glows tonais (top-right e bottom-left) usando blur-3xl.
- Ícone tonal em badge (`rounded-2xl bg-{tone}/15 ring-1 ring-{tone}/20`).
- Eyebrow "Fluxo de trabalho" uppercase tracking, título grande com gradient text, descrição curta, data atual em pt-BR.
- Slot de actions à direita (mantém Importar / Exportar / Nova).
- Slot de KPIs em grid responsivo (2/3/6 colunas) usando `StatPill`.

Para Tarefas, tom = **emerald**, ícone = `CheckSquare`, título = "Tarefas", subtítulo = "Acompanhe o fluxo da equipe — da ideia até a produção.".

### 2) StatPill (novo compartilhado)
- Tile compacto: ícone tonal, label uppercase, valor grande tabular-nums, hint opcional, `tone` (sky/emerald/violet/amber/rose/indigo/cyan/primary/destructive).
- Hover sutil (`-translate-y-0.5 shadow-md`), gradiente tonal de fundo.

### 3) KPIs (mantém os 6 atuais com ícones)
| Item              | Tom        | Ícone           |
|-------------------|------------|-----------------|
| Ativas            | primary    | Activity        |
| Atrasadas         | destructive| AlertTriangle   |
| Vencendo hoje     | amber      | Clock           |
| Homologação       | sky        | FlaskConical    |
| Aprovadas         | emerald    | CheckCircle2    |
| Em produção       | violet     | Rocket          |

### 4) Toolbar
- Card sutil envolvendo `TarefaFilters` + switch de visão.
- Switch Kanban/Lista vira um `segmented control` com ícones (`LayoutGrid` / `ListIcon`), pill emerald quando ativo.

### 5) Kanban — colunas
- Header de coluna: faixa de gradiente tonal por status (`from-{tone}/15 via-{tone}/5 to-transparent`), título em peso forte, descrição em xs, contador como pill tonal (em vez de `Badge` neutro).
- Coluna: `rounded-xl border bg-card/60 backdrop-blur` no lugar do `bg-muted/40`; ring tonal sutil quando drag-over.
- Empty state: ícone `Inbox` esmaecido + microcopy.

### 6) Card de tarefa (`TarefaCard`)
- `rounded-xl border bg-card` com **accent bar lateral** de 3px por prioridade (alta=rose, media=amber, baixa=emerald) usando gradient vertical.
- Hover: `-translate-y-0.5 shadow-lg ring-1 ring-{tone}/20`.
- Quando atrasada: glow rose sutil no canto + badge "Atrasada" com pulse.
- Título com `tracking-tight`, descrição em `text-muted-foreground/80`.
- **Progress bar de checklist** abaixo dos badges quando `checklistTotal > 0` (barra fininha emerald).
- Prazo: chip com ícone Calendar; tom warning para hoje, destructive com pulse para atrasada, neutro para futuro distante, info quando dentro de 3 dias.
- Avatares dos responsáveis com `ring-2 ring-background`, fallback gradient `from-emerald-500/30 to-emerald-500/10`.
- Checkbox de seleção sai do hover-only para sempre visível em opacidade baixa (60%) → 100% no hover/selecionado, posicionado top-right.
- Badge "Demanda", "HML importada", "Em teste" com cores tonais e ícones consistentes.

### 7) Empty state geral
- Quando `filtered.length === 0`, usar card grande com ícone gradiente (`CheckSquare` em halo emerald), título e descrição centrados, botão "Nova tarefa" inline.

### Não-objetivos
- Não alterar `useTarefasData`, `TarefaDrawer`, `TarefaFilters`, `Importar/Exportar/Nova dialogs`, `TarefasBulkBar`, `TarefasLista` (essa será incluída na mesma estética, mas apenas estilos das linhas — sem mudar colunas/dados).
- Não trocar a lógica de drag-and-drop nem o normalizeStatus.
- Não tocar em rotas, permissões ou queries.

### Verificação
1. Build passa.
2. Visual em /tarefas: hero emerald renderizado, KPIs vivos, kanban com headers tonais, cards com accent bar e progress de checklist.
3. Drag-and-drop continua funcionando entre colunas.
4. Filtros, seleção em massa e drawer continuam funcionais.
