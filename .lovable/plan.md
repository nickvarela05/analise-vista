# Chat WhatsApp via n8n + IA no nosso app

## Arquitetura

```text
WhatsApp do gestor
      │
      ▼
   n8n  (Evolution API — recomendado p/ uso interno)
   ├─ valida telefone na whitelist
   ├─ assina request com HMAC
   └─ POST /api/public/chat-consulta  ──►  nosso app (TanStack Start)
                                          ├─ verifica HMAC + rate limit
                                          ├─ resolve telefone → user_id
                                          ├─ Lovable AI (Gemini) + tool calling
                                          │     ├─ tool: contarUnidades(filtros)
                                          │     ├─ tool: contarColaboradores(filtros)
                                          │     ├─ tool: tarefasAtrasadas()
                                          │     ├─ tool: reunioesSemana()
                                          │     └─ tool: consultarAlunos(unidade,tipo)  ──► API externa da empresa
                                          ├─ grava chat_whatsapp_log
                                          └─ responde { texto }
                                                                                                 │
   n8n recebe resposta ─► envia mensagem no WhatsApp                                             ◄┘
```

**Decisões fixadas**
- WhatsApp: **Evolution API** auto-hospedada (rápido, sem aprovação Meta, suficiente p/ uso interno restrito)
- IA: **Lovable AI Gateway (Gemini 3 Flash)** com tool calling — sem SQL livre
- Acesso: whitelist de telefones em `profiles.telefone`
- API externa de alunos/professores: **a definir com seu TI** (recomendação abaixo)

## Etapas

### 1. Banco (1 migração)
- Adiciona `profiles.telefone` (texto, único, index) + grant
- Cria tabela `chat_whatsapp_log` (id, user_id, telefone, pergunta, resposta, tools_chamadas jsonb, tokens, latencia_ms, status, created_at) com RLS: só gestores leem
- Cria tabela `chat_rate_limit` (telefone, janela, contagem) p/ throttle simples

### 2. Endpoint público `/api/public/chat-consulta` (TanStack server route)
- Verifica header `x-signature` = HMAC-SHA256(body, `N8N_CHAT_HMAC_SECRET`) com `timingSafeEqual`
- Valida payload com Zod: `{ telefone, mensagem }` (limites de tamanho)
- Resolve `telefone → user_id` via `profiles`; se não cadastrado → resposta padrão "Acesso não autorizado"
- Rate limit: 20 msg / 1 min por telefone
- Chama IA com tools (próximo item)
- Loga tudo em `chat_whatsapp_log`
- Retorna `{ resposta: string }`

### 3. Camada de IA com tools (`src/lib/chat-tools.server.ts`)
Tools tipadas com Zod, cada uma retorna número/lista pequena:
- `contarUnidades({ zona?, tipo? })`
- `listarUnidades({ zona?, tipo?, limite=5 })`
- `contarColaboradores({ cargo?, setor? })`
- `contarTarefas({ status?, atrasadas?, responsavel? })`
- `listarReunioesProximas({ dias=7 })`
- `contarAlunos({ unidade?, tipo_escola? })` — **chama API externa**
- `contarProfessores({ unidade? })` — **chama API externa**

Loop com `stepCountIs(50)`; system prompt fixa: "responda em pt-BR, conciso, sem dados sensíveis, se não souber diga".

### 4. Integração API externa da empresa
Recomendação (já que ainda não está definido):
- **OAuth2 client_credentials** — mais seguro server-to-server, com refresh automático
- Lovable guarda `EMPRESA_API_URL`, `EMPRESA_API_CLIENT_ID`, `EMPRESA_API_CLIENT_SECRET` como secrets
- Helper `src/lib/empresa-api.server.ts` com cache de token em memória + retry
- Como o time ainda vai levantar a doc, o plano deixa as tools `contarAlunos`/`contarProfessores` com **stub que retorna "API ainda não integrada"**; quando a doc chegar, troco só o helper sem mexer nas tools/IA

Pedirei ao time de TI (passa pra eles):
- Auth: OAuth2 client_credentials (escopo read-only)
- Endpoints quantitativos puros: ex `GET /v1/alunos/contagem?unidade={cod}` retornando `{ total: number }`
- Rate limit do lado deles (proteção)
- HTTPS + IP whitelist do nosso servidor

### 5. Workflow n8n (eu documento, você monta)
- Trigger: webhook Evolution API (msg recebida)
- IF: telefone na whitelist (consulta n8n DB ou hardcoded inicial)
- HTTP Request → `https://analise-vista.lovable.app/api/public/chat-consulta`
  - Header `x-signature` calculado com HMAC node
- Evolution API → enviar resposta

### 6. Telas no app (mínimo)
- `/admin/chat-whatsapp` (só gestor): lista logs, filtro por telefone/data, ver pergunta+resposta+tools usadas
- Em `/colaboradores` ou settings: campo "Telefone WhatsApp" no profile p/ liberar acesso

### 7. Segredos a criar
- `N8N_CHAT_HMAC_SECRET` (você gera ou eu gero string forte)
- (futuro) `EMPRESA_API_URL`, `EMPRESA_API_CLIENT_ID`, `EMPRESA_API_CLIENT_SECRET`

## O que NÃO entra no v1
- Templates HSM da Meta (escopo é uso interno)
- Múltiplos números de WhatsApp
- Conversa multi-turn com memória longa (cada msg é stateless; podemos adicionar memória curta de 5 msgs por telefone depois)
- Mídia (áudio/imagem) — texto only

## Detalhes técnicos

**Por que endpoint público e não server function?**
n8n envia HTTP POST simples; `/api/public/*` no TanStack ignora auth do site publicado mas exigimos HMAC no handler — padrão recomendado para webhooks na knowledge `public-api-endpoints`.

**Por que tool calling e não SQL livre?**
A função `executar_busca_natural` que vocês já têm aceita SELECT mas é difícil de auditar, fácil de retornar dado sensível por engano, e a IA pode gerar SQL que estoura DB. Tool calling com schemas fixos: previsível, barato em tokens, fácil de evoluir, fácil de auditar (cada tool chamada vai pro log).

**Estrutura de arquivos**
- `src/routes/api/public/chat-consulta.ts` — handler HTTP
- `src/lib/chat-ia.server.ts` — orquestração IA + Gemini
- `src/lib/chat-tools.server.ts` — definição das tools
- `src/lib/empresa-api.server.ts` — cliente API externa (stub inicial)
- `src/lib/hmac.server.ts` — verificação HMAC
- `src/routes/_authenticated/admin/chat-whatsapp.tsx` — painel admin

**Estimativa**: 1 migração + ~6 arquivos novos + 1 edição em profiles. Build limpo, sem mexer em features existentes.

---

Confirme se posso prosseguir, ou me diga ajustes (provider WhatsApp, escopo de tools, estrutura da API externa).
