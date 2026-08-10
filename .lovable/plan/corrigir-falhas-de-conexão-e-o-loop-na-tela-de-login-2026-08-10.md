# Corrigir falhas de conexão e o loop na tela de login

## Diagnóstico

O backend hospedado (banco de dados + autenticação) está **pausado**. Todas as chamadas de autenticação retornam "Failed to fetch" — inclusive as tentativas repetidas de renovar o token que aparecem no log a cada poucos segundos. Não é erro de validação de formulário nem de regra de negócio.

Como consequência, a tela `/login` entra em loop de atualização ("Maximum update depth exceeded"): cada tentativa de renovação falha, dispara um novo evento de autenticação, o provedor de sessão atualiza o estado e a tela repete o redirecionamento — sem parar, enquanto o backend estiver fora.

## O que será feito

1. **Reativar o backend** e confirmar que ele voltou saudável antes de qualquer outra coisa.
2. **Blindar a tela de login contra indisponibilidade**:
   - Trocar o redirecionamento por recarga total da página (`window.location.replace`) por navegação do roteador, executada uma única vez — evitando o ciclo de recarregar/checar/recarregar.
   - Exibir uma mensagem clara ("não foi possível conectar ao servidor, tente novamente em instantes") quando o erro for de rede, em vez da mensagem crua.
3. **Estabilizar o provedor de sessão** para que eventos repetidos de renovação com a mesma sessão não provoquem novas atualizações de estado — ignorando eventos cujo token é idêntico ao já armazenado.
4. **Verificar depois de reativado**: abrir o preview, confirmar que o login responde e que não há mais erros de conexão nem o aviso de loop no console.

## Detalhes técnicos

- `supabase--resume` seguido de `supabase--cloud_status` até `ACTIVE_HEALTHY`.
- `src/routes/login.tsx`: `finishLogin` passa a usar `navigate({ to, replace: true })` protegido por um `useRef` de "já redirecionou"; tratamento de `AuthRetryableFetchError` / `Failed to fetch` no `onLogin` e `onSignup`.
- `src/lib/auth-context.tsx`: no `syncAuth`, retornar cedo quando `newSession?.access_token` for igual ao token atual e não for o carregamento inicial, evitando `setSession` desnecessário a cada `TOKEN_REFRESHED`.
- Nenhuma alteração de schema, política de acesso ou lógica de negócio.
