
# Otimização da tela de Tarefas

## Diagnóstico dos gargalos atuais

Analisei `src/routes/tarefas.tsx`, `useTarefasData.ts`, `TarefaKanban.tsx` e `TarefaCard.tsx`. Os atrasos têm 3 causas claras:

### 1. Carregamento inicial lento
Em `useTarefasData.ts`:
- Antes de buscar as tarefas, executa um `UPDATE` no Postgres para auto-encerrar tarefas antigas. Isso roda **toda vez que a tela abre** e bloqueia a query de leitura.
- Faz `select("*")` paginando de 1000 em 1000, trazendo **todas** as tarefas históricas (encerradas inclusive) com todas as colunas.
- Roda 3 queries adicionais (`todo_comentario`, `todo_checklist`, `todo_anexo`) trazendo todas as linhas só para contar.
- `staleTime` de 30s + sem `placeholderData` → toda volta à rota mostra spinner.

### 2. Drag-and-drop trava (~1–2s)
Em `onDropStatus`:
- Faz `UPDATE` → espera resposta → faz `INSERT` no histórico → espera → só então `invalidateQueries`, que **refaz toda a busca** (paginada + counts).
- Não há atualização otimista: o card só "anda" quando a query refaz tudo.

### 3. Atribuir colaborador demora
Mesmo padrão: muta → espera → invalida tudo → refetch completo de milhares de linhas.

---

## Plano de melhorias

### A. Update otimista no Kanban (impacto imediato)
- Em `onDropStatus`, usar `qc.setQueryData(qk.tarefas.all(), ...)` para mover o card **antes** do round-trip. Em caso de erro, fazer rollback com o snapshot.
- Mover o `INSERT` em `todo_historico` para **fire-and-forget** (sem `await`) — o usuário não precisa esperar o histórico para ver o card mudar de coluna.
- Mesma técnica nas ações em massa (`bulkUpdateStatus`, `bulkUpdatePriority`, `bulkUpdateEmTeste`, `bulkDelete`).

### B. Update otimista ao atribuir colaborador
- No `TarefaDrawer` (assignee combobox), aplicar `setQueryData` no array de `responsaveis_ids` antes do `await`. Rollback em erro.
- Trocar `invalidateQueries` por `setQueryData` cirúrgico em fluxos que já têm os dados novos em mãos (evita refetch da lista inteira).

### C. Reduzir o payload da query inicial
1. **Remover o `UPDATE` de auto-encerramento do queryFn.** Mover para uma rotina diária (cron / trigger SQL) ou executar em background **depois** que a lista renderiza.
2. **Selecionar só as colunas usadas no card/lista** em vez de `select("*")` (titulo, descricao, status, prioridade, em_teste, data_prevista, responsavel_id, responsaveis_ids, equipe_toda, demanda_id, origem_importacao, lote_importacao_id, concluida_em, created_at, id).
3. **Excluir tarefas encerradas por padrão** do fetch principal (filtro `.neq("status","encerrada")`) e carregar encerradas sob demanda só quando o filtro pedir.
4. **Substituir as 3 queries de counts** (comentários/checklist/anexos, que hoje baixam todas as linhas) por uma RPC `get_tarefa_counts()` no Postgres que retorna `(todo_id, comentarios, checklist_total, checklist_done, anexos)` agregado. 1 round-trip pequeno em vez de 3 listas inteiras.

### D. Cache mais "vivo"
- `staleTime` de 30s → 2 min em `qk.tarefas.all()` e `qk.tarefas.counts()`.
- `placeholderData: keepPreviousData` para que o retorno à rota mostre dados antigos **imediatamente** enquanto revalida no fundo (sem spinner em branco).
- Wire `supabase.channel("todo")` (realtime) para `INSERT/UPDATE/DELETE` → aplica `setQueryData` direto. Outros gestores veem mudanças sem refetch.

### E. Índices no banco
Adicionar (se ainda não existirem):
- `todo (status)` parcial `WHERE status <> 'encerrada'`
- `todo (created_at desc)`
- `todo_comentario (todo_id)`, `todo_checklist (todo_id)`, `todo_anexo (todo_id)`

### F. Render mais leve no Kanban
- Memoizar `TarefaCard` com `React.memo` + comparação rasa nas props que importam (id, status, prioridade, em_teste, data_prevista, responsaveis_ids.length, counts).
- O cálculo de `counts` no `PageHero` (`counts.ativas`, etc.) hoje cria `norm = filtered.map(...)` e faz 6 `filter` em cima — substituir por **um único `reduce`**.

---

## Resultado esperado

| Cenário | Antes | Depois |
|---|---|---|
| Abrir /tarefas (cache vazio) | 1.5–3s spinner | 200–600ms |
| Voltar para /tarefas | 0.8–2s spinner | instantâneo (cache + revalida) |
| Drag card Kanban | 800–2000ms | <50ms (otimista) |
| Atribuir colaborador | 600–1500ms | <50ms (otimista) |

---

## Arquivos afetados

- `src/components/tarefas/useTarefasData.ts` — remover UPDATE, projetar colunas, filtrar encerradas, usar RPC de counts, `staleTime`, `placeholderData`.
- `src/routes/tarefas.tsx` — `onDropStatus` e bulk* com `setQueryData` + rollback; reduzir cálculo de `counts`.
- `src/components/tarefas/TarefaDrawer.tsx` — update otimista ao salvar responsáveis.
- `src/components/tarefas/TarefaCard.tsx` — `React.memo`.
- Nova migration: índices + função RPC `get_tarefa_counts()` + (opcional) job diário de auto-encerramento.

---

## Perguntas antes de implementar

1. Posso aplicar tudo de uma vez ou prefere faseado (Fase 1: otimista + memo, Fase 2: payload + RPC, Fase 3: realtime)?
2. Tarefas encerradas: ok ocultá-las da query principal e mostrar só quando o filtro pedir? (hoje vêm sempre)
3. Auto-encerramento de tarefas com mais de 5 meses: posso mover para um job diário (pg_cron) em vez de rodar a cada abertura da tela?
