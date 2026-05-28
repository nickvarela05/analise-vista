
## Parte 1 — Incluir Nickolas Varela no "Resumo semanal do funcionário"

### Diagnóstico
Consultando o banco, Nickolas tem `role = 'gestor'` (não `analista`). Por isso ele não aparece no seletor — o filtro atual em `src/routes/insights.tsx` busca apenas `user_roles.role = 'analista'`.

### Mudança
Arquivo: `src/routes/insights.tsx` (função `ResumoPorFuncionario`)

- Trocar o filtro de `eq("role", "analista")` por `in("role", ["analista", "gestor"])`, para que todos os colaboradores que efetivamente geram resumos semanais apareçam no seletor (analistas, estagiários e gestores como o Nickolas).
- Ordenação por nome continua igual.
- Nenhuma alteração em RLS, migrações ou edge function.

> Observação: já que o gestor logado também passará a aparecer na lista, ele poderá visualizar o próprio resumo por aqui além do bloco principal — comportamento desejado e consistente.

---

## Parte 2 — Redesign das 8 abas restantes (UI/UX "uau")

### Objetivo
Aplicar a mesma linguagem visual já implementada em **Dashboard** e **Insights & IA**:
- Hero/cabeçalho com gradiente sutil, ícone tonal, descrição contextual e KPIs vivos.
- Cards com bordas suaves, gradientes em camadas (`from-primary/X via-... to-...`), `ring`, sombra elegante e estados hover.
- Tipografia hierárquica (título grande com gradient text, label uppercase tracking, números destacados).
- Cores tonais por contexto (cada aba ganha uma "cor mãe" reutilizando a paleta já presente no `AppSidebar`).
- Microinterações (transições, ícones animados, badges com pulso quando relevante).
- Empty states ilustrados e loading skeletons consistentes.

### Mapeamento de tom por aba (alinhado ao sidebar atual)

| Aba                  | Cor tonal | Ícone âncora     |
| -------------------- | --------- | ---------------- |
| Atividades semanais  | sky       | CalendarRange    |
| Reuniões             | indigo    | Calendar         |
| Tarefas              | emerald   | CheckSquare      |
| Demandas             | cyan      | Inbox            |
| Avisos               | rose      | Megaphone        |
| Portfólio            | indigo    | Briefcase        |
| Equipe               | violet    | Users            |
| Configurações        | primary   | Settings         |

### Componentes compartilhados a criar (reuso entre todas as abas)

`src/components/shared/`:
1. **`PageHero.tsx`** — hero genérico (título com gradient, descrição, ícone tonal em badge com glow, slot de actions e slot de KPIs). Substitui/estende `PageHeader` nas abas redesenhadas (sem quebrar quem usa `PageHeader` puro).
2. **`StatPill.tsx`** — pílula de KPI compacta (label, valor, ícone, delta opcional, variant tonal).
3. **`SectionShell.tsx`** — card com header (ícone tonal + título + descrição + actions) e conteúdo, padronizando todas as seções.
4. **`EmptyStatePro.tsx`** — empty state com ilustração via ícone grande + halo gradiente.

Esses componentes seguem o padrão já usado em `DashboardHero` e `SectionHeader`, garantindo coerência.

### Aba a aba (escopo de UI; lógica/dados intactos)

1. **Atividades semanais (`src/routes/atividades.tsx`)**
   - Hero sky com KPIs: total semana, % concluído, em atraso, próxima entrega.
   - Linha do tempo semanal redesenhada (cards por dia com gradient header e badges de status).
   - Filtros/segmented control no topo da lista; cada item ganha avatar do responsável, prioridade colorida e progresso.

2. **Reuniões (`src/routes/reunioes.tsx`)**
   - Hero indigo com KPIs: agendadas hoje, esta semana, com transcrição pendente, decisões registradas.
   - Cards de reunião com hora destacada, participantes em avatares sobrepostos, badges de status (`agendada/realizada`), accent bar lateral.
   - Drawer/preview de transcrição com tipografia editorial reutilizando o padrão do `ResumoCard`.

3. **Tarefas (`src/routes/tarefas.tsx`)**
   - Hero emerald com KPIs: pendentes, em andamento, em teste, concluídas hoje.
   - Kanban redesenhado: colunas com header tonal (gradiente por status), contadores em pill, cards com prioridade colorida, prazo com tom alerta quando próximo/vencido, checklist progress bar.
   - Toolbar (busca + filtros + visão lista/kanban) unificada.

4. **Demandas (`src/routes/demandas.tsx`)**
   - Hero cyan com KPIs: abertas, em análise, aguardando solicitante, encerradas no mês.
   - Cards com categoria/origem como chips tonais, SLA visual (barra de tempo decorrido), solicitante destacado.
   - Agrupamento por status com headers acordeon estilizados.

5. **Avisos (`src/routes/avisos.tsx`)**
   - Hero rose com KPIs: ativos, não lidos por mim, expirando em 7 dias, leitura média.
   - Cards de aviso com gradient por `tipo` (informativo/urgente/comemorativo), autor + carimbo de data destacado, contador de leituras (avatares).
   - Banner fixo para aviso urgente ativo no topo.

6. **Portfólio (`src/routes/portfolio.tsx`)**
   - Hero indigo com KPIs do portfólio (projetos ativos, clientes, módulos, releases).
   - Grid de cards de projeto com capa, tags, responsáveis (avatar stack) e estado.
   - Visão detalhe com tabs estilizadas e timeline.

7. **Equipe (`src/routes/equipe.tsx`)** — restrito a gestor
   - Hero violet com KPIs: disponíveis agora, em reunião, em férias, fora do expediente.
   - `EquipeKpis` reestilizado usando `StatPill`.
   - Tabs (Lista / Grade / Calendário / Copa / Usuários) com underline animado e ícones.
   - Cards de colaborador com avatar, status com bullet pulsante, badge de equipe (Análise/Help-Desk/Suporte) e horário do dia em mini-timeline.

8. **Configurações (`src/routes/configuracoes.tsx`)**
   - Hero primary com subtítulo dinâmico ("Olá, {nome} — ajuste sua experiência").
   - Tabs (Conta / Notificações / E-mails / IA) redesenhadas como segmented control vertical em telas largas (sidebar de configuração) com painel à direita.
   - Cards de conta com avatar grande, role como badge gradiente, e ações (tema, sessão) em "action tiles" coloridas.

### Não-objetivos
- Não alterar lógica de negócio, queries, RLS, edge functions ou estrutura de dados.
- Não trocar nomes das abas, rotas ou permissões.
- Não introduzir bibliotecas novas — somente Tailwind, shadcn e lucide já presentes.
- Não tocar nas abas Dashboard e Insights & IA (já feitas).

### Ordem de execução sugerida
1. Parte 1 (ajuste do seletor — mudança mínima).
2. Criar componentes compartilhados em `src/components/shared/`.
3. Redesenhar abas na ordem: Tarefas → Demandas → Atividades semanais → Reuniões → Avisos → Portfólio → Equipe → Configurações.
4. QA visual em cada aba antes de seguir para a próxima.
