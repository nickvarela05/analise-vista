## Objetivo

Permitir que o gestor reordene as fotos da "Galeria da equipe" arrastando-as. A nova ordem é persistida no banco e refletida para todos.

## Mudanças

### 1. Biblioteca de drag-and-drop
- Instalar `@dnd-kit/core`, `@dnd-kit/sortable` e `@dnd-kit/utilities` (padrão moderno, acessível, sem dependências legadas).

### 2. `src/components/equipe/GaleriaDialog.tsx`
- Ordenar query por `ordem ASC, created_at DESC` (em vez de só `created_at`).
- Envolver a grade de fotos com `DndContext` + `SortableContext` (estratégia `rectSortingStrategy`).
- Cada item da galeria vira um `SortableItem` com handle de arrastar (ícone `GripVertical` no canto superior esquerdo, visível em hover, apenas para gestor).
- Ao soltar (`onDragEnd`):
  - Reordenar localmente (otimista) via `arrayMove`.
  - Recalcular `ordem` (índice no array) e fazer `upsert` em lote no Supabase para todas as fotos afetadas.
  - Em caso de erro: toast e `invalidateQueries` para reverter.
- Para usuários sem permissão (`canManage = false`): grade renderiza normalmente, sem drag.

### 3. Novas fotos
- Ao inserir, usar `ordem = (max(ordem) + 1)` em vez de `0`, para que apareçam ao final.

## Detalhes técnicos

- Sensors: `PointerSensor` (com `activationConstraint: { distance: 6 }` para não conflitar com clique no botão de excluir) + `KeyboardSensor` para acessibilidade.
- `SortableItem` usa `useSortable({ id })` e aplica `transform`/`transition` via `CSS.Transform.toString`.
- Persistência: `supabase.from('colaborador_galeria').upsert(items.map((f, i) => ({ id: f.id, ordem: i })))` — RLS já permite gestor (`Gestor gerencia galeria`).
- Sem migração de banco — `ordem` já existe.

## Fora do escopo
- Reordenação por drag em outras listas (ex.: colaboradores).
- Edição de legenda inline.