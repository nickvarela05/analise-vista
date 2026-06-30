# Phase 1 — Auditoria Técnica (somente leitura)

Nenhum arquivo foi alterado. Abaixo está o relatório estruturado. Aguardo seu OK antes de iniciar a Phase 2.

## 1. Visão arquitetural

- **Stack**: TanStack Start v1 (SSR/edge) + React 19 + Vite 7 + Tailwind v4 + Supabase (Lovable Cloud) + TanStack Query + Zustand + Zod + shadcn/ui.
- **Roteamento**: file-based em `src/routes/` (16 rotas de página + `api.admin.usuarios.ts`). Layout raiz em `__root.tsx`, layout autenticado via `AppLayout`.
- **Backend**: Supabase (RLS), Edge Functions em `supabase/functions/` (transcrever-reuniao, analisar-transcricao, gerar-relatorio-reuniao, gerar-resumo-semanal, dispatch-email-digest, busca-natural). Server functions TanStack em `src/lib/*.functions.ts` e `src/server/`.
- **Domínios**: equipe, tarefas, demandas, reuniões (com áudio/transcrição), avisos, relatórios, portfólio, unidades, atividades, insights, dashboard.
- **Estado**: TanStack Query para servidor; Zustand para uploads em background; React Context para auth/tema.

```text
src/
├── assets/
├── components/          (UI primitivas em ui/, restante por domínio na raiz)
│   ├── ui/              shadcn
│   ├── dashboard/, equipe/, tarefas/, demandas/, reunioes/, avisos/, ...
│   └── shared/
├── hooks/               (apenas use-mobile)
├── integrations/supabase/   (auto-gerado — não tocar)
├── lib/                 (auth-context, theme-provider, utils, domínios, queries, helpers)
├── routes/              (páginas + api.admin.usuarios.ts)
├── server/              (admin-auth.server.ts)
├── router.tsx, start.ts, styles.css
```

## 2. Qualidade de código

| Achado | Evidência | Impacto |
|---|---|---|
| **Rotas “god file”** | `reunioes.tsx` 1419 linhas, `unidades.tsx` 1077, `relatorios.tsx` 899, `atividades.tsx` 647, `demandas.tsx` 583, `portfolio.tsx` 558, `index.tsx` 474, `avisos.tsx` 463, `insights.tsx` 454, `tarefas.tsx` 377 | Difícil manutenção, re-renders amplos, busca lenta. 13 arquivos > 400 linhas. |
| **Componentes grandes** | `TarefaDrawer.tsx` 713, `AnalyticsCards.tsx` 560, `GestaoCopaView.tsx` 505, `MinhasAtribuicoesDialog.tsx` 485, `ImportarTarefasDialog.tsx` 484, `ColaboradorDrawer.tsx` 476, `AvisoDialog.tsx` 453 | Lógica de negócio acoplada a JSX. |
| **`any` espalhado** | 110 ocorrências `: any`/`<any>`/`as any` em `src/**` | Perde type-safety. Maior parte em handlers Supabase/erro. |
| **Idioma misto** | Domínio em PT-BR (`reuniao`, `colaborador`, `tarefa`) + utilitários/infra em EN (`startUploadJob`, `phase`, `abort`). Recomendado manter **PT-BR para domínio** e **EN para infra/genéricos** — formalizar isso. | Inconsistência menor; já é o padrão de facto. |
| **Convenção de arquivo mista** | `lib/` usa kebab-case (`reuniao-upload-manager.ts`) e camelCase (`bairros.ts`); `components/` usa PascalCase corretamente. | Padronizar para kebab-case em utilitários. |
| **`audio-compress.ts` parcialmente morto** | 447 linhas; após a remoção da compressão, apenas `formatBytes` é importado. Resto (WebCodecs + ffmpeg.wasm) virou dead code. | Bundle desnecessário, risco de import acidental do ffmpeg. |
| **`console.warn/error` em produção** | 8 ocorrências (audio-compress, upload-manager). | OK para erros, mas sem logger central. |
| **Magic strings/numbers** | `MAX_UPLOAD_BYTES = 25*1024*1024` repetido em UI e manager; status (`processando`, `done`) espalhados; tipos de evento; constantes de UI inline. | Já há alguns enums em `lib/types`, mas inconsistente. |
| **Ausência de JSDoc** | Funções/componentes em grande maioria sem doc-comment. Poucos arquivos comentam o “porquê”. | Onboarding lento. |
| **Sem testes além de domínio** | Só `lib/domain/__tests__/` (atividades, cargos, copa). UI/server sem testes. | Refactors mais arriscados. |

## 3. Segurança

| Item | Status | Observação |
|---|---|---|
| Secrets em código | ✅ OK | `.env` contém apenas chaves publishable; nada de service role no client. |
| RLS / GRANTs | ⚠️ A verificar | Recomendo rodar o security scan da Lovable Cloud para confirmar grants em todas as tabelas `public.*`. |
| Roles client-side | ✅ OK | `user_roles` separada + `has_role` (visto em `admin-auth.server.ts` e edge functions). |
| Validação de input | ⚠️ Parcial | Server functions usam Zod (`inputValidator`), mas vários formulários do client (dialogs de tarefa, demanda, aviso, colaborador) não declaram schemas Zod centralizados — usam `react-hook-form` direto. |
| Edge functions CORS | ✅ OK | `_shared/cors.ts` com allowlist (lovable.app/project + localhost). |
| `requireGestor` / `requireSupabaseAuth` | ✅ Aplicado | server-side correto. Verificar todas as rotas protegidas (Phase 4). |
| `api.admin.usuarios.ts` | ⚠️ Revisar | É `/api/admin/...`, não `/api/public/...`; precisa garantir que valida `requireGestor` em todos os métodos. |
| Exposição de stack trace | ⚠️ Parcial | Alguns `toast.error(e.message)` repassam mensagem crua do backend; aceitável, mas não inclui stack. |
| Tipos `any` em handlers | ⚠️ Médio | Reduz checagem de payloads externos. |

## 4. Performance

| Achado | Severidade |
|---|---|
| Rotas grandes sem `React.lazy` por seção (dialogs/drawers carregados junto com a página) | Médio |
| `audio-compress.ts` importa `@ffmpeg/ffmpeg` (e baixa core do CDN). Após a remoção da compressão, o import permanece via `formatBytes` — basta `formatBytes` ser realocado e o pacote pode sair do bundle. | **Alto (bundle)** |
| Falta de `useMemo`/`useCallback` em listas grandes (tarefas, demandas, equipe) — re-renders prováveis | Médio |
| Queries TanStack sem `staleTime` consistente entre páginas (a confirmar por arquivo) | Baixo/Médio |
| `exceljs` + `xlsx` + `jspdf` + `jspdf-autotable` carregados estaticamente em relatórios — candidatos a dynamic import | Médio |
| `recharts` em dashboard/insights sem code-split | Médio |
| Imports `lucide-react` por nome já são tree-shakeable (OK) | — |

## 5. Melhorias propostas (priorizadas)

Legenda risco: 🟢 Safe · 🟡 Needs Testing · 🔴 Risky

### Critical
1. 🟢 **Remover dead code de compressão de áudio** — mover `formatBytes` para `src/lib/utils.ts` (ou `format-bytes.ts`), deletar `audio-compress.ts`, remover `@ffmpeg/ffmpeg` e `@ffmpeg/util` do `package.json`. Reduz bundle e risco de bugs futuros. *(Toca 3 arquivos, dentro do limite.)*
2. 🟡 **Centralizar constantes de upload** (`MAX_UPLOAD_BYTES`, mensagens) em `src/constants/upload.ts`.

