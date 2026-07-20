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
  name: "update_tarefa_status",
  title: "Atualizar status de tarefa",
  description: "Atualiza o status de uma tarefa existente no Nexus.",
  inputSchema: {
    tarefa_id: z.string().uuid(),
    status: z.enum([
      "backlog",
      "em_andamento",
      "em_teste",
      "concluida",
      "reprovado",
      "pre_build",
      "cancelada",
    ]),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  handler: async ({ tarefa_id, status }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const patch: Record<string, unknown> = { status };
    if (status === "concluida") patch.concluida_em = new Date().toISOString();
    const { data, error } = await sb
      .from("todo")
      .update(patch)
      .eq("id", tarefa_id)
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Status atualizado para ${status}` }],
      structuredContent: { tarefa: data },
    };
  },
});
