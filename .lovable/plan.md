
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

---

## Redesign — Sistema de Modais & Drawers (linguagem comum)

Objetivo: levar a mesma linguagem visual do `PageHero` para dentro de toda criação/edição/detalhe da aplicação. Cada modal/drawer adota o **tom da aba** (Tarefas=emerald, Demandas=indigo, Reuniões=violet, Avisos=amber, Equipe=cyan, Portfólio=fuchsia, Configurações=slate, Atividades=primary), mantendo um padrão sistêmico.

### Componentes compartilhados novos
- `src/components/shared/DialogHero.tsx`
  - Cabeçalho tonal para `DialogContent`/`SheetContent`: gradiente diagonal `from-{tone}/12 via-background to-background`, glow `blur-3xl` no canto, ícone em badge tonal (`rounded-2xl ring-1 ring-{tone}/25`), eyebrow uppercase, título `text-xl tracking-tight` com gradient text, descrição em `text-muted-foreground`. Slot opcional para chips de status/IA à direita.
- `src/components/shared/DialogSection.tsx`
  - Bloco interno reutilizável: título pequeno uppercase (`Section`), descrição opcional, área de campos com `space-y-3`. Variantes `default` e `tinted` (fundo `bg-{tone}/5 ring-1 ring-{tone}/10`).
- `src/components/shared/FormField.tsx` (opcional, se reduzir repetição)
  - Wrapper que padroniza `Label + helper text + erro` sem mexer no `react-hook-form` existente.
- `src/components/shared/DialogFooterBar.tsx`
  - Footer sticky com `border-t bg-background/80 backdrop-blur`, ações primárias à direita (`Button` com gradient sutil quando relevante), secundárias à esquerda (Cancelar/Excluir), mensagens contextuais de salvamento ("Salvando...", "Última edição há 2 min").

### Padrão sistêmico aplicado a TODO modal/drawer
1. **DialogContent maior**: `max-w-2xl` para formulários simples, `max-w-3xl` para complexos com abas; drawers a `sm:max-w-xl`/`sm:max-w-2xl`. Padding interno em `p-0` para deixar o `DialogHero` colado nas bordas.
2. **Estrutura**: `DialogHero` → corpo com `space-y-5 px-6 py-5` (ou `Tabs` quando o formulário for grande) → `DialogFooterBar` sticky.
3. **Tabs internas** (quando aplicável): visual translúcido `bg-card/60 backdrop-blur ring-1 ring-border`, pill tonal no ativo.
4. **Inputs**: mantêm shadcn, mas adicionamos focus ring tonal (`focus-visible:ring-{tone}/40`) via util `inputToneClass(tone)`.
5. **Blocos IA**: caixas com gradiente `from-violet-500/10 via-fuchsia-500/5 to-transparent`, ícone `Sparkles`, microcopy "Gerado por IA" e botão para regenerar.
6. **Estados**: skeletons tonais, empty states com ícone gradiente, erros via `Alert` com borda tonal `destructive`.
7. **Acessibilidade**: foco no primeiro campo, `aria-describedby` da descrição do `DialogHero`, `ESC`/overlay-click mantidos.

---

## Redesign de modais — abas já redesenhadas

### Aba Tarefas (tom emerald)
- `src/components/tarefas/NovaTarefaDialog.tsx`
  - Trocar `DialogHeader` por `DialogHero` emerald (ícone `Plus` em halo). Adicionar bloco "Detalhes" + "Atribuição" como `DialogSection`. Checkbox "Em teste" vira tile tonal info maior. Footer com `DialogFooterBar` (Cancelar + Criar tarefa em verde gradient).
- `src/components/tarefas/TarefaDrawer.tsx`
  - Header com `DialogHero` emerald + chips de status/prioridade/atrasada à direita.
  - Reorganizar conteúdo em abas: **Visão geral**, **Checklist**, **Histórico/Comentários**, **Vínculos** (demanda/reunião).
  - Painel lateral fixo (em telas largas) com: responsáveis, prazo, prioridade, status — cada um como `StatPill` compacto editável.
  - Botões de ação (concluir, mover, excluir) consolidados no `DialogFooterBar`.
- `src/components/tarefas/ImportarTarefasDialog.tsx`
  - `DialogHero` emerald com ícone `Upload`, passos numerados (1. Upload → 2. Mapear → 3. Confirmar) em um stepper tonal no topo.
