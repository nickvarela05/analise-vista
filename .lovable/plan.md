## Objetivo

Reelaborar a tela `/atividades` corrigindo bugs e adicionando criação rápida de tarefas, demandas e reuniões diretamente do calendário.

## Problemas identificados

1. **Grade do "Mês" desalinhada** — em `src/routes/atividades.tsx` os cabeçalhos são `Seg…Dom`, mas os dias começam em `startOfMonth(cursor)` sem células vazias antes/depois. Resultado: o dia 1 cai sempre na primeira coluna (Seg) mesmo quando é, p.ex., uma quinta — todos os dias aparecem deslocados, dando a sensação de "não traz os dias corretos".
2. **Sem padding de fim** — também faltam células finais para completar a última semana.
3. **Sem ações de criação** — não é possível criar tarefa, demanda ou reunião a partir dessa tela; o usuário precisa sair para outra rota.
4. **Limites de data frágeis** — `inicio`/`fim` não estão normalizados em início/fim do dia, e datas vindas do banco como `YYYY-MM-DD` (campo `data_prevista`/`prazo`) são interpretadas em fuso local pelo `new Date(string)`, podendo cair no dia anterior em alguns ambientes.
5. **Reuso de queries** — a tela faz queries próprias paralelas (`qk.atividades.*`) que não compartilham cache com `useTarefasData` etc. Não vamos refatorar isso agora (fora de escopo), mas vamos garantir invalidação após criação.

## Mudanças propostas

### 1. Corrigir a grade do mês
- Calcular `gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 })` e `gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 })`.
- Gerar 7×N células cobrindo o mês inteiro alinhado a Seg–Dom.
- Renderizar dias fora do mês corrente com aparência atenuada (opacidade reduzida, sem hover).
- Manter o filtro de período usando `startOfMonth/endOfMonth` (não a grade), para não inflar a contagem com dias de meses vizinhos.

### 2. Normalizar parsing de datas
- Para campos `date` puros (`data_prevista`, `prazo`) usar parsing seguro: `new Date(\`${str}T00:00:00\`)` ou helper `parseLocalDate(str)`.
- `inicio` e `fim` ajustados para `startOfDay`/`endOfDay` antes do filtro.

### 3. Botão "Novo" no header da tela
- Adicionar um menu **"+ Novo"** (DropdownMenu) no `PageHeader.actions` com:
  - Nova tarefa → reusar `NovaTarefaDialog`
  - Nova demanda → reusar `DemandaDialog` (modo create)
  - Nova reunião → navegar para `/reunioes` com o dialog aberto, ou reusar o componente de criação se existir isolado
- Após criação, invalidar `qk.atividades.tarefas/demandas/reunioes` para refletir na grade.

### 4. Criação rápida por dia
- Em cada célula da grade (semana e mês) adicionar um botão `+` discreto (visível no hover) que abre o mesmo menu pré-preenchendo a **data daquele dia** como `data_prevista`/`prazo`/`data_reuniao`.
- Requer aceitar `defaultData?: Date` nas dialogs `NovaTarefaDialog`, `DemandaDialog` e no fluxo de nova reunião. Se hoje não aceitam, adicionar prop opcional.

### 5. Pequenas melhorias visuais
- Mostrar contador de itens por dia no topo da célula.
- Destacar finais de semana com fundo levemente diferente.
- Botão "Hoje" desabilitado quando o cursor já está no período atual.
- Atalhos de teclado: ←/→ para navegar período (opcional).

## Arquivos afetados

- `src/routes/atividades.tsx` — toda a refatoração de grade, datas e ações.
- `src/components/tarefas/NovaTarefaDialog.tsx` — adicionar prop `defaultData?: Date` (se ainda não houver).
- `src/components/demandas/DemandaDialog.tsx` — adicionar prop `defaultPrazo?: Date` (se ainda não houver).
- (Reunião) avaliar se existe dialog isolado; caso contrário, navegar para `/reunioes?novo=1&data=...` e tratar lá — definir no momento da implementação.

## Perguntas em aberto

1. Para "Nova reunião" a partir desta tela, prefere um dialog inline (mesmo padrão das outras) ou navegar para `/reunioes` com o formulário aberto?
2. O botão `+` por dia deve aparecer também em dias de outros meses na visão "Mês" (ex.: dias de junho mostrados na grade de maio)?
