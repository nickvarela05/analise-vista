// Gera resumo semanal automático para cada usuário usando Lovable AI Gateway.
// Roda toda segunda às 7h. Salva em resumo_semanal e cria notificação in-app.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsFor } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

function startOfWeek(d: Date) {
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // segunda
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
}

function escopoAtividade(userId: string, colaboradorId?: string | null, incluirCriador = true) {
  const filtros = ["equipe_toda.is.true"];
  if (incluirCriador) filtros.push(`criado_por.eq.${userId}`);
  if (colaboradorId) {
    filtros.push(`responsavel_id.eq.${colaboradorId}`, `responsaveis_ids.cs.{${colaboradorId}}`);
  }
  return filtros.join(",");
}

async function callIA(prompt: string): Promise<{ texto: string; insights: string[] }> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Você é um assistente que gera resumos semanais executivos curtos em português do Brasil. Use markdown. Seja direto." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`IA falhou: ${r.status} ${err}`);
  }
  const data = await r.json();
  const texto = data.choices?.[0]?.message?.content ?? "";
  // extrai bullets como insights
  const insights = texto.split("\n")
    .filter((l: string) => /^[-*•]\s/.test(l))
    .map((l: string) => l.replace(/^[-*•]\s*/, "").trim())
    .slice(0, 5);
  return { texto, insights };
}

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  const hoje = new Date();
  const semanaInicio = startOfWeek(new Date(hoje.getTime() - 7 * 86400000));
  const semanaFim = new Date(semanaInicio.getTime() + 6 * 86400000);
  const inicioISO = semanaInicio.toISOString();
  const fimISO = new Date(semanaFim.getTime() + 86400000).toISOString();

  const { data: users } = await admin
    .from("profiles")
    .select("user_id, colaborador_id, nome");

  let gerados = 0, erros = 0;
  for (const u of users ?? []) {
    try {
      const escopo = escopoAtividade(u.user_id, u.colaborador_id);
      const escopoChamados = escopoAtividade(u.user_id, u.colaborador_id, false);
      // métricas do usuário na semana
      const [tarefas, demandas, chamados] = await Promise.all([
        admin.from("todo").select("id, status, prioridade")
          .or(escopo)
          .gte("created_at", inicioISO).lt("created_at", fimISO),
        admin.from("demanda").select("id, status, prioridade")
          .or(escopo)
          .gte("created_at", inicioISO).lt("created_at", fimISO),
        admin.from("chamado_externo").select("id, status, prazo")
          .or(escopoChamados)
          .gte("created_at", inicioISO).lt("created_at", fimISO),
      ]);

      if (tarefas.error) throw tarefas.error;
      if (demandas.error) throw demandas.error;
      if (chamados.error) throw chamados.error;

      const t = tarefas.data ?? [], d = demandas.data ?? [], c = chamados.data ?? [];
      const metricas = {
        tarefas_total: t.length,
        tarefas_concluidas: t.filter((x) => ["concluida", "producao", "aprovado"].includes(x.status)).length,
        tarefas_urgentes: t.filter((x) => ["urgente", "alta"].includes(x.prioridade)).length,
        demandas_total: d.length,
        demandas_em_andamento: d.filter((x) => x.status !== "concluida" && x.status !== "cancelada").length,
        chamados_total: c.length,
        chamados_sla_estourado: c.filter((x) => x.prazo && new Date(x.prazo) < hoje && x.status !== "fechado").length,
      };

      // pula se não teve atividade
      if (t.length === 0 && d.length === 0 && c.length === 0) continue;

      const prompt = `Gere um resumo executivo curto (máx 200 palavras) da semana de ${semanaInicio.toLocaleDateString("pt-BR")} a ${semanaFim.toLocaleDateString("pt-BR")} para ${u.nome ?? "o colaborador"}.

Métricas:
- Tarefas: ${metricas.tarefas_total} criadas, ${metricas.tarefas_concluidas} concluídas, ${metricas.tarefas_urgentes} urgentes
- Demandas: ${metricas.demandas_total} novas, ${metricas.demandas_em_andamento} em andamento
- Chamados externos: ${metricas.chamados_total} novos, ${metricas.chamados_sla_estourado} com SLA estourado

Estrutura: ## Destaques da semana, ## Pontos de atenção (bullets), ## Recomendação.`;

      const { texto, insights } = await callIA(prompt);

      // upsert resumo
      const { error: upsertError } = await admin.from("resumo_semanal").upsert({
        user_id: u.user_id,
        semana_inicio: semanaInicio.toISOString().slice(0, 10),
        semana_fim: semanaFim.toISOString().slice(0, 10),
        conteudo_md: texto,
        metricas,
        insights,
        modelo: "google/gemini-2.5-flash",
      }, { onConflict: "user_id,semana_inicio" });
      if (upsertError) throw upsertError;

      // notificação in-app
      await admin.rpc("enqueue_notificacao", {
        _user_id: u.user_id,
        _tipo: "resumo_semanal",
        _titulo: "📊 Seu resumo semanal está pronto",
        _mensagem: `Resumo de ${semanaInicio.toLocaleDateString("pt-BR")} a ${semanaFim.toLocaleDateString("pt-BR")}`,
        _link: "/relatorios?tab=resumo-semanal",
        _metadata: { semana_inicio: semanaInicio.toISOString().slice(0, 10) },
      });

      gerados++;
    } catch (e) {
      console.error(`[resumo] user ${u.user_id}:`, e);
      erros++;
    }
  }

  return new Response(JSON.stringify({ gerados, erros, semana: semanaInicio.toISOString().slice(0, 10) }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
