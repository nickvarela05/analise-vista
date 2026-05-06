## Diagnóstico

### 1. Geração do DOCX (gargalo principal: a IA)

A função `gerar-relatorio-reuniao` gasta a maior parte do tempo aguardando a resposta do **Gemini 2.5 Pro** (modelo "pesado"). A montagem do `.docx` em si é rápida (milissegundos). Outros pontos a otimizar:

- Modelo `google/gemini-2.5-pro` é ~3-5x mais lento que `gemini-2.5-flash` para esse tipo de tarefa.
- Transcrição enviada à IA é cortada em **80.000 caracteres** — quanto maior o input, maior a latência.
- Resposta é gerada de uma única vez (não há streaming), então o usuário só recebe o arquivo no fim.
- A logo é decodificada de base64 a cada chamada (custo pequeno, mas evitável).

### 2. Loading das páginas

Hoje quase tudo é buscado **no cliente** com `useQuery` após o componente montar. Isso causa o "spinner inicial" em cada navegação. Pontos observados:

- Páginas como `/relatorios`, `/portfolio`, `/equipe`, `/reunioes` carregam dados via `useQuery` no `mount`, sem usar `loader` do TanStack Router → sem prefetch nem SSR.
- `defaultPreloadStaleTime: 0` no router.tsx desativa cache de preload — cada hover refaz fetch.
- Não há `defaultPreload: "intent"` configurado, então links não fazem prefetch ao passar o mouse.
- Sem `staleTime` agressivo nas queries → refetch frequente.
- Bundle grande: tudo importado eagermente em cada rota (lucide icons, dialogs, etc.) — code-splitting automático ajuda, mas algumas rotas (`reunioes.tsx` com 1251 linhas) importam muito ao subir.

---

## Plano de mudanças

### A. Acelerar o DOCX

1. **Trocar o modelo** para `google/gemini-2.5-flash` em `supabase/functions/gerar-relatorio-reuniao/index.ts`. Mantém qualidade analítica boa, mas com latência ~3x menor. Manter `2.5-pro` opcional via parâmetro `{ modelo: "pro" }` no body para casos críticos.
2. **Reduzir o teto da transcrição** de 80.000 para 40.000 caracteres (suficiente para reuniões de até ~4h transcritas; reduz tempo de prompt). Adicionar truncamento inteligente (cortar pelo meio, mantendo início e fim).
3. **Cache da logo**: mover `LOGO_BYTES` para escopo de módulo (já está) — confirmar; e não recodificar a cada request.
4. **Toast de progresso no front**: na chamada do front, mostrar toast com "Gerando relatório (pode levar até 30s)…" e desabilitar o botão para sensação de responsividade.
5. **Opcional (futuro)**: cachear o markdown gerado pela IA na tabela `reuniao` (coluna `relatorio_md`) — se já gerado e a reunião não mudou, regenerar só o `.docx` (instantâneo) sem chamar a IA de novo.

### B. Reduzir loading das páginas

1. **Configurar prefetch global** em `src/router.tsx`:
   - `defaultPreload: "intent"` (prefetch ao passar o mouse sobre um `<Link>`)
   - `defaultPreloadStaleTime: 30_000` (reaproveita prefetch dentro de 30s)
2. **Usar `loader` + `queryClient.ensureQueryData` nas rotas principais** (`/reunioes`, `/relatorios`, `/portfolio`, `/equipe`, `/demandas`, `/tarefas`, `/atividades`):
   - O loader dispara a query antes do componente montar → quando a tela renderiza, os dados já estão (ou estão sendo) carregados em paralelo com o JS chunk.
   - `useQuery` no componente continua igual, mas o cache já está quente.
3. **Aumentar `staleTime`** das queries de 30s para 60-120s (dados não mudam tanto), eliminando refetches desnecessários ao voltar para a página.
4. **Skeleton states leves** em vez de tela em branco / spinner central nas páginas com loader.
5. **Remover queries duplicadas** em `reunioes.tsx` se houver (auditar) e mover componentes pesados de Dialog para arquivos separados (lazy import com `React.lazy` ou simples extração de arquivo) para reduzir o bundle inicial da rota.

### C. Itens técnicos detalhados

**Arquivos a editar:**
- `supabase/functions/gerar-relatorio-reuniao/index.ts` — trocar modelo, reduzir cap de transcrição, aceitar `{ modelo }` opcional.
- `src/router.tsx` — `defaultPreload: "intent"`, `defaultPreloadStaleTime: 30_000`, `staleTime: 60_000` no QueryClient.
- `src/routes/reunioes.tsx`, `src/routes/relatorios.tsx`, `src/routes/portfolio.tsx`, `src/routes/equipe.tsx`, `src/routes/demandas.tsx`, `src/routes/tarefas.tsx`, `src/routes/atividades.tsx` — adicionar `loader` que faz `ensureQueryData` da consulta principal.
- (Opcional) `src/routes/reunioes.tsx` — extrair `ReuniaoDialog` e `ReuniaoDrawer` para arquivos próprios para code-splitting.

### Resultado esperado

- DOCX: de ~25-40s para ~8-15s (apenas trocando o modelo e reduzindo input).
- Navegação entre páginas: spinner inicial sumindo em ~80% dos casos (prefetch on hover) e dados aparecendo "instantaneamente" em revisitas (cache + staleTime).

Quer que eu siga **com tudo**, ou prefere começar só pela parte A (DOCX) para já sentir a melhora antes do refactor de loaders?