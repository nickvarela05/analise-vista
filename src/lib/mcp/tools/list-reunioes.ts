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
  name: "list_reunioes",
  title: "Listar reuniões",
  description:
    "Lista reuniões recentes do Nexus com resumo, pauta, decisões e próximos passos (respeita RLS).",
  inputSchema: {
    limite: z.number().int().min(1).max(50).optional(),
    incluir_transcricao: z
      .boolean()
      .optional()
      .describe("Se true, inclui a transcrição completa (pode ser grande)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limite, incluir_transcricao }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const cols = incluir_transcricao
      ? "id, data_reuniao, resumo, pauta, decisoes, proximos_passos, participantes, participantes_detectados, transcricao"
      : "id, data_reuniao, resumo, pauta, decisoes, proximos_passos, participantes, participantes_detectados";
    const { data, error } = await sb
      .from("reuniao")
      .select(cols)
      .order("data_reuniao", { ascending: false })
      .limit(limite ?? 10);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { reunioes: data ?? [] },
    };
  },
});
