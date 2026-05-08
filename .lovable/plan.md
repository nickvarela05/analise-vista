## Contexto

Restam 5 arquivos grandes que concentram muita lógica/JSX:

| Arquivo | Linhas |
|---|---|
| `src/routes/reunioes.tsx` | 1251 |
| `src/routes/index.tsx` | 936 |
| `src/components/equipe/EquipeUsuariosView.tsx` | 716 |
| `src/routes/tarefas.tsx` | 643 |
| `src/components/equipe/GestaoCopaView.tsx` | 525 |

Como Etapa 4 é a mais arriscada (move muito JSX/estado), proponho fazer **um arquivo por iteração**, sempre por **extração pura** (sem mudar comportamento, sem renomear queryKeys, sem mexer em RLS/SQL). Cada iteração termina com `tsc` + testes verdes antes de seguir.

## Ordem proposta (do menor risco ao maior)

### Passo 1 — `routes/tarefas.tsx` (643 linhas, mais simples)
Extrair para `src/components/tarefas/`:
- `TarefasFiltrosBar.tsx` — barra de busca/filtros (status, prioridade, responsável, demanda).
- `TarefasHeaderActions.tsx` — botões de ação do `PageHeader` (Nova tarefa, alternar visualização).
- `useTarefasData.ts` — hook que agrupa as `useQuery` (todo, colaboradores, demandas-mini, counts) e devolve `{ tarefas, colabs, demandas, counts, isLoading }`.

A rota fica só com: layout, estado de filtros, composição `<TarefaKanban />` / `<TarefaList />`.

### Passo 2 — `routes/index.tsx` (936 linhas)
Já existe `dashboard/`. Extrair mais blocos:
- `dashboard/KpisRow.tsx` — grid de `KpiTile` (recebe os números já memoizados).
- `dashboard/AvisosCriticosCard.tsx`
- `dashboard/ReunioesSemanaCard.tsx`
- `dashboard/FeriasAtivasCard.tsx`
- `dashboard/AtribuicoesPorColaboradorChart.tsx`
- `useDashboardData.ts` — agrupa as `useQuery` da home.

A rota passa a ser orquestração + `useMemo` dos KPIs (já feitos na Etapa 5).

### Passo 3 — `components/equipe/EquipeUsuariosView.tsx` (716 linhas)
Extrair para `src/components/equipe/usuarios/`:
- `UsuariosTable.tsx` — tabela.
- `UsuarioRoleDialog.tsx` — diálogo de papéis.
- `UsuarioInviteDialog.tsx` — diálogo de convite.
- `useUsuariosAdmin.ts` — server fn calls + estado.

### Passo 4 — `components/equipe/GestaoCopaView.tsx` (525 linhas)
Extrair para `src/components/equipe/copa/`:
- `CopaCalendario.tsx`
- `CopaEscalaForm.tsx`
- `useCopaData.ts`

A regra de negócio já vive em `lib/domain/copa.ts` (testada).

### Passo 5 — `routes/reunioes.tsx` (1251 linhas, mais arriscado)
Por último, com mais cuidado. Extrair para `src/components/reunioes/`:
- `ReuniaoDialog.tsx` (criar/editar)
- `ReuniaoDetailDrawer.tsx` (transcrição, ações IA)
- `ReuniaoCard.tsx` / `ReunioesList.tsx`
- `useReunioesData.ts`

## Regras de segurança aplicadas em todos os passos

1. **Extração pura**: copiar JSX/handlers para o novo arquivo, importar de volta na rota. Zero mudança de comportamento.
2. **Não tocar em**: `routeTree.gen.ts`, `integrations/supabase/*`, migrations, RLS, queryKeys (já centralizadas em `qk`).
3. **Tipagem**: usar os aliases de `src/lib/db-types.ts` ao trafegar props (sem `any`).
4. **Validação por passo**:
   - `tsc --noEmit` (via build automático do harness).
   - `bunx vitest run` — manter 21/21.
   - Smoke visual nas rotas tocadas (preview).
5. **Commits lógicos por passo** (1 PR mental por arquivo) — se algo quebrar, é fácil reverter o passo isolado.
6. **Sem refactor especulativo**: se um trecho é usado só naquela rota, fica em `components/<rota>/` (não promover a `components/` global).

## Entregáveis ao final da Etapa 4

- 5 arquivos antes >500 linhas, todos abaixo de ~250 linhas.
- ~12–15 novos componentes/hooks pequenos, todos tipados.
- Testes 21/21 + build limpo + sem mudança visual.

## Recomendação

Começar **agora pelo Passo 1 (`routes/tarefas.tsx`)** que é o de menor risco e valida o padrão de extração para os demais.
