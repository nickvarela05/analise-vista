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
  name: "create_tarefa",
  title: "Criar tarefa",
  description:
    "Cria uma nova tarefa no Nexus. Por padrão o criador é adicionado como responsável.",
  inputSchema: {
    titulo: z.string().trim().min(1).max(240),
    descricao: z.string().trim().max(4000).optional(),
    prioridade: z.enum(["baixa", "media", "alta", "urgente"]).optional(),
    data_prevista: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("Data no formato YYYY-MM-DD."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  handler: async ({ titulo, descricao, prioridade, data_prevista }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId();
    const { data, error } = await sb
      .from("todo")
      .insert({
        titulo,
        descricao: descricao ?? null,
        prioridade: prioridade ?? "media",
        data_prevista: data_prevista ?? null,
        status: "aberta",
        criado_por: userId,
        responsavel_id: userId,
        responsaveis_ids: [userId],
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Tarefa criada: ${data.id}` }],
      structuredContent: { tarefa: data },
    };
  },
});
