# Restaurar responsáveis das tarefas em homologação/aprovação

## O que foi verificado

Tarefas nos status pedidos: 4 em homologação, 21 aprovadas, 1 aprovada com ressalvas, 2 reprovadas.
Destas, **18 estão sem nenhum responsável** (16 aprovadas, 1 aprovada com ressalvas, 1 reprovada). As 4 em homologação estão OK.

O histórico da tarefa só guarda a quantidade ("3 pessoa(s)"), não quem eram. Porém as **notificações de atribuição** guardam a tarefa e a pessoa notificada, e a contagem por tarefa bate exatamente com o histórico. Ou seja, dá para reconstruir com precisão quem era responsável antes da limpeza automática.

## Restauração proposta

Repor `responsaveis_ids` nas 18 tarefas usando as pessoas notificadas na atribuição original (todas em 07/08):

- 4 tarefas com 3 responsáveis: Matheus Nogueira, Ewerton Gomes, Felipe Pino (9221, 9224, 9225, 9226)
- 4 tarefas com 2 responsáveis: 9212 e 8966 (Ewerton + Nickolas), 9177 e 7217 (Matheus + Felipe)
- 10 tarefas com 1 responsável: Hugo Santos (8756, 9167, 8861, 9205), Matheus Nogueira (9144, 9210, 9098), Felipe Pino (9099, 9084), Nickolas (9168)

Não serão alterados status, prazos, `em_teste` nem qualquer outro campo — apenas a lista de responsáveis. Tarefas que já têm responsável ficam intocadas.

## Detalhes técnicos

- Uma atualização de dados na tabela `todo`, montando `responsaveis_ids` a partir dos ids distintos em `notificacao` (tipo `tarefa_atribuida`, `metadata->>'tarefa_id'`), aplicada só às tarefas nesses status que hoje estão sem responsável e sem `equipe_toda`.
- `equipe_toda` permanece `false`; `responsavel_id` (campo legado) segue nulo, pois a aplicação usa `responsaveis_ids`.
- Sem alteração de código no app.

## Observação

A rotina automática já foi ajustada para não desatribuir tarefas abertas, então essas atribuições não serão limpas de novo enquanto as tarefas não forem finalizadas (encerrada/concluída/produção há mais de 3 dias). Se você quiser que status como "aprovado" e "reprovado" também nunca sejam limpos, posso incluir isso num próximo ajuste.
