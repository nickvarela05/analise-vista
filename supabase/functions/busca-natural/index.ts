// Busca em linguagem natural — converte pergunta → SQL seguro com IA e executa via RPC.
// Guardrails: só SELECT, tabelas allowlisted, escopo do usuário (RLS aplica via cliente autenticado).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsFor } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

// tabelas permitidas e suas colunas relevantes
const ALLOWED_TABLES: Record<string, string[]> = {
  todo: ["id", "titulo", "descricao", "status", "prioridade", "data_prevista", "responsavel_id", "responsaveis_ids", "criado_por", "created_at"],
  demanda: ["id", "titulo", "descricao", "status", "prioridade", "responsavel_id", "responsaveis_ids", "criado_por", "created_at"],
  chamado_externo: ["id", "titulo", "descricao", "status", "prazo", "responsavel_id", "responsaveis_ids", "created_at"],
  reuniao: ["id", "titulo", "data", "responsavel_id", "responsaveis_ids", "created_at"],
  colaborador: ["id", "nome", "email", "cargo", "ativo"],
};

const FORBIDDEN = /\b(insert|update|delete|drop|alter|truncate|grant|revoke|create|merge|copy|do|call|comment|vacuum|analyze|cluster|reindex|listen|notify|begin|commit|rollback|savepoint|set|reset|;.*(insert|update|delete|drop))\b/i;

// rate limit em memória (best-effort, reseta a cada deploy)
const RATE: Map<string, { count: number; reset: number }> = new Map();
function checkRate(uid: string): boolean {
  const now = Date.now();
  const entry = RATE.get(uid);
  if (!entry || entry.reset < now) {
    RATE.set(uid, { count: 1, reset: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

async function gerarSQL(pergunta: string, userId: string): Promise<string> {
  const schema = Object.entries(ALLOWED_TABLES)
    .map(([t, cols]) => `${t}(${cols.join(", ")})`)
    .join("\n");

  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `Você é um gerador de SQL PostgreSQL READ-ONLY. Regras OBRIGATÓRIAS:
- SOMENTE SELECT
- Use APENAS estas tabelas/colunas: ${schema}
- Sempre LIMIT 50 no final
- Para filtros de "minhas" ou "meu", use responsavel_id = '${userId}' OR '${userId}' = ANY(responsaveis_ids)
- NUNCA use INSERT, UPDATE, DELETE, DROP, ALTER, ou qualquer DDL/DML que altere dados
- Retorne APENAS a query SQL, sem markdown, sem explicação, sem ponto e vírgula extra`,
        },
        { role: "user", content: pergunta },
      ],
    }),
  });
  if (!r.ok) throw new Error(`IA: ${r.status}`);
  const data = await r.json();
  let sql: string = data.choices?.[0]?.message?.content ?? "";
  // limpa markdown
  sql = sql.replace(/```sql\n?/gi, "").replace(/```/g, "").trim();
  // remove ponto e vírgula final
  sql = sql.replace(/;+\s*$/, "");
  return sql;
}

function validarSQL(sql: string): { ok: boolean; erro?: string } {
  const norm = sql.toLowerCase().trim();
  if (!norm.startsWith("select")) return { ok: false, erro: "Apenas SELECT é permitido" };
  if (FORBIDDEN.test(sql)) return { ok: false, erro: "Comando proibido detectado" };
  if (sql.includes(";")) return { ok: false, erro: "Múltiplas queries não permitidas" };
  // verifica se referencia só tabelas permitidas (heurística simples: nenhuma tabela fora do whitelist no FROM/JOIN)
  const tabelasReferenciadas = [...sql.matchAll(/\b(from|join)\s+([a-z_][a-z0-9_]*)/gi)].map((m) => m[2].toLowerCase());
  for (const t of tabelasReferenciadas) {
    if (!ALLOWED_TABLES[t]) return { ok: false, erro: `Tabela não permitida: ${t}` };
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  try {
    const user = await requireUser(req);
    if (!checkRate(user.id)) {
      return new Response(JSON.stringify({ error: "Muitas requisições. Aguarde 1 minuto." }), {
        status: 429, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { pergunta } = await req.json();
    if (!pergunta || typeof pergunta !== "string" || pergunta.length < 3 || pergunta.length > 500) {
      return new Response(JSON.stringify({ error: "Pergunta inválida (3-500 caracteres)" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sql = await gerarSQL(pergunta, user.id);
    const validacao = validarSQL(sql);
    if (!validacao.ok) {
      return new Response(JSON.stringify({ error: validacao.erro, sql_gerado: sql }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // executa com cliente autenticado do usuário (RLS aplica)
    const token = req.headers.get("Authorization")!.slice(7);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // executa via RPC seguro: vamos usar uma RPC dedicada que faz EXECUTE com SET ROLE authenticated
    const { data, error } = await userClient.rpc("executar_busca_natural", { _sql: sql });
    if (error) {
      return new Response(JSON.stringify({ error: error.message, sql_gerado: sql }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ pergunta, sql_gerado: sql, resultados: data }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
