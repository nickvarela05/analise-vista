
# Plano de Fortificação Estrutural

**Premissa inegociável:** nenhum comportamento visual, fluxo de usuário, rota ou regra de negócio muda. Toda refatoração é *behavior-preserving*. Cada etapa é validada visualmente antes de avançar.

---

## Objetivos
1. Reduzir superfície de re-render e processamento redundante.
2. Isolar regras de negócio em módulos puros (testáveis, reutilizáveis).
3. Centralizar acesso a dados (queryKeys, hooks, invalidations).
4. Eliminar código morto e duplicações.
5. Padronizar tratamento de erro/loading sem alterar UI.

---

## Etapa 1 — Limpeza segura (risco zero)
- Remover `src/server/n8n-db.functions.ts` e `src/server/n8n-db.server.ts` (tela "Inspeção N8N" já foi excluída).
- Remover ícone `Database` órfão e quaisquer imports residuais.
- Procurar e remover imports não utilizados em todo `src/` (sem reformatar arquivos).
- **Validação:** build limpo + navegação por todas as rotas sem mudança visual.

## Etapa 2 — Camada de domínio pura (`src/lib/domain/`)
Extrair funções já existentes (atualmente inline em rotas/componentes) para módulos puros, mantendo a mesma assinatura lógica:

```text
src/lib/domain/
  cargos.ts        // cargoElegivel, agrupamentos, labels
  copa.ts          // janela 30 min, detecção de conflito, capacidade
  atividades.ts    // isMine, filtroEscopo, agregações por colaborador
  kpis.ts          // contadores de tarefas/demandas/reuniões/relatórios
  datas.ts         // helpers date-fns reutilizados (semana, range, fmt)
```

Regras: funções **puras**, sem React, sem Supabase. Os componentes passam a importar dessas libs em vez de redefinir inline. Sem mudança de saída.

## Etapa 3 — Data layer centralizada (`src/hooks/queries/`)
Hoje cada rota chama `supabase.from(...).select(...)` direto. Vamos consolidar **sem alterar o que é exibido**:

```text
src/lib/queries/
  keys.ts                  // queryKeys factory (única fonte de verdade)
src/hooks/queries/
  useColaboradores.ts
  useTarefas.ts
  useDemandas.ts
  useReunioes.ts
  useRelatorios.ts
  useChamados.ts
  useAvisos.ts
```

- Cada hook retorna exatamente os mesmos dados que o componente já consome.
- `staleTime` razoável (30–60 s) para cortar refetch redundante quando o usuário navega entre abas.
- Invalidations passam a usar as chaves do `keys.ts` (evita strings espalhadas).
- Para KPIs do dashboard, usar `select` granular ou `count: 'exact', head: true` quando só precisamos da contagem — corta payload sem mudar o número exibido.

## Etapa 4 — Quebra dos arquivos-monolito
Apenas **mover** blocos para sub-componentes/seções, sem reescrever JSX. Cada split é commitado e validado visualmente.

| Arquivo (LOC) | Decomposição proposta |
|---|---|
| `routes/index.tsx` (1.392) | `dashboard/` → `KpisSection`, `MinhasAtribuicoesSection`, `AtribuicoesPorColaboradorChart`, `AtividadesSemanais` |
| `routes/reunioes.tsx` (1.251) | `reunioes/` → `ReunioesList`, `ReuniaoDetail`, `ReuniaoForm`, hook `useReuniaoUploader` (já parcial) |
| `routes/tarefas.tsx` (636) | usar `TarefaKanban`/`TarefaFilters` existentes; extrair `TarefasHeader` e `useTarefasView` |
| `equipe/EquipeUsuariosView.tsx` (716) | `usuarios/` → `UsuariosTable`, `UsuariosFilters`, `useUsuariosActions` |
| `equipe/GestaoCopaView.tsx` (517) | `copa/` → `CopaBoard`, `CopaSlot`, `CopaConflictAlert` + `lib/domain/copa.ts` |

