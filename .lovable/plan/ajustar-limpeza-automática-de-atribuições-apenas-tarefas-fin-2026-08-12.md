# Ajustar limpeza automática de atribuições (apenas tarefas finalizadas)

## Problema

A rotina diária que zera responsáveis remove a atribuição de **tarefas ainda abertas** quando o prazo (`data_prevista`) venceu há mais de 3 dias. Resultado: tarefas atrasadas somem de "Minhas atribuições" mesmo sem terem sido finalizadas.

## Mudança

Alterar apenas o bloco de **tarefas** da rotina `limpar_atribuicoes_finalizadas()`:

- Manter: desatribuir tarefas com status finalizado (`encerrada`, `concluida`, `producao`) após 3 dias sem alteração.
- Remover: a condição de prazo vencido (`data_prevista`), que atingia tarefas abertas.

Demandas e reuniões ficam **exatamente como estão** — nenhuma alteração nas regras delas.

## Detalhes técnicos

- Uma migração com `CREATE OR REPLACE FUNCTION public.limpar_atribuicoes_finalizadas()`, reaproveitando o corpo atual e retirando do `WHERE` da tabela `todo` o trecho `OR (data_prevista IS NOT NULL AND data_prevista < CURRENT_DATE - INTERVAL '3 days')`.
- Assinatura, `SECURITY DEFINER`, `search_path` e retorno JSON permanecem iguais; o agendamento diário (03:00 UTC) continua chamando a mesma função, sem precisar de mudanças.
- Nenhuma alteração de código no app.

## Observação

Tarefas que já perderam o responsável por essa regra não são restauradas automaticamente — precisam ser reatribuídas manualmente (ou posso listar quais foram afetadas, se quiser).
