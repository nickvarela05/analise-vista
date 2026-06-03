## Objetivo

Refinar o import de tarefas na aba "Tarefas" para que ele:
- Sempre crie tarefas novas (que não existem no sistema).
- Atualize o status apenas de tarefas existentes cujo status atual seja **Aberta**, **Em desenvolvimento** ou **Encerrada**.
- Preserve o status de tarefas em **Homologação**, **Aprovado**, **Aprovado c/ ressalvas**, **Reprovado** ou **Produção**, exceto quando o usuário marcar a nova flag de atualização total.

## Mudanças no modal `ImportarTarefasDialog.tsx`

1. **Bloco de instruções** dentro do modal explicando, em linguagem clara:
   - Novas tarefas serão sempre incluídas.
   - Tarefas com status Aberta / Em desenvolvimento / Encerrada terão o status atualizado pelo da planilha.
   - Tarefas em Homologação, Aprovado, Aprovado c/ ressalvas, Reprovado ou Produção serão preservadas.
   - Caso o usuário queira sobrescrever também esses status finais, deve marcar a nova flag.

2. **Nova flag** (checkbox) `Atualizar status de tarefas em estágios finais` — quando marcada, libera a atualização do status para tarefas em Homologação/Aprovado/Aprovado c/ ressalvas/Reprovado/Produção.

3. **Manter a flag existente** `Importar tarefas de homologação` (lote rastreável), com seu comportamento atual (cria lote, marca em_teste, força status Homologação para novas e atualiza existentes para Homologação).
   - Quando "homologação" está marcada, a nova flag de "atualização total" fica oculta/ignorada (regra do lote prevalece).

## Lógica nova de import (substitui o bloco `for (const l of linhas)`)

Para cada linha:
- Se não existe tarefa com o mesmo título → **insere nova** (status vindo da planilha).
- Se existe:
  - Se modo **Homologação** ativo → mantém comportamento atual (move para HML, cria lote).
  - Se modo **Atualização total** ativo → atualiza status pelo da planilha, independentemente do status atual.
  - Caso contrário (modo padrão):
    - Status atual ∈ {aberta, em_andamento, encerrada, pendente (legado)} → **atualiza** o status para o da planilha.
    - Status atual ∈ {homologacao, aprovado, aprovado_ressalvas, reprovado, producao} → **preserva** (contabiliza em `preservadas`).

Implementação: substituir o bloco que monta `novas / atualizarHml / restaurarEncerrada / preservadas` por um agrupamento em três buckets:
- `inserir` (novas)
- `atualizarStatus` (lista `{ id, status }` agrupada por status alvo para fazer updates em lote por status)
- `preservadas` (contador)

Persistência:
- Insert das novas (igual ao atual).
- Para cada status alvo distinto em `atualizarStatus`, um `update({ status }).in("id", ids)`.
- Remover o bloco específico `restaurarEncerrada` (ele passa a ser apenas um caso da regra acima).

Toast final ajustado: `X nova(s)`, `Y status atualizado(s)`, `Z preservada(s)` (e `W movida(s) p/ HML` quando aplicável).

## Notas

- Não altera schema do banco; usa o enum `todo_status` já existente (`encerrada` já incluído em migração anterior).
- Não muda a regra de auto-encerramento de 5 meses em `useTarefasData.ts`.
- Mudança restrita ao componente `src/components/tarefas/ImportarTarefasDialog.tsx`.
