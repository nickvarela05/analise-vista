## Objetivo
Criar a tela **Unidades da Rede** alimentada com as 189 unidades da planilha de Osasco, com filtros, totalizadores inteligentes e exportação de relatório. Estrutura preparada para receber a coluna "Técnicos" no futuro.

## Escopo desta entrega
- Apenas a tela **Unidades da Rede**.
- Filtros de Polos na aba Equipe e coluna Técnicos ficam para depois (a estrutura de dados já contemplará isso).

## Dados (planilha)
189 registros, 6 colunas: `COD_UNIDADE`, `TIPO UNIDADE`, `UNIDADE`, `ZONA`, `ENDEREÇO`, `BAIRRO`.

- **Tipos:** CRECHE (47), CEMEI (41), ESCOLA PARCEIRA (31), EMEIEF (24), EMEF (21), EMEI (9), CEMEIEF (7), EMEF - INTEGRAL (4), ESPECIAL (5).
- **Zonas:** SUL (106), NORTE (69), CENTRO (13), NI (1).
- **Bairros:** 51 únicos.
- **Regra de negócio:** unidades `ESPECIAL` (5) **não entram** no totalizador geral — exibidas separadamente como "Departamentos".

## Backend (Lovable Cloud)

Tabela `unidades_rede`:
```
id uuid pk
cod_unidade text unique
tipo text             -- EMEI, CRECHE, ESPECIAL, etc.
nome text
zona text             -- SUL, NORTE, CENTRO, NI
endereco text
bairro text
tecnicos uuid[] default '{}'   -- preparado para o futuro
polo text             -- 'norte' | 'sul' | 'escritorio' | null (futuro)
created_at, updated_at
```
- RLS: leitura para `authenticated`; escrita restrita a admin/gestor (via `has_role`).
- Seed via migration: insere as 189 linhas a partir do parse do XLSX.

## Frontend

### Rota
`src/routes/unidades.tsx` + item no `AppSidebar` (ícone `Building2` ou `School`).

### Layout (UI/UX)
1. **PageHero** (componente existente) com:
   - Eyebrow "Rede Municipal", título "Unidades da Rede", descrição curta.
   - Tom **indigo/emerald** para diferenciar das outras telas.
   - **StatPills** topo: Total Escolas (sem ESPECIAL), Zona Sul, Zona Norte, Centro, Bairros, Departamentos (ESPECIAL).

2. **Faixa de totalizadores por tipo** (card horizontal scrollável):
   - Mini-cards por tipo (CRECHE 47, CEMEI 41, …) com contagem + barra de proporção tonal por tipo.
   - ESPECIAL aparece destacado com badge "não contabiliza no geral".

3. **Barra de filtros** sticky:
   - Busca livre (nome, código, endereço).
   - Select multi: **Tipo de unidade**.
   - Select multi: **Bairro** (combobox pesquisável — são 51).
   - Select: **Zona** (SUL/NORTE/CENTRO).
   - Botão "Limpar filtros" + chips dos filtros ativos.
   - Toggle de visualização **Tabela ↔ Cards**.
   - Botão **Exportar relatório**.

4. **Visualização padrão (Tabela)**:
   - Colunas: Código, Tipo (badge tonal por tipo), Unidade, Zona, Bairro, Endereço, Ações.
   - Linha clicável → drawer com detalhes completos + placeholder "Técnicos atendentes (em breve)".
   - Ordenação por coluna, paginação 25/50/100.

5. **Visualização Cards** (alternativa):
   - Grid responsivo (1/2/3 colunas) com cartões compactos: faixa colorida por tipo, nome, bairro, zona, endereço.

6. **Empty / loading states** consistentes com o resto do app (Skeleton + EmptyState).

### Exportação de relatório
Botão **Exportar relatório** com menu:
- **CSV** — respeita filtros ativos.
- **XLSX** — respeita filtros ativos, com aba de totalizadores (geral, por tipo, por zona, por bairro) — gerado via server function (`createServerFn`) usando `exceljs`.
- **PDF resumo** — opcional, posterior. (Por ora CSV + XLSX cobrem bem.)

Arquivos baixados pelo navegador a partir do retorno da server function (base64 → blob).

## Preparação para entregas futuras (não implementar agora)
- Campo `tecnicos uuid[]` já criado → coluna "Técnicos" será só uma view sobre dados existentes.
- Campo `polo` já criado → permitirá o filtro Escritório/Polo Norte/Polo Sul na Equipe.

## Arquivos previstos
- Migration: criar tabela + seed 189 linhas + RLS + grants.
- `src/routes/unidades.tsx`
- `src/components/unidades/UnidadesHero.tsx`
- `src/components/unidades/TotalizadoresTipo.tsx`
- `src/components/unidades/UnidadesFilters.tsx`
- `src/components/unidades/UnidadesTable.tsx`
- `src/components/unidades/UnidadesCards.tsx`
- `src/components/unidades/UnidadeDetailDrawer.tsx`
- `src/components/unidades/ExportarUnidadesMenu.tsx`
- `src/lib/unidades/unidades.functions.ts` (listar + exportar XLSX)
- Atualização do `AppSidebar.tsx` (novo item de navegação)

## Pergunta única (não bloqueante)
Posso seguir com **CSV + XLSX** como formatos de exportação? Se preferir incluir PDF, me avise antes da implementação.
