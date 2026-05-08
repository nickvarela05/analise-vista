## Diagnóstico do card "Workflow de chamados"

Verifiquei os números no banco e a lógica do componente. Resumo: **os números exibidos batem com os dados atuais**, mas a **modelagem do workflow está desalinhada** com o fluxo real definido no sistema, então o card pode ficar enganoso conforme o uso aumentar.

### Estado atual no banco
- `chamado_externo`: 0 registros (por isso Aberto/Encaminhado/Finalizado = 0).
- `todo`: 1 registro com status `producao` (por isso Produção = 1, restante = 0).

### Problemas encontrados

**1. Linha "Tarefas internas (workflow Sisteplan)" está desatualizada**

O fluxo oficial definido em `src/components/tarefas/lib/workflow.ts` é:

```text
aberta → em_andamento → homologacao → (aprovado | aprovado_ressalvas | reprovado) → producao
```

Mas o card mostra apenas: **Abertura · Encaminhada · Homologação · Produção · Concluída**.

Consequências:
- "Encaminhada" (`encaminhada`) é status **legado** — nunca é gravado pelo fluxo novo. Sempre será 0.
- "Concluída" (`concluida`) também é legado. Sempre será 0.
- Faltam estados reais: **Em desenvolvimento/Teste interno** (`em_andamento`), **Aprovado**, **Aprovado c/ ressalvas**, **Reprovado**.
- "Abertura" hoje soma `aberta + pendente`, o que está ok como compatibilidade.

**2. Card de "Encaminhado" do bloco superior tem nome enganoso**

A prop chama-se `relatEncaminhados` e o card abre `/relatorios`, sugerindo que viria de "solicitações de relatórios" (tabela do n8n). Na prática ele filtra `chamados.filter(c => c.status === "encaminhado")`. Está coerente com `chamado_externo` (o enum existe), só o nome da variável engana.

**3. Filtros locais em vez de count no banco**

Os números são calculados em memória sobre todos os registros baixados (`select *` em `chamado_externo` e `todo`). Funciona com volume pequeno, mas escala mal.

### Plano de correção

1. **Atualizar a linha "Tarefas internas" para refletir o workflow real**, com os passos:
   - Aberta (`aberta` + `pendente`)
   - Em desenvolvimento/Teste interno (`em_andamento`)
   - Homologação (`homologacao`)
   - Aprovado (`aprovado` + `aprovado_ressalvas`) — opcionalmente separar em duas colunas
   - Reprovado (`reprovado` + `reprovada`)
   - Produção (`producao` + `concluida` legado)
   
   Remover as colunas "Encaminhada" e "Concluída" (ou deixar só uma, agregada como compat).

2. **Renomear `relatEncaminhados` → `chamadosEncaminhados`** em `src/routes/index.tsx` e na prop do `WorkflowChamadosPanel`, para refletir que o dado vem de `chamado_externo`.

3. (Opcional) Trocar os `filter(...).length` por `count: 'exact'` agrupado por status no Supabase (uma query por agregação) — só vale a pena quando o volume crescer.

### Pergunta antes de implementar

Antes de codar, preciso confirmar com você:

- Você quer **mostrar todos os passos do novo workflow** (incluindo Em desenvolvimento, Aprovado, Aprovado c/ ressalvas, Reprovado), ou prefere **agrupar** alguns para o card não ficar com 7 colunas?
- Devo manter "Concluída" como compat (somando ao Produção) ou removê-la totalmente?