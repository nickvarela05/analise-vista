import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getN8nDbClient } from "@/lib/n8n-db.server";

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

export const listSolicitacoesRelatorios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const client = getN8nDbClient();
    const { data, error } = await client
      .from("solicitacoes_relatorios")
      .select("*")
      .order("criado_em", { ascending: false });
    if (error) return { ok: false as const, error: error.message, rows: [] };
    return { ok: true as const, rows: (data ?? []) as SolicitacaoRelatorio[] };
  });

export const STATUS_SOLICITACAO = ["Pendente", "Feito", "Enviado"] as const;
export type StatusSolicitacao = (typeof STATUS_SOLICITACAO)[number];

export const updateSolicitacaoRelatorio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      id: string;
      responsavel?: string | null;
      status?: StatusSolicitacao;
      categoria?: string | null;
    }) => data,
  )
  .handler(async ({ data }) => {
    const client = getN8nDbClient();
    const patch: Record<string, unknown> = {};
    if (data.responsavel !== undefined) patch.responsavel = data.responsavel;
    if (data.status !== undefined) patch.status = data.status;
    if (data.categoria !== undefined) patch.categoria = data.categoria;
    if (Object.keys(patch).length === 0) return { ok: true as const };
    const { error } = await client
      .from("solicitacoes_relatorios")
      .update(patch)
      .eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const createSolicitacaoRelatorio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      categoria?: string | null;
      tipo_base?: string | null;
      solicitante_nome?: string | null;
      solicitante_email?: string | null;
      descricao?: string | null;
      urgencia?: string | null;
      justificativa_urgencia?: string | null;
      prazo?: string | null;
      responsavel?: string | null;
      status?: StatusSolicitacao;
    }) => data,
  )
  .handler(async ({ data }) => {
    const client = getN8nDbClient();
    const payload: Record<string, unknown> = {
      categoria: data.categoria ?? "Indefinido",
      tipo_base: data.tipo_base ?? null,
      solicitante_nome: data.solicitante_nome ?? null,
      solicitante_email: data.solicitante_email ?? null,
      descricao: data.descricao ?? null,
      urgencia: data.urgencia ?? null,
      justificativa_urgencia: data.justificativa_urgencia ?? null,
      prazo: data.prazo ?? null,
      responsavel: data.responsavel ?? null,
      status: data.status ?? "Pendente",
      criado_em: new Date().toISOString(),
    };
    const { data: row, error } = await client
      .from("solicitacoes_relatorios")
      .insert(payload)
      .select()
      .single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, row: row as SolicitacaoRelatorio };
  });