### High
3. 🟡 **Quebrar `routes/reunioes.tsx` (1419 linhas)** em subcomponentes (`ReunioesList`, `ReuniaoFiltros`, `ReuniaoDialog`, hooks `useReunioesData`) — sem mudar comportamento. *Mais de 3 arquivos: vou propor como PR isolado para sua aprovação.*
4. 🟡 **Quebrar `routes/unidades.tsx` (1077)** e `relatorios.tsx` (899) seguindo mesmo padrão. *Idem — proposta separada.*
5. 🟡 **Substituir `any` por tipos** começando por handlers de erro (`(e: any)` → `(e: unknown)` + narrow). 110 ocorrências; abordagem incremental.
6. 🟡 **Dynamic import de libs pesadas em relatórios** (`exceljs`, `xlsx`, `jspdf*`) — `await import(...)` dentro do handler de export.

### Medium
7. 🟢 **Padronizar nomenclatura de arquivos `lib/`** para kebab-case (já é maioria). Renomear apenas o que destoa.
8. 🟢 **Adicionar JSDoc** em componentes públicos de domínio, hooks e services (incremental, sem mudar código).
9. 🟡 **Extrair schemas Zod centralizados** por domínio em `src/lib/schemas/` e plugar nos formulários (`zodResolver`), espelhando o que o server já valida. Risco médio porque mexe em forms reais.
10. 🟢 **Documentar o store de uploads** (`reuniao-upload-manager.ts`) e o fluxo Auth (`auth-context.tsx`).
11. 🟡 **Memoização pontual** em listas de tarefas/demandas/equipe (cards) após medir.
12. 🟢 **`React.lazy` em rotas pesadas** (`insights`, `relatorios`, `reunioes`) — TanStack Router já faz code-split por rota, então o ganho real estaria em **lazy de dialogs/drawers grandes** dentro das rotas.

### Low
13. 🟢 **Padronizar `staleTime`** via `defaultOptions` no QueryClient.
14. 🟢 **Remover `console.warn` órfãos** depois que `audio-compress.ts` for deletado.
15. 🟢 **Adicionar `tsconfig` check** de `noUnusedLocals`/`noUnusedParameters` se ainda não estiverem ligados.
16. 🟢 **Atualizar memory `mem://index.md`** com convenções definidas (idioma, naming, estrutura).

## Itens explicitamente **não** vou tocar (alto risco / fora de escopo)
- Arquivos auto-gerados: `src/integrations/supabase/*`, `src/routeTree.gen.ts`, `.env`, `supabase/config.toml`.
- Schemas de auth/storage/realtime no Supabase.
- Estrutura de rotas (renomear rota = URL diferente = breaking).
- Edge functions já em produção — só docs/comentários, sem alterar lógica.

## Ambiguidades a esclarecer antes da Phase 2

1. **Idioma**: confirma manter PT-BR para domínio + EN para infra (padrão atual), ou prefere unificar tudo em PT-BR?
2. **Estrutura de pastas que você propôs** (`services/`, `constants/`, `types/`, `pages/`): o template TanStack **exige** `src/routes/` (não `src/pages/`). Posso adotar `services/`, `constants/`, `types/`, `context/` mantendo `routes/` como está — confirma?
3. **Escopo da Phase 2**: faço **tudo de uma vez** ou prefere PR por prioridade (Critical → High → Medium → Low) com sua aprovação entre etapas? Recomendo **incremental** dado o tamanho da base (176 arquivos TS/TSX, ~26 mil linhas).
4. **Quebrar arquivos > 400 linhas**: posso prosseguir nos High (rotas god-file) ou prefere revisar a divisão proposta antes?

## Deliverables Phase 1
- [x] Resumo da arquitetura
- [x] Lista de issues de qualidade, segurança, performance
- [x] Propostas priorizadas com risco
- [x] Itens fora de escopo documentados
- [x] Perguntas em aberto

Aguardando seu **go-ahead** + respostas às 4 perguntas acima para iniciar a Phase 2.
