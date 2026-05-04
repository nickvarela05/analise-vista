// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsFor } from "../_shared/cors.ts";
import { requireUser, assertReuniaoAccess } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

const systemPrompt = `Você é um analista de reuniões. Receberá a transcrição de uma reunião em português. Extraia informações estruturadas, objetivas e profissionais. Não invente nada.`;

const tool = {
  type: "function",
  function: {
    name: "extract_meeting_insights",
    description: "Extrai insights estruturados de uma transcrição de reunião.",
    parameters: {
      type: "object",
      properties: {
        resumo: { type: "string" },
        pauta: { type: "string" },
        proximos_passos: { type: "string" },
        decisoes: { type: "array", items: { type: "string" } },
        participantes_detectados: { type: "array", items: { type: "string" } },
      },
      required: ["resumo", "pauta", "proximos_passos", "decisoes", "participantes_detectados"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let reuniaoId: string | null = null;
  try {
    const user = await requireUser(req);
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const body = await req.json();
    reuniaoId = body.reuniao_id;
    if (!reuniaoId) throw new Error("reuniao_id é obrigatório");

    await assertReuniaoAccess(admin, user.id, reuniaoId);

    const { data: reu, error } = await admin
      .from("reuniao")
      .select("transcricao")
      .eq("id", reuniaoId)
      .single();
    if (error || !reu) throw new Error("Reunião não encontrada");
    if (!reu.transcricao?.trim()) throw new Error("Sem transcrição para analisar");

    await admin
      .from("reuniao")
      .update({ transcricao_status: "processando", transcricao_erro: null })
      .eq("id", reuniaoId);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Analise:\n\n---\n${reu.transcricao.slice(0, 60000)}\n---`,
          },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "extract_meeting_insights" } },
      }),
    });

    if (res.status === 429) throw new Error("Limite de requisições à IA atingido");
    if (res.status === 402) throw new Error("Créditos da IA esgotados");
    if (!res.ok) throw new Error(`IA (${res.status}): ${(await res.text()).slice(0, 300)}`);

    const json = await res.json();
    const call = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) throw new Error("IA não retornou análise estruturada");
    const args = JSON.parse(call.function.arguments);

    await admin
      .from("reuniao")
      .update({
        resumo: args.resumo ?? "",
        pauta: args.pauta ?? "",
        proximos_passos: args.proximos_passos ?? "",
        decisoes: Array.isArray(args.decisoes) ? args.decisoes : [],
        participantes_detectados: Array.isArray(args.participantes_detectados)
          ? args.participantes_detectados
          : [],
        transcricao_status: "concluido",
        transcricao_erro: null,
      })
      .eq("id", reuniaoId);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("analisar-transcricao error:", e);
    if (reuniaoId) {
      await admin
        .from("reuniao")
        .update({
          transcricao_status: "erro",
          transcricao_erro: String(e?.message ?? e).slice(0, 500),
        })
        .eq("id", reuniaoId);
    }
    return new Response(
      JSON.stringify({ error: String(e?.message ?? e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