- `src/components/tarefas/ExportarTarefasDialog.tsx`
  - `DialogHero` emerald com ícone `Download`, opções como cards selecionáveis (CSV/XLSX/PDF) em vez de radios soltos.

### Aba Demandas (tom indigo)
- `src/components/demandas/DemandaDialog.tsx`
  - `DialogHero` indigo (ícone `Inbox`/`MessagesSquare`). Layout em duas colunas no desktop: esquerda formulário, direita "Resumo da demanda" com chips de categoria/prioridade/SLA.
  - Bloco IA "Sugerir categorização" com gradiente violeta-fuchsia.
- `src/components/demandas/DemandaDetailDrawer.tsx`
  - Header com `DialogHero` indigo + accent bar lateral por prioridade (igual ao card).
  - Abas: **Resumo**, **Tarefas vinculadas**, **Histórico**, **Anexos**.
  - Mini-timeline tonal indigo na aba Histórico.
- `src/components/demandas/CriarTarefaDialog.tsx`
  - Reaproveita `DialogHero` indigo (criação a partir da demanda) com badge "vinda da Demanda X".

### Aba Reuniões (tom violet)
- Dialogs atualmente embutidos em `src/routes/reunioes.tsx` (Nova reunião / Editar reunião / Detalhe). **Extrair** para arquivos próprios:
  - `src/components/reunioes/ReuniaoDialog.tsx` (cria + edita).
  - `src/components/reunioes/ReuniaoDetailDrawer.tsx` (visualização).
- `ReuniaoDialog`: `DialogHero` violet (ícone `Video`), campos em `DialogSection`: **Quando** (data/hora/duração), **Quem** (participantes via `AssigneeCombobox`), **O quê** (título/agenda), **Mídia** (`UploadAudioReuniao` em card tonal).
- `ReuniaoDetailDrawer`: abas **Resumo IA**, **Transcrição** (usa `TranscricaoFormatada` com novo cabeçalho violet), **Próximos passos**, **Anexos**. Bloco "Resumo IA" reutilizando o mesmo gradiente violet→fuchsia já criado na rota.
- `src/components/reunioes/UploadAudioReuniao.tsx`: card violet com dropzone gradient + barra de progresso tonal; estado "Transcrevendo..." com shimmer.

---

## A adicionar ao plano — abas pendentes (rotas + modais)

Para cada aba abaixo: redesenho da rota (PageHero + KPIs + toolbar + listas/cards) **e** dos respectivos modais/drawers seguindo o sistema acima. Tom indicado entre parênteses.

### Aba Atividades semanais (tom primary/sky)
- Rota: `src/routes/atividades.tsx`.
  - `PageHero` primary (ícone `CalendarRange`), KPIs: **Atividades na semana**, **Concluídas**, **Pendentes**, **Por colaborador (top 1)**, **Geradas por IA**.
  - Toolbar com seletor de semana (chevrons + date pill), filtro por colaborador (incluir **Nickolas Varela** no `select`), toggle "Mostrar resumo IA".
  - Painel "Resumo semanal" com cards por colaborador (avatar + métricas + bullets gerados pela IA, gradient sky).
- Modais:
  - `GerarResumoSemanalDialog` (novo, se não houver): hero sky, passos "Selecionar período → Selecionar colaboradores → Gerar". Botão final em gradient.
  - `EditarAtividadeDialog`/popover: hero compacto sky.

### Aba Avisos (tom amber)
- Rota: `src/routes/avisos.tsx` — `PageHero` amber (ícone `Megaphone`), KPIs: **Ativos**, **Lidos**, **Pendentes**, **Críticos**, **Agendados**.
  - Cards de aviso com accent bar por severidade (info/warning/critical), badge "Novo", contador de leitores.
- `src/components/avisos/AvisoDialog.tsx`
  - `DialogHero` amber (ícone `Megaphone`).
  - Seções: **Mensagem**, **Audiência** (toda equipe / colaboradores específicos), **Agendamento** (publicar agora / agendar), **Anexos**.
  - Pré-visualização ao vivo do card de aviso à direita em desktop.
- `NotificationBell`: dropdown reestilizado com agrupamento por dia + chips tonais.

### Aba Portfólio (tom fuchsia)
- Rota: `src/routes/portfolio.tsx` — `PageHero` fuchsia (ícone `Briefcase`), KPIs: **Projetos**, **Clientes**, **Em produção**, **Concluídos no ano**, **Destaque do mês**.
  - Grid de projetos em masonry/bento com hover scale + accent gradient fuchsia→pink, badges de stack/cliente.
  - Filtros: cliente, ano, tipo.