Regras:
- Nada de renomear classes Tailwind, tokens, textos ou ordem visual.
- Cada novo componente recebe props tipadas (sem `any`).
- Componentes de lista que recebem o mesmo objeto repetidamente passam a `React.memo` + comparator simples por id.

## Etapa 5 — Otimização de renderização
- Substituir `useState` derivados por `useMemo` quando o valor depende só de props/estado existentes (alguns lugares já fazem isso; padronizar).
- Selects granulares no React Query: `useQuery({ select: (d) => d.length })` para KPIs em vez de pegar o array inteiro.
- `useCallback` apenas onde o handler entra em props de componente memoizado (evitar overuse).
- Listas longas (Equipe/Atividades): adicionar `key` estável e `React.memo` no item — ganho real, zero impacto visual.
- `defaultPreloadStaleTime: 0` confirmado no router (evita cache duplo Router+Query).

## Etapa 6 — Tratamento de erro/loading padronizado
- `errorComponent` + `pendingComponent` por rota com **exatamente** o mesmo skeleton/empty state já usado hoje (apenas movido para slot oficial do TanStack Router).
- Hook `useToastError(error)` único para padronizar toast em mutations (mensagens preservadas).

## Etapa 7 — Tipagem e segurança
- Eliminar os 4 `any` residuais em `routes/api.admin.usuarios.ts` com tipos derivados de `Database`.
- Auditar `requireGestor` em todos os handlers `api.admin.*` (apenas leitura, sem mudança de comportamento se já estiverem corretos).
- Confirmar RLS continua intocada (não há migration nesta refatoração).

## Etapa 8 — Rede de segurança mínima (testes)
Adicionar **Vitest** apenas para o domínio puro extraído na Etapa 2 (não testes de UI):
```text
src/lib/domain/__tests__/
  copa.test.ts        // janela 30 min, capacidade 3, conflitos
  cargos.test.ts      // estagiário TI vs estagiário, gestor, analista
  atividades.test.ts  // isMine, filtroEscopo
  kpis.test.ts        // agregações
```
Isso protege as regras que mais sofreram iteração recente, sem tocar componentes.

---

## Ordem de execução e validação

```text
Etapa 1  → build OK + navegação visual            (1 commit)
Etapa 2  → domínio extraído, comportamento igual  (1 commit por módulo)
Etapa 8  → testes do domínio passando             (junto com Etapa 2)
Etapa 3  → hooks de query, 1 entidade por vez     (1 commit por entidade)
Etapa 4  → split de monolitos, 1 arquivo por vez  (1 commit por arquivo)
Etapa 5  → memos/selects                          (1 commit)
Etapa 6  → error/pending boundaries               (1 commit)
Etapa 7  → tipagem fina + auditoria               (1 commit)
```

Critério de aceitação por commit: **diff visual = 0** (mesmas telas, mesmos textos, mesmas interações, mesmas requisições à API ou menos).

---

## Ganhos esperados (mensuráveis)
- LOC nas rotas-monolito: **−50 a −65 %** (movido, não apagado).
- Re-renders no dashboard ao trocar filtro: **−40 a −60 %** (memo + select granular).
- Payload do dashboard: redução proporcional ao uso de `count: head` em KPIs.
- Bundle inicial: ligeira redução pela remoção de `n8n-db.*` e imports órfãos.
- Tempo para adicionar nova feature em rota refatorada: significativamente menor.

## O que **NÃO** será feito neste plano
- Nenhuma alteração de design, cor, espaçamento, componente shadcn ou copy.
- Nenhuma mudança em RLS, tabelas ou edge functions.
- Nenhuma migração para outra lib (mantém TanStack Query, Router, Supabase).
- Nenhuma reescrita de drawers/dialogs grandes — apenas extração de hooks de form quando trivial e seguro.

---

Posso executar **Etapa 1 + Etapa 2 + Etapa 8** em uma primeira leva (limpeza + domínio puro + testes), que é a parte de maior valor com risco praticamente nulo. Aprova começar por aí?
