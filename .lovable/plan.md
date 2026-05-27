## Objetivo

Na aba **Insights & IA**, adicionar uma nova seção **"Resumo semanal do funcionário"**, onde o gestor pode selecionar um analista/estagiário por vez e visualizar o resumo semanal individual daquele colaborador.

## Comportamento

- Visível apenas para usuários com papel `gestor` (a lista de outros funcionários é uma visão gerencial; o RLS de `resumo_semanal` já permite ao gestor ler todos).
- Aparece **abaixo** do bloco atual de resumos executivos, sem remover nada do que já existe.
- Seletor (dropdown) lista todos os usuários com papel `analista` (incluindo estagiários, que hoje compartilham esse papel — diferenciados pelo campo `cargo` em `profiles`, mostrado entre parênteses no item).
- Ao escolher um colaborador:
  - Carrega o **resumo semanal mais recente** daquele `user_id` em `resumo_semanal`.
  - Renderiza usando o mesmo componente `ResumoCard` já existente (KPIs, seções markdown, insights), mantendo o padrão visual.
  - Mostra um seletor secundário com as últimas semanas disponíveis para o funcionário (caso queira navegar para resumos anteriores).
- Estados tratados: carregando, sem colaborador selecionado, colaborador sem resumo gerado ainda, erro de fetch.
- Para usuários não-gestores: a seção fica oculta (eles continuam vendo apenas o próprio resumo no bloco existente).

## Detalhes técnicos

Arquivo a editar: `src/routes/insights.tsx`

1. Novo componente `ResumoPorFuncionario` adicionado dentro do mesmo arquivo, renderizado em `InsightsPage` após `<ResumoSemanal />`, condicionado a `role === "gestor"`.
2. Busca de funcionários:
   - `select user_id, role` de `user_roles` onde `role = 'analista'`.
   - Join client-side com `profiles` (`user_id, nome, cargo, avatar_url`) para nome de exibição.
3. Busca de resumos do selecionado:
   - `select * from resumo_semanal where user_id = $selected order by semana_inicio desc limit 12`.
   - Estado local guarda a lista; índice ativo controla qual resumo exibir (default 0 = mais recente).
4. UI:
   - Card de cabeçalho com título, descrição e o `Select` (shadcn) de funcionário.
   - Avatar + nome + cargo do funcionário selecionado em destaque.
   - `Select` secundário compacto com as semanas disponíveis (formato `dd/MM – dd/MM`).
   - Reuso de `ResumoCard` para o corpo.
   - Empty state: "Nenhum resumo gerado ainda para este colaborador."

## Não-objetivos

- Não altera a edge function `gerar-resumo-semanal` (ela já gera por usuário).
- Não cria tabelas nem migrações novas.
- Não toca no bloco existente de "Resumos executivos com IA".
