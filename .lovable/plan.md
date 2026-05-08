## Objetivo
Remover o card "Workflow de chamados e tarefas" da tela de Dashboard (`/`).

## Mudanças

**`src/routes/index.tsx`**
- Remover o bloco `<div className="grid gap-4 lg:grid-cols-5">` que contém `<WorkflowChamadosPanel />` e `<HorariosPanel />`.
- Reposicionar `<HorariosPanel />` em layout próprio (largura total ou ao lado de `EquipeAtivaPanel`) para preservar a boa disposição visual.
- Remover o import de `WorkflowChamadosPanel`.
- Remover variáveis usadas só por ele: `chamadosEncaminhados` e ícones não mais utilizados (`Inbox`, `CheckSquare` se não usados em KPIs — verificar; `CheckSquare` e `Inbox` continuam usados nos KPIs, então manter).

**Arquivo `src/components/dashboard/WorkflowChamadosPanel.tsx`**
- Manter o arquivo no repositório (não excluir) caso seja reutilizado depois — a menos que você prefira deletar.

## Layout proposto após remoção
```
[ KPIs (5 tiles) ]
[ Minhas atribuições ]
[ AtribuiçõesChart | StatusTarefasPie ]
[ AtividadesSemanaPanel (2 cols) | EquipeAtivaPanel (1 col) ]
[ HorariosPanel (largura total) ]
```

## Pergunta rápida
Quer que eu **delete** o arquivo `WorkflowChamadosPanel.tsx` também, ou apenas remova do dashboard?
