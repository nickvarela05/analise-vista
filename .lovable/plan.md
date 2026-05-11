## Problema

Quando o usuário muda de aba e volta:
1. O Supabase dispara `TOKEN_REFRESHED` em `onAuthStateChange`.
2. O `AuthProvider` (em `src/lib/auth-context.tsx`) executa `syncAuth`, que sempre chama `setLoading(true)` enquanto re-busca `role` e `must_change_password`.
3. O `AppLayout` (em `src/components/AppLayout.tsx`) mostra um spinner enquanto `loading === true`, **desmontando toda a árvore de filhos**.
4. O diálogo aberto (Nova Demanda, Nova Tarefa, etc.) é destruído junto com tudo o que foi digitado.

## Correção

Ajustar `AuthProvider` para que o `loading = true` só aconteça no **carregamento inicial** (quando ainda não há sessão conhecida). Refreshes silenciosos de token não devem disparar tela de loading.

Mudanças em `src/lib/auth-context.tsx`:

- Manter `setLoading(true)` apenas na primeira sincronização (mount).
- Nos eventos seguintes (`TOKEN_REFRESHED`, `USER_UPDATED`), atualizar `session` e re-buscar `role`/`must_change_password` em segundo plano, **sem** alternar o `loading` global.
- Em `SIGNED_OUT`, limpar estado normalmente (não precisa de loading).
- Em `SIGNED_IN` real (login novo), também não precisa setar loading porque a tela de login já está visível.

Resultado: o `AppLayout` continua renderizando os filhos durante refreshes de token → diálogos abertos permanecem abertos com os dados digitados intactos.

## Escopo

- Apenas `src/lib/auth-context.tsx`. Sem mudanças em diálogos, rotas, ou React Query.
- Sem alteração de comportamento de logout, login, ou troca de senha obrigatória.

## Validação

1. Abrir "Nova demanda", preencher campos.
2. Trocar para outra aba/janela por 30s+.
3. Voltar — o diálogo deve continuar aberto com os dados.
4. Verificar que login/logout continuam funcionando normalmente.
5. Verificar que o redirecionamento para `/alterar-senha` ainda funciona quando aplicável.