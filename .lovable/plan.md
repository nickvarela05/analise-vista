
O usuário quer remover temporariamente a verificação de autenticação para testar livremente as telas sem precisar fazer login.

Estado atual:
- `AppLayout.tsx` redireciona para `/login` se não houver sessão e mostra spinner enquanto carrega
- `AppHeader.tsx` usa `user`, `role`, `signOut` do `useAuth()` para exibir avatar/email/role
- `auth-context.tsx` busca sessão e role do Supabase

Abordagem mínima e reversível:
1. **`src/components/AppLayout.tsx`**: remover o `useEffect` de redirect e o early return de loading/!session. Renderizar direto sidebar + header + conteúdo.
2. **`src/components/AppHeader.tsx`**: tornar tolerante à ausência de usuário — exibir um placeholder ("Convidado / dev") quando `user` for null, em vez de quebrar.
3. **Manter** `AuthProvider`, rota `/login` e toda a lógica do Supabase intactas — apenas o "guard" fica desativado. Assim, basta reverter 2 arquivos para religar.
4. Adicionar um aviso visual discreto no header ("Modo dev — auth desativada") para lembrar que está temporário.

Não vou mexer em RLS nem nas queries do Supabase — as páginas que dependem de dados podem retornar vazio (RLS bloqueia anônimo), mas a navegação e UI ficam livres para testar, que é o objetivo.

# Plano — Desativar verificação de login (modo dev)

## O que muda
- **`src/components/AppLayout.tsx`**: remover o redirect para `/login` e o gate de loading. O layout passa a renderizar sempre.
- **`src/components/AppHeader.tsx`**: tornar o menu de usuário tolerante a `user = null` (mostra "Convidado" + badge "dev"). Botão "Sair" só aparece se houver sessão real.
- **Adicionar banner discreto** no header: "Modo dev — autenticação desativada", para não esquecer de reativar.

## O que NÃO muda
- `AuthProvider`, `auth-context.tsx`, rota `/login`, schema, RLS e Supabase ficam exatamente como estão.
- Para reativar depois: basta restaurar o `useEffect` de redirect no `AppLayout`.

## Observação importante
As páginas continuam consultando o Supabase. Como as policies de RLS exigem usuário autenticado, listas podem aparecer vazias. Isso é esperado — você poderá navegar livremente pela UI, mas para testar dados reais ainda precisará logar normalmente. Se quiser que eu também afrouxe RLS para testes, me avise (não recomendado).
