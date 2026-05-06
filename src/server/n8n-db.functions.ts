import { createServerFn } from "@tanstack/react-start";
import { getN8nDbClient } from "./n8n-db.server";

/**
 * Faz uma requisição REST direta ao PostgREST do banco externo
 * para descobrir o schema (tabelas e colunas via OpenAPI).
 */
export const inspectN8nDbSchema = createServerFn({ method: "GET" }).handler(
  async () => {
    const url = process.env.N8N_DB_URL;
    const key =
      process.env.N8N_DB_SERVICE_ROLE_KEY ?? process.env.N8N_DB_ANON_KEY;
    if (!url || !key) {
      return { ok: false, error: "Credenciais N8N_DB não configuradas" };
    }

    // PostgREST expõe um OpenAPI spec na raiz com todas as tabelas/colunas
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `HTTP ${res.status}: ${await res.text().catch(() => "")}`,
      };
    }
    const spec = (await res.json()) as {
      definitions?: Record<
        string,
        { properties?: Record<string, { type?: string; format?: string; description?: string }> }
      >;
      paths?: Record<string, unknown>;
    };

    const tables = Object.entries(spec.definitions ?? {}).map(([name, def]) => ({
      name,
      columns: Object.entries(def.properties ?? {}).map(([col, meta]) => ({
        name: col,
        type: meta.type,
        format: meta.format,
        description: meta.description,
      })),
    }));

    return { ok: true, tables };
  },
);

/**
 * Conta linhas de uma tabela do banco externo.
 */
export const countN8nTable = createServerFn({ method: "POST" })
  .inputValidator((data: { table: string }) => data)
  .handler(async ({ data }) => {
    const client = getN8nDbClient();
    const { count, error } = await client
      .from(data.table)
      .select("*", { count: "exact", head: true });
    if (error) return { ok: false, error: error.message };
    return { ok: true, count };
  });

/**
 * Retorna até 5 registros de exemplo de uma tabela.
 */
export const sampleN8nTable = createServerFn({ method: "POST" })
  .inputValidator((data: { table: string; limit?: number }) => data)
  .handler(async ({ data }) => {
    const client = getN8nDbClient();
    const { data: rows, error } = await client
      .from(data.table)
      .select("*")
      .limit(data.limit ?? 5);
    if (error) return { ok: false, error: error.message };
    return { ok: true, rows };
  });

export type SolicitacaoRelatorio = {
  id: string;
  email_id: string | null;
  solicitante_nome: string | null;
  solicitante_email: string | null;
  tipo_base: string | null;
  descricao: string | null;
  prazo: string | null;
  urgencia: string | null;
  justificativa_urgencia: string | null;
  status: string | null;
  responsavel: string | null;
  criado_em: string | null;
  categoria: string | null;
  detalhes_email: string | null;
};

/**
 * Lista todas as solicitações de relatórios do banco externo N8N,
 * ordenadas pelas mais recentes.
 */
export const listSolicitacoesRelatorios = createServerFn({ method: "GET" }).handler(
  async () => {
    const client = getN8nDbClient();
    const { data, error } = await client
      .from("solicitacoes_relatorios")
      .select("*")
      .order("criado_em", { ascending: false });
    if (error) return { ok: false as const, error: error.message, rows: [] };
    return { ok: true as const, rows: (data ?? []) as SolicitacaoRelatorio[] };
  },
);

export const STATUS_SOLICITACAO = ["Pendente", "Feito", "Enviado"] as const;
export type StatusSolicitacao = (typeof STATUS_SOLICITACAO)[number];

/**
 * Atualiza responsável e/ou status de uma solicitação no banco N8N.
 */
export const updateSolicitacaoRelatorio = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { id: string; responsavel?: string | null; status?: StatusSolicitacao }) => data,
  )
  .handler(async ({ data }) => {
    const client = getN8nDbClient();
    const patch: Record<string, unknown> = {};
    if (data.responsavel !== undefined) patch.responsavel = data.responsavel;
    if (data.status !== undefined) patch.status = data.status;
    if (Object.keys(patch).length === 0) return { ok: true as const };
    const { error } = await client
      .from("solicitacoes_relatorios")
      .update(patch)
      .eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });
