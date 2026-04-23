

## Refator completo da tela `/equipe`

### 1. Backend — nova tabela `colaborador_evento`

```sql
CREATE TYPE evento_tipo AS ENUM ('folga','falta','atestado','atraso','ferias_avulso');

CREATE TABLE public.colaborador_evento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.colaborador(id) ON DELETE CASCADE,
  tipo evento_tipo NOT NULL,
  data date NOT NULL,
  hora_inicio time,        -- usado quando tipo = 'atraso' (chegou às X)
  hora_fim time,           -- usado quando tipo = 'atraso' (deveria ter chegado às Y)
  observacao text,
  anexo_url text,          -- comprovante (atestado médico etc.)
  registrado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (colaborador_id, data, tipo)
);

ALTER TABLE public.colaborador_evento ENABLE ROW LEVEL SECURITY;
```

**RLS** (espelhando o padrão das outras tabelas):
- `SELECT` para `authenticated`: `true` (equipe inteira vê — necessário pra grade funcionar)
- `INSERT/UPDATE/DELETE`: `has_role(auth.uid(), 'gestor')` apenas
- Trigger `update_updated_at_column` no UPDATE

**Bucket de Storage** novo: `colaborador-eventos` (privado) pra anexos de atestado, com policy de leitura/upload pra `gestor` apenas.

**`colaborador_ferias` continua existindo** — ela representa **períodos** longos (>1 dia). `colaborador_evento` cuida dos **eventos pontuais por dia**.

---

### 2. Permissões da rota — restringir `/equipe` a gestor

- `analista` **não vê o link** "Equipe" no `AppSidebar` e **não consegue abrir** `/equipe` (redirect pra `/` com toast).
- A página `/portfolio` continua aberta a todos (visão pública resumida da equipe).

Implementação: guard inline no componente `Equipe` checando `role !== 'gestor'`.

---

### 3. Refator da UI — 3 visualizações + KPIs

**Header da página** (sempre visível):

```
┌─────────────────────────────────────────────────────────────────┐
│  Equipe                          [+ Novo colaborador]           │
│  Gerencie disponibilidade, eventos e férias                     │
├─────────────────────────────────────────────────────────────────┤
│  [Ativos: 12] [Trabalhando agora: 8] [Em almoço: 2]            │
│  [Em férias hoje: 1] [Eventos esta semana: 5]                  │
└─────────────────────────────────────────────────────────────────┘
```

KPIs calculados client-side a partir do snapshot atual de `colaborador + colaborador_horario + colaborador_ferias + colaborador_evento`.

**Tabs principais** (radix Tabs, persistido em URL search param `?view=lista|grade|calendario`):

#### Tab 1 — Lista (default)
Tabela densa com:

| Avatar | Nome / Cargo | Status agora 🟢 | Hoje (expediente) | Próx. evento | Ações |

- **Status agora**: badge calculado em tempo real:
  - 🟢 **Trabalhando** (dentro do expediente, fora da janela de almoço, sem evento ativo)
  - 🟡 **Em almoço** (dentro da janela de almoço)
  - 🔵 **Férias** (dentro de período de `colaborador_ferias`)
  - 🟠 **Atestado / Folga / Falta** (evento de hoje)
  - ⚫ **Fora do expediente**
- Busca por nome (input no topo da tab)
- Filtro por status (multi-select)
- Clique na linha → abre **drawer lateral** (Sheet do shadcn) com:
  - Foto grande, nome, cargo, e-mail, bio (editáveis)
  - Sub-tabs: **Horário semanal** · **Eventos** · **Férias** · **Bio**
  - Ações: editar, desativar (soft delete via `ativo = false`), trocar foto

#### Tab 2 — Grade semanal (disponibilidade)
Visualização tipo Gantt simplificado: linhas = colaboradores ativos, colunas = Dom→Sáb.
Cada célula renderiza uma barra horizontal mostrando:
- Bloco azul claro = expediente
- Bloco amarelo dentro = janela de almoço
- Strip cinza = fora do expediente
- Overlay vermelho/laranja = evento (atestado/folga/falta) naquele dia
- Overlay azul = férias

