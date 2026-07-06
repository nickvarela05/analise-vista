# Schema #12 — Configurações (IA + Preferências de Notificação)

Do bloco "Configurações", os três painéis relevantes são:

- `ConfiguracoesEmails` — apenas botões de ação em cima de `email_send_log`. **Sem formulário → fica de fora.**
- `ConfiguracoesIA` — formulário real (prompt principal, instruções extras, toggle ativo). **Alto valor.**
- `PreferenciasNotificacao` — toggles por `(evento, canal)` gravando em `notificacao_preferencia`. **Vale defesa em profundidade.**
- `DestinatariosResumoDiario` — busca + toggle direto em `profiles.recebe_resumo_diario`. Sem input estruturado; **fica de fora.**

## Arquivo novo

`src/lib/schemas/configuracoes.ts`, exportando:

1. **`iaPromptConfigSchema`** — payload de `ConfiguracoesIA`:
   - `chave`: `z.literal("analise_reuniao")` (defesa em profundidade)
   - `prompt_sistema`: `z.string().trim().min(1, "O prompt principal não pode ficar vazio").max(8000)`
   - `instrucoes_extras`: `z.string().trim().max(4000).transform(v => v || null).nullable()` via `emptyToNull`
   - `ativo`: `z.boolean()`
   - Tipo exportado: `IaPromptConfig`
2. **`notifPreferenciaSchema`** — payload de `PreferenciasNotificacao`:
   - `user_id`: `z.string().uuid()`
   - `evento`: `z.enum([...EVENTOS_TIPOS])` — os 8 tipos já definidos localmente
   - `canal`: `z.enum(["in_app", "email"])`
   - `ativo`: `z.boolean()`
   - Exportar também `EVENTOS_TIPOS` (const array) e tipo `EventoTipo` para reuso no componente.

## Mudanças em `ConfiguracoesIA.tsx`

- Importar `iaPromptConfigSchema`, `type IaPromptConfig`.
- Em `salvar()`: montar `payload` e rodar `iaPromptConfigSchema.safeParse(payload)`. Se falhar, `toast.error` com a mensagem do primeiro issue (substitui o `if (!promptSistema.trim())` manual).
- `.update(parsed.data)` / `.insert(parsed.data)` — sem mais mudanças de lógica.
- Manter `CHAVE`, `DEFAULT_PROMPT`, `restaurar()`, UI e permissões (`isGestor`).

## Mudanças em `PreferenciasNotificacao.tsx`

- Passar a importar `EVENTOS_TIPOS`, `type EventoTipo`, `notifPreferenciaSchema` do schema.
- Remover a definição local duplicada de `EventoTipo` (o array `EVENTOS` continua local — tem `label`, `desc`, `icon`, `tone`, que não vão para o schema).
- Em `toggle()`: validar o objeto com `notifPreferenciaSchema.safeParse` antes do `upsert`; erro → `toast.error` e aborta. Serve como defesa em profundidade contra chamadas com `canal`/`evento` inválidos vindos de código futuro.

## Fora do Zod (permanece)

- `ConfiguracoesEmails` inteiro (sem input estruturado).
- `DestinatariosResumoDiario` (busca + toggle direto).
- Consultas `select`, invalidação do React Query, RLS/permissões, UI, gradientes, badges.
- Chamadas a `supabase.functions.invoke("dispatch-email-digest", ...)`.

## Resultado

- Uma fonte de verdade para o payload de configuração da IA e para preferências de notificação.
- Elimina a checagem manual `!promptSistema.trim()` e o tipo `EventoTipo` duplicado.
- Zero mudança de UX.
