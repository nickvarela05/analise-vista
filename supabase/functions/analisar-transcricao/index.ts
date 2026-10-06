// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsFor } from "../_shared/cors.ts";
import { requireUser, assertReuniaoAccess } from "../_shared/auth.ts";
import { analisarReuniao } from "../_shared/analise-reuniao.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

Deno.serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let reuniaoId: string | null = null;
  try {
    const user = await requireUser(req);

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

    const args = await analisarReuniao(admin, reu.transcricao);

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
