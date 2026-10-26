# Plano de Skills — NEXUS

Gerado pela skill `guia-de-skills` em 2026-10-20. Catálogo de referência: `00-Meta/Catálogo de Skills.md` no vault.
O agente escolhe a skill na hora; este plano é a recomendação. Desvios ficam registrados no fim.

Plano de trabalho a que este arquivo se amarra (vault, `05-Projetos/NEXUS/`):

- **Agora:** melhorias de produto da "Avaliação Geral (Out-2026)", seção 6, etapa 4. São o Painel da Liberação e o e-mail diário útil. O R3 (pacote automático) foi adiado pelo Nickolas em 20/10: a caixa de e-mail é da organização, e o fluxo manual continua.
- **Depois:** "Plano de Limpeza e Otimização (Out-2026)", fases A a E.

## Diagnóstico

- **Tipo:** app web com backend: TanStack Start SPA no Cloudflare Workers, Supabase (Postgres com regras de acesso, pg_cron e funções no Deno), n8n.
- **Estado:** existente e grande, com cerca de 34 mil linhas em `src`, 95 migrações e 8 funções no Supabase.
- **Risco:** em produção, com dados da equipe (perfis, e-mails), autenticação, regras de acesso e uma conta Google institucional conectada.
- **Horizonte:** várias sessões, em máquinas diferentes.
- **Já existe:** 75 testes (vitest), lint e Prettier. Não há CI nos PRs (fica para a fase E). Também não há `CLAUDE.md` no repositório nem padrão de qualidade escrito; o contexto vive no vault.

## Configuração única (confirmar antes de rodar)

- [ ] `init`: criar o `CLAUDE.md` do repositório com o essencial (fluxo PR → prévia → merge, `run_worker_first`, migrações por MCP e renomeadas para a versão aplicada, bun 1.2.15) e apontar para o vault.
- [ ] `constraint-driven-development`: escrever o padrão de qualidade (CONSTRAINTS.md). **Sugestão:** fazer na fase E do Plano de Limpeza, junto com a CI, para que o padrão nasça com a trava.

## Plano por fase

| Fase                          | Skill padrão                                             | Alternativas (quando trocar)                                                                           | Economia                               | Quando acionar                                        | Status   |
| ----------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------- | ----------------------------------------------------- | -------- |
| Descoberta de cada melhoria   | `mattpocock-skills:grill-with-docs`                      | `llm-council` para escolher entre desenhos de tela                                                     | —                                      | Antes de cada melhoria, numa conversa curta           | pendente |
| Painel da Liberação: tela     | `frontend-ui-engineering` + `dataviz`                    | `ui-ux-pro-max` se precisar de paleta ou estilo                                                        | —                                      | Desenho e implementação do painel                     | pendente |
| E-mail diário útil            | `incremental-implementation` + `test-driven-development` | `source-driven-development` ao mexer no envio via n8n                                                  | —                                      | Mudança em `dispatch-email-digest`                    | pendente |
| Banco (consultas e migrações) | `migration`                                              | `security-and-hardening` se mexer em regra de acesso                                                   | —                                      | Toda migração, sempre com teste em transação desfeita | contínuo |
| Depuração                     | `debugging-and-error-recovery`                           | `mattpocock-skills:diagnosing-bugs` se intermitente · `engineering:incident-response` se cair produção | `investigate-first` → `surgical-patch` | Relato de bug do Nickolas                             | contínuo |
| Revisão antes do merge        | `code-review` + `code-review-and-quality`                | `security-review` em autenticação e regras de acesso · `web-design-guidelines` em tela                 | `caveman-review`                       | Antes de pedir o merge                                | contínuo |
| Verificação                   | `superpowers:verification-before-completion`             | navegador embutido para checar telas                                                                   | `verify-and-stop`                      | Antes de dizer "pronto"                               | contínuo |
| Entrega                       | `git-workflow-and-versioning` · `mattpocock-skills:pr`   | `shipping-and-launch` em mudança de infraestrutura                                                     | `caveman-commit`                       | Cada PR                                               | contínuo |
| Passos do Nickolas em painéis | `mattpocock-skills:wizard`                               | instruções numeradas com o menu exato                                                                  | —                                      | Cloudflare, Google Cloud, Supabase                    | contínuo |
| Limpeza A: código morto       | `code-simplification` + `safe-refactor`                  | `ponytail-audit` para uma segunda varredura                                                            | `simplify`                             | Plano de Limpeza, fase A                              | futuro   |
| Limpeza B e C: banco          | `migration` + `performance-optimization`                 | `deprecation-and-migration` para remoções                                                              | —                                      | Plano de Limpeza, fases B e C                         | futuro   |
| Limpeza D: app mais leve      | `performance-optimization` + `safe-refactor`             | `mattpocock-skills:improve-codebase-architecture` para dividir arquivos gigantes                       | —                                      | Plano de Limpeza, fase D                              | futuro   |
| Limpeza E: travas             | `ci-cd-and-automation` + `constraint-driven-development` | `documentation-and-adrs`                                                                               | —                                      | Plano de Limpeza, fase E                              | futuro   |
| Continuidade                  | notas do vault (`obsidian:obsidian-markdown`)            | `mattpocock-skills:handoff` ao fim de sessão longa                                                     | —                                      | Toda decisão ou fim de sessão                         | contínuo |

## Racional das escolhas

- **Não usar `graphify`/orientação pesada:** o projeto é grande, mas o vault já guarda arquitetura, decisões e achados medidos ("Stack Técnica", "Avaliação Geral"). Um grafo duplicaria o que já existe.
- **`migration` em todo o banco:** o histórico mostra que os riscos reais estavam no banco (regras de acesso, rotina que apagava responsáveis). O padrão de testar numa transação desfeita, simulando gestor e analista, vira regra.
- **`dataviz` no Painel da Liberação:** é um painel de tempos (espera por etapa); a skill garante gráficos legíveis nos temas claro e escuro, que o Nexus usa.
- **Revisão com `code-review` antes de cada merge:** o incidente de 16/10 (`run_worker_first` quebrando `/_serverFn`) teria sido pego por um teste de prévia mais amplo. A verificação na prévia agora cobre páginas, chamadas das telas e rotas de API.
- **`constraint-driven-development` só na fase E:** escrever o padrão antes da CI deixaria a regra sem trava.

## Desvios

| Data       | Fase            | Plano dizia               | Usado                                                                                 | Motivo                                                                                                                                                                  |
| ---------- | --------------- | ------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-23 | Visual (fase F) | `frontend-ui-engineering` | `redesign-existing-projects` (diagnóstico) + `ui-ux-pro-max` (estilo, paleta e fonte) | O pedido era só visual ("tirar a cara de front de IA"); essas duas cobrem diagnóstico e direção de design, e a `frontend-ui-engineering` foca construção de componentes |
