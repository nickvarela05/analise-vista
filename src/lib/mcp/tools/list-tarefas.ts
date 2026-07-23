import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_tarefas",
  title: "Listar tarefas",
  description:
    "Lista tarefas do Nexus visíveis para o usuário autenticado (respeita RLS). Filtra opcionalmente por status e responsável.",
  inputSchema: {
    status: z
      .enum([
        "aberta",
        "em_andamento",
        "pre_build",
        "homologacao",
        "aprovado",
        "aprovado_ressalvas",
        "reprovado",
        "producao",
        "encerrada",
        "pendente",
        "concluida",
        "cancelada",
        "encaminhada",
      ])
      .optional()
      .describe("Filtrar por status."),
    apenas_minhas: z
      .boolean()
      .optional()
      .describe("Se true, retorna apenas tarefas onde o usuário é responsável."),
    limite: z.number().int().min(1).max(100).optional().describe("Máx. de itens (padrão 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, apenas_minhas, limite }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("todo")
      .select(
        "id, titulo, descricao, status, prioridade, data_prevista, em_teste, responsaveis_ids, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(limite ?? 25);
    if (status) q = q.eq("status", status);
    if (apenas_minhas) q = q.contains("responsaveis_ids", [ctx.getUserId()]);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { tarefas: data ?? [] },
    };
  },
});
