Plan: deixar a visualização de datas/períodos na tela /processos mais clara e intuitiva, gastando o mínimo de créditos (apenas ajustes visuais no frontend).

Problemas identificados no estado atual:
- No calendário Gantt, as barras de "previsto" e "real" são finas (h-3) e ficam empilhadas na mesma trilha, o que dificulta comparar os períodos visualmente.
- As datas de início/fim não aparecem nas extremidades das barras.
- Os cards de lista mostram as datas apenas como texto "01 jan → 15 jan", sem duração, sem timeline visual e sem comparativo previsto x real lado a lado.
- A badge de status no calendário pode cobrir parte da barra.

O que será feito:

1. **Calendário anual – trilha dupla e mais visível**
   - Aumentar a altura da trilha de cada processo (ex: h-14 em vez de h-9) para acomodar duas linhas de barra.
   - Separar as barras verticalmente: **barra prevista** no topo (tracejada/contorno) e **barra real** na base (preenchida).
   - Adicionar mini-labels "Previsto" e "Real" dentro da trilha quando houver ambas as datas.
   - Exibir as datas de início/fim nas pontas de cada barra (quando houver espaço), para não depender só do tooltip.
   - Mover a badge de status para fora da trilha (coluna do nome, ao lado do título), eliminando sobreposição.
   - Adicionar uma linha sutil de "hoje" com label fixo no topo.

2. **Cards de lista – timeline miniatura e comparação**
   - Criar uma mini timeline horizontal no card mostrando o previsto e o real em cores diferentes (mesmas cores do calendário).
   - Incluir duração em dias: "14 dias previstos", "10 dias reais" (quando houver ambos).
   - Destacar desvio quando o real for diferente do previsto (ex: "atraso de 4 dias" ou "adiantado 2 dias").
   - Manter os blocos de texto "Previsto" e "Real" já existentes, mas com datas formatadas no padrão "01 de jan" (mais legível) e duração abaixo.

3. **Legenda e estados vazios**
   - Melhorar a legenda do calendário com descrições curtas: "Previsto (cronograma)", "Real (executado)".
   - Indicar visualmente quando ainda não há datas reais (barra real aparece como faixa cinza/transparente com texto "sem execução").

Arquivos que serão alterados:
- `src/routes/processos.tsx` – calendário, cards, legenda e helpers de formatação.

Não serão alterados:
- Banco de dados / schema / migrations (sem custo de crédito com backend).
- Edge functions / server functions.
- Rotas ou navegação.

Critério de sucesso:
- Usuário consegue, numa olhada, distinguir previsto vs real e entender a duração e atraso de cada processo no calendário e na lista.