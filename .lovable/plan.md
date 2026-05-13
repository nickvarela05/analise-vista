
# Plano: Lotes de importação e exportação de relatórios na aba Tarefas

## Objetivos
1. Marcar tarefas importadas via "Importar tarefas de homologação" com uma flag visível e filtrável.
2. Agrupar cada importação em um **lote nomeado** (rastreável e reutilizável para exportação).
3. Permitir **exportar relatório** das tarefas (todas ou filtradas por lote/status) em Excel e PDF.

---

## 1. Banco de dados (migration)

### Nova tabela `todo_importacao_lote`
- `nome` (text, obrigatório — definido pelo usuário no momento da importação)
- `descricao` (text, opcional)
- `tipo` (text, default `homologacao`) — espaço para futuros tipos
- `total_tarefas` (int)
- `criado_por` (uuid)
- `created_at`

RLS: equipe lê; autenticado cria; gestor/criador atualiza/exclui.

### Alterações em `todo`
- `lote_importacao_id` (uuid, FK → `todo_importacao_lote.id`, nullable)
- `origem_importacao` (text, nullable) — ex.: `"homologacao"`, útil mesmo se o lote for excluído
- Índice em `lote_importacao_id`

> Tarefas criadas manualmente continuam com esses campos `null`.

---

## 2. Importação (`ImportarTarefasDialog`)

Quando "Importar tarefas de homologação" estiver marcada:
- Exibir campo obrigatório **"Nome do lote"** (sugestão automática: `HML – {nome do arquivo} – {data}`).
- Campo opcional "Descrição do lote".
- Fluxo:
  1. Cria registro em `todo_importacao_lote`.
  2. Insere tarefas em `todo` com `lote_importacao_id` + `origem_importacao = 'homologacao'` + `status = 'homologacao'`.
  3. Atualiza `total_tarefas` no lote.
- Mensagem de sucesso: `"X tarefas importadas no lote {nome}"`.

Importações **sem** o checkbox seguem como hoje (sem lote).

---

## 3. UI da aba Tarefas

### Identificação visual
- `TarefaCard` e `TarefasLista`: badge **"HML importada"** (cor `info`) quando `origem_importacao === 'homologacao'`.
- Tooltip exibe o nome do lote.

### Filtros (`TarefaFilters`)
- Novo filtro **"Lote de importação"** (combobox carregando lotes existentes; opções: "Todos", lote específico, "Sem lote").
- Novo filtro **"Origem"**: Todas / Importadas HML / Manuais.

### Drawer da tarefa
- Mostrar lote vinculado (nome + data) na seção de metadados quando existir.

---

## 4. Exportação de relatório

Novo botão **"Exportar"** no header da tela `/tarefas`, ao lado de "Importar planilha".

Abre dialog `ExportarTarefasDialog` com:
- **Escopo**:
  - Todas as tarefas filtradas atualmente (respeita filtros da tela), **ou**
  - Selecionar lote(s) específico(s) (multi-select), **ou**
  - Selecionar status (multi-select; "todos" disponível).
- **Formato**: Excel (`.xlsx`) ou PDF.
- **Colunas incluídas**: título, descrição, status, prioridade, responsáveis (nomes), prazo, lote, origem, criado em, concluído em, demanda vinculada.

Implementação:
- Excel via `xlsx` (já instalado) — uma planilha "Tarefas" + (se múltiplos lotes) planilha resumo "Lotes".
- PDF via `jspdf` + `jspdf-autotable` (adicionar dependência) — layout em tabela com cabeçalho do filtro aplicado.
- Nome do arquivo: `tarefas-{escopo}-{YYYYMMDD}.xlsx|pdf`.

---

## 5. Arquivos afetados

**Novos**
- `supabase/migrations/{ts}_lotes_importacao_tarefas.sql`
- `src/components/tarefas/ExportarTarefasDialog.tsx`
- `src/lib/tarefas/export.ts` (helpers de geração Excel/PDF)

**Editados**
- `src/components/tarefas/ImportarTarefasDialog.tsx` — campos do lote + criação do registro
- `src/components/tarefas/TarefaFilters.tsx` — filtros de lote/origem
- `src/components/tarefas/TarefaCard.tsx` e `TarefasLista.tsx` — badge HML
- `src/components/tarefas/TarefaDrawer.tsx` — exibir lote
- `src/components/tarefas/useTarefasData.ts` — carregar lotes + aplicar filtros
- `src/routes/tarefas.tsx` — botão "Exportar" no header
- `src/integrations/supabase/types.ts` (gerado automaticamente após migration)

---

## Perguntas para confirmar antes de implementar
1. **Formato preferido do relatório**: Excel, PDF, ou ambos (como proposto)?
2. **Lote opcional ou obrigatório** quando o checkbox HML estiver marcado? (Proposta: obrigatório, com sugestão automática.)
3. Importações **manuais** (sem checkbox HML) também devem permitir nomear um lote, ou lotes só existem para HML por enquanto?