- Modais:
  - `NovoProjetoDialog`/`EditarProjetoDialog`: `DialogHero` fuchsia, seções **Identidade** (nome/cliente/ano), **Mídia** (capa + galeria), **Descrição** (rich text com IA opcional para gerar resumo), **Tags & métricas**.
  - `ProjetoDetailDrawer`: galeria carrossel + bloco de métricas + bloco IA "Resumo do projeto".

### Aba Equipe (tom cyan)
- Rota: `src/routes/equipe.tsx` — `PageHero` cyan (ícone `Users`), KPIs: **Total**, **Ativos hoje**, **Em férias**, **Aniversariantes do mês**, **Vagas abertas**.
  - Toolbar com toggle de visão (Grade/Lista/Calendário/Usuários/Copa) como segmented control cyan.
  - Cards de colaborador: avatar grande, accent bar por status, chips de cargo/equipe, "online agora" com dot pulsante.
- Modais/Drawers:
  - `ColaboradorDrawer.tsx`: `DialogHero` cyan com avatar + nome + cargo; abas **Perfil**, **Horários**, **Férias**, **Histórico**, **Galeria**.
  - `NovoColaboradorDialog.tsx`: hero cyan, formulário em duas colunas, upload de foto com preview circular.
  - `HorarioDialog.tsx`: hero cyan; grid semanal visual com slots clicáveis em vez de só inputs de hora.
  - `FeriasDialog.tsx`: hero cyan; date range picker visual + cálculo automático de dias úteis.
  - `GaleriaDialog.tsx`: hero cyan; dropzone + grid de thumbs com hover.
  - `EventoPopover.tsx`: popover cyan compacto com chips.
  - `ConvidarUsuarioDialog.tsx` / `CriarUsuarioDialog.tsx` / `TempPasswordDialog.tsx`: hero cyan; senha temporária em chip monoespaçado + botão copiar.

### Aba Configurações (tom slate/primary)
- Rota: `src/routes/configuracoes.tsx` — `PageHero` slate (ícone `Settings`), sem KPIs pesados; em vez disso "cards de área" (Notificações, IA, E-mails, Conta, Aparência) com ícone tonal próprio.
  - Navegação em sidebar fixa à esquerda em desktop, accordion no mobile.
- Subcomponentes:
  - `ConfiguracoesEmails.tsx`, `ConfiguracoesIA.tsx`, `PreferenciasNotificacao.tsx`: cada bloco em `DialogSection tinted` com toggles maiores, descrições e badge "IA"/"Beta" quando aplicável.
- Modais auxiliares (alterar senha, conectar provedor, etc.): `DialogHero` slate.

---

## Resumo semanal do funcionário — incluir Nickolas Varela
- Em `supabase/functions/gerar-resumo-semanal/index.ts` e nas queries que alimentam o painel: garantir que **Nickolas Varela** aparece na lista de colaboradores elegíveis (sem hardcode — vem da tabela `colaborador`; se estiver inativo, marcar `ativo=true`).
- Validar no front (`src/routes/atividades.tsx` + filtros de colaborador) que ele aparece nos selects e no painel de resumo. Caso o filtro tenha allowlist, adicionar o id.

---

## Ordem sugerida de execução (uma aba por vez)
1. **Tarefas — modais** (Nova, Drawer, Importar, Exportar).
2. **Demandas — modais** (Demanda, DetailDrawer, CriarTarefa).
3. **Reuniões — extrair + redesenhar** ReuniaoDialog + ReuniaoDetailDrawer + UploadAudio.
4. **Atividades semanais** (rota + modais) + incluir Nickolas Varela.
5. **Avisos** (rota + AvisoDialog + NotificationBell).
6. **Portfólio** (rota + Novo/Editar/Detail).
7. **Equipe** (rota + todos os drawers/dialogs listados).
8. **Configurações** (rota + subcomponentes).

### Não-objetivos (sistêmicos)
- Não alterar contratos de dados, RLS, schemas, edge functions (exceto a inclusão do Nickolas no resumo semanal).
- Não trocar libs (continua shadcn + Radix + react-hook-form).
- Não introduzir regressões de acessibilidade (foco, ESC, leitura por leitor de tela).