Header da grade tem nav "Semana anterior / Semana atual / Próxima semana".

#### Tab 3 — Calendário mensal (eventos + férias)
Grid de mês (estilo Google Calendar simplificado):
- Cada dia mostra chips compactos com `[avatar] tipo` (ex: "🟠 João Atestado")
- Cores consistentes com o sistema de status
- **Clicar em qualquer célula (dia)** abre popover **"Registrar evento"**:
  - Select colaborador
  - Select tipo (folga, falta, atestado, atraso, ferias_avulso)
  - Date (preenchido pelo clique)
  - Se `atraso`: campos hora_inicio + hora_fim
  - Observação (textarea)
  - Upload de anexo (só pra atestado, opcional)
  - Botão "Registrar"
- Nav "Mês anterior / Atual / Próximo"
- Botão **"Exportar CSV"** do mês (relatório de absenteísmo)

---

### 4. Componentização (refator do arquivo de 338 linhas)

Quebrar `src/routes/equipe.tsx` (que vai crescer muito) em:

```
src/routes/equipe.tsx                          # rota + guard de role + tabs container
src/components/equipe/
├── EquipeKpis.tsx                             # tira KPIs do header
├── EquipeListaView.tsx                        # tab Lista (tabela + busca + filtro)
├── EquipeGradeView.tsx                        # tab Grade semanal
├── EquipeCalendarioView.tsx                   # tab Calendário mensal
├── ColaboradorDrawer.tsx                      # Sheet lateral com sub-tabs
├── ColaboradorStatusBadge.tsx                 # badge calculado de status atual
├── NovoColaboradorDialog.tsx                  # form de criar (extraído do atual)
├── HorarioDialog.tsx                          # mantido, movido pra cá
├── FeriasDialog.tsx                           # mantido, movido pra cá
├── EventoPopover.tsx                          # popover de registrar evento
├── lib/status.ts                              # função pura computeStatus(colab, agora)
└── lib/types.ts                               # tipos compartilhados
```

Isso resolve o aviso de "338 linhas" e deixa cada peça testável.

---

### 5. Design system

- Cores de status como tokens semânticos novos em `src/styles.css`:
  ```css
  --status-trabalhando: oklch(...)   /* verde */
  --status-almoco:      oklch(...)   /* amarelo */
  --status-ferias:      oklch(...)   /* azul */
  --status-evento:      oklch(...)   /* laranja */
  --status-fora:        oklch(...)   /* cinza */
  ```
- Badges, barras da grade e chips do calendário consomem esses tokens — sem cor hardcoded em componente.
- Dark mode automático via mesmas variáveis.

---

### 6. Ordem de execução

1. **Migration** (tabela + enum + RLS + bucket)
2. **Tokens** de status em `styles.css`
3. **Quebra** do arquivo monolítico nos componentes acima
4. **Lista densa + drawer + KPIs + guard de role**
5. **Grade semanal**
6. **Calendário + popover de eventos + upload de anexo**
7. Verificação visual (build + screenshot da tela)

---

### O que NÃO vou fazer nesta iteração (fica explícito)

- Não vou criar role nova `admin` — fica `gestor` = admin na prática (sua decisão).
- Não vou implementar aprovação de eventos (gestor cadastra direto, sem fluxo de pedido/aprovação). Se quiser depois, viramos `colaborador_evento.status` em enum.
- Não vou migrar dados de `colaborador_ferias` — ela continua sendo a fonte de verdade pra períodos longos.
- Relatórios mais profundos (gráfico de absenteísmo por mês, ranking de pontualidade) ficam pra `/relatorios`.

---

**Confirma?** Se sim, eu disparo a migration primeiro (aprovação separada), e em seguida implemento toda a UI.

