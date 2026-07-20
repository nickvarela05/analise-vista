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
  name: "list_demandas",
  title: "Listar demandas",
  description: "Lista demandas do Nexus visíveis para o usuário autenticado.",
  inputSchema: {
    apenas_minhas: z.boolean().optional(),
    limite: z.number().int().min(1).max(100).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ apenas_minhas, limite }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("demanda")
      .select(
        "id, categoria, origem, status, prioridade, prazo, solicitante, descricao, responsaveis_ids, tags, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(limite ?? 25);
    if (apenas_minhas) q = q.contains("responsaveis_ids", [ctx.getUserId()]);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { demandas: data ?? [] },
    };
  },
});
