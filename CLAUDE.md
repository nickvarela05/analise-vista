# NEXUS — regras do repositório

Sistema interno da equipe de homologação: tarefas, Central, liberação em produção, reuniões, demandas, processos anuais, unidades e relatórios do n8n. Produção: https://nexus.nickvarela127.workers.dev

**Contexto completo, decisões e histórico ficam no vault** do Nickolas (`Memória do Nick/05-Projetos/NEXUS/`). As notas principais são "Stack Técnica", com os links de todos os painéis, "Melhorias e Correções", "Avaliação Geral (Out-2026)" e "Plano de Limpeza e Otimização (Out-2026)". Leia antes de mudar comportamento. Toda decisão nova é registrada lá, com data. O plano de skills está em `SKILLS-PLAN.md`.

## Stack
- TanStack Start em **modo SPA** no Cloudflare Workers (`wrangler.deploy.jsonc`). React Query e realtime do Supabase em `todo`.
- Supabase `toatihyfgqnrxwgotwrn`: Postgres com regras de acesso, pg_cron chamando funções com o `CRON_SECRET` do Vault, e funções no Deno (`supabase/functions`).
- Pacotes: **bun 1.2.15** (`npx -y bun@1.2.15 ...`), para manter o formato do `bun.lock`. O build no Cloudflare roda `bun install --frozen-lockfile`.

## Fluxo de trabalho
1. Branch → PR → prévia automática em `https://<branch-com-hífens>-nexus.nickvarela127.workers.dev` → o Nickolas testa e faz o merge → o Workers Builds publica o `main`.
2. **Não publicar produção pelo terminal.** Se o build automático falhar por limite da API (código 971), basta "Retry build" no painel.
3. As prévias **não** recebem os segredos de produção. Eles ficam na "Preview base config" (`wrangler preview base-config secret put`).
4. Antes de pedir o merge: `npx tsc --noEmit -p .`, `npx vitest run` e, na prévia, conferir páginas (navegação), uma chamada `/_serverFn/` (deve voltar JSON) e as rotas `/api` tocadas.
5. Funções do Supabase são publicadas por uma GitHub Action no merge.

## Regras que já quebraram produção
- **`run_worker_first`** (em `wrangler.deploy.jsonc`): navegações saem direto dos assets (SPA). Toda rota de servidor precisa estar na lista: hoje `/api/*` e `/_serverFn/*` (o MCP da Lovable saiu em 23/10/2026). Uma rota fora da lista recebe o `index.html` (incidente de 16/10/2026).
- **Banco:** mudança de estrutura ou de regra de acesso só com autorização explícita do Nickolas. Testar antes numa transação desfeita, simulando gestor e analista. Apagar dados de produção é decisão dele, comando por comando.
- **Migrações:** aplicadas pelo MCP do Supabase (`apply_migration`). Depois, o arquivo em `supabase/migrations/` é renomeado para a versão aplicada (`select version from supabase_migrations.schema_migrations`).
- **Papéis:** a equipe (quem tem linha em `user_roles`) faz o dia a dia; só gestor administra e exclui registros de outros (`is_equipe`, `has_role`).
- **Segredos:** nunca escrever valores em código, commits ou mensagens. Para valores de segredo, usar o painel do Cloudflare, porque colar no PowerShell grava só um caractere.

## Convenções
- Textos de tela, comentários e commits em português do Brasil.
- Comentários explicam o porquê e a data da decisão (ex.: "(19/10/2026)").
- Consultas pedem só as colunas usadas. Depois de uma ação numa tarefa, usar `atualizarTarefasNoCache` em vez de invalidar tudo de Tarefas.
- O fim de linha ainda está misturado (CRLF/LF): formatar só os arquivos tocados (`npx prettier --write <arquivos>`) até a fase A do Plano de Limpeza.
