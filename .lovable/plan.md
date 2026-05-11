## Problema

O trigger `trg_notify_demanda_atribuida` (função `notify_demanda_atribuida`) compara `NEW.prioridade = 'urgente'`, mas o enum `demanda_prioridade` no banco só aceita: `baixa`, `media`, `alta`, `critica`.

Resultado: **qualquer** INSERT/UPDATE em `demanda` falha com:
> `invalid input value for enum demanda_prioridade: "urgente"`

mesmo selecionando uma prioridade válida no formulário.

## Correção

Migração para recriar a função `notify_demanda_atribuida` trocando as duas referências de `'urgente'` por `'critica'` (valor real do enum hoje), mantendo todo o resto da lógica idêntica:

- Mensagem da notificação para prioridade crítica continua sendo "Demanda URGENTE atribuída" (apenas o texto exibido — o valor comparado passa a ser `'critica'`).
- O tipo de notificação `demanda_urgente` permanece (é outro enum, `notificacao_tipo`, que não está sendo alterado).

Sem mudanças no frontend.

## Validação

1. Aplicar a migração.
2. Criar uma demanda nova no app (qualquer prioridade) → deve salvar sem erro.
3. Criar uma com prioridade "Crítica" e responsável atribuído → confirmar que a notificação é gerada como "Demanda URGENTE atribuída".

Posso aplicar?