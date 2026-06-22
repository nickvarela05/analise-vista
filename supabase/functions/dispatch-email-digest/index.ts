import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const N8N_URL = Deno.env.get("N8N_EMAIL_WEBHOOK_URL") ?? "";
const N8N_SECRET = Deno.env.get("N8N_EMAIL_HMAC_SECRET") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

function buildDigestHtml(
  rows: Array<{ titulo: string; mensagem: string | null; tipo: string; created_at: string; link: string | null }>,
) {
  const items = rows
    .map(
      (r) => `
    <li style="margin-bottom:12px;padding:12px;border-left:3px solid #4f46e5;background:#f9fafb">
      <strong style="color:#111">${escapeHtml(r.titulo)}</strong>
      <div style="color:#555;font-size:14px;margin-top:4px">${escapeHtml(r.mensagem ?? "")}</div>
      <div style="color:#888;font-size:12px;margin-top:4px">${new Date(r.created_at).toLocaleString("pt-BR")}</div>
    </li>`,
    )
    .join("");
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
    <h2 style="color:#1f2937">📋 Resumo de notificações</h2>
    <p style="color:#555">Você tem ${rows.length} notificações desde ontem:</p>
    <ul style="list-style:none;padding:0">${items}</ul>
    <p style="color:#888;font-size:12px;margin-top:24px">Acesse o sistema para ver detalhes.</p>
  </div>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

async function sendViaN8n(payload: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; status: number; body: string }> {
  if (!N8N_URL) return { ok: false, status: 0, body: "N8N_EMAIL_WEBHOOK_URL não configurado" };
  const body = JSON.stringify(payload);
  const res = await fetch(N8N_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-secret": N8N_SECRET, // secret puro
    },
    body,
  });
  const text = await res.text().catch(() => "");
  let confirmed = false;
  try {
    const json = JSON.parse(text);
    confirmed = json?.success === true || json?.ok === true;
  } catch {
    /* body não-JSON */
  }
  return {
    ok: res.ok && confirmed,
    status: res.status,
    body: confirmed ? text.slice(0, 500) : text.slice(0, 400) || "N8N respondeu 200 sem flag de sucesso",
  };
}

const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const PUBLISHABLE_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
const PUBLISHABLE_KEYS = (Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function isAuthorized(req: Request): boolean {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token.length === 0) return false;
  if (token === SERVICE_KEY) return true;
  if (ANON_KEY && token === ANON_KEY) return true;
  if (PUBLISHABLE_KEY && token === PUBLISHABLE_KEY) return true;
  if (PUBLISHABLE_KEYS.includes(token)) return true;
  if (token.startsWith("sb_publishable_") || token.startsWith("sb_secret_")) return true;
  try {
    const [, payloadB64] = token.split(".");
    if (payloadB64) {
      const json = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
      const iss = typeof json?.iss === "string" ? json.iss : "";
      const role = json?.role;
      if ((iss === "supabase" || iss.includes("supabase")) &&
          (role === "anon" || role === "service_role" || role === "authenticated")) {
        return true;
      }
      // Supabase publishable/secret novo formato (sb_publishable_..., sb_secret_...)
      if (typeof json?.ref === "string") return true;
    }
  } catch {
    /* noop */
  }
  return false;
}

async function runResumoDiario() {
  const now = new Date();
  const hoje = now.toISOString().slice(0, 10);
  const em7dias = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const inicioDia = `${hoje}T00:00:00Z`;
  const fimSemanaISO = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString();

  const { data: users } = await admin.from("profiles").select("user_id, email, nome, recebe_resumo_diario");

  // idempotência: 1x por dia por usuário
  const { data: jaHoje } = await admin
    .from("email_send_log")
    .select("user_id")
    .gte("created_at", inicioDia)
    .like("subject", "☀️ Resumo do dia%");
  const jaSet = new Set((jaHoje ?? []).map((r) => r.user_id));

  // Avisos ativos (globais para todos os usuários ativos)
  const { data: avisosAll } = await admin
    .from("aviso_gestor")
    .select("id, titulo, mensagem, tipo, ativo, expira_em, colaboradores_ids")
    .eq("ativo", true);
  const avisosAtivos = (avisosAll ?? []).filter(
    (a) => !a.expira_em || new Date(a.expira_em).getTime() >= now.getTime(),
  );

  await Promise.all(
    (users ?? []).map(async (u) => {
      if (!u.email || u.recebe_resumo_diario === false || jaSet.has(u.user_id)) return;

      const { data: pref } = await admin
        .from("notificacao_preferencia")
        .select("ativo")
        .eq("user_id", u.user_id)
        .eq("canal", "email")
        .eq("evento", "sistema")
        .maybeSingle();
      if (pref?.ativo === false) return;

      const [demR, reuR, tarR, relR, profR] = await Promise.all([
        // Demandas com prazo nos próximos 7 dias
        admin.from("demanda")
          .select("id, titulo, prazo, prioridade, status, responsavel_id, responsaveis_ids")
          .gte("prazo", hoje).lte("prazo", em7dias)
          .not("status", "in", "(concluida,cancelada)"),
        // Reuniões da semana
        admin.from("reuniao")
          .select("id, titulo, data_reuniao, status, responsavel_id, responsaveis_ids, equipe_toda")
          .gte("data_reuniao", inicioDia).lte("data_reuniao", fimSemanaISO)
          .not("status", "in", "(realizada,cancelada)"),
        // Tarefas com prazo nos próximos 7 dias
        admin.from("todo")
          .select("id, titulo, data_prevista, em_teste, status, responsavel_id, responsaveis_ids")
          .not("status", "in", "(encerrada,concluida,producao,cancelada)")
          .not("data_prevista", "is", null)
          .gte("data_prevista", hoje).lte("data_prevista", em7dias),
        // Relatórios pendentes (não finalizados)
        admin.from("chamado_externo")
          .select("id, codigo, titulo, cliente, prazo, prioridade, status, responsavel_id, responsaveis_ids, equipe_toda, created_at")
          .neq("status", "finalizado"),
        admin.from("profiles").select("colaborador_id").eq("user_id", u.user_id).maybeSingle(),
      ]);

      const colabId = profR.data?.colaborador_id ?? null;
      const meu = (r: { responsavel_id?: string | null; responsaveis_ids?: string[] | null; equipe_toda?: boolean | null }) =>
        r.responsavel_id === u.user_id || (r.responsaveis_ids ?? []).includes(u.user_id) || r.equipe_toda === true;

      const minhasDemandas = (demR.data ?? []).filter(meu);
      const minhasReunioes = (reuR.data ?? []).filter(meu);
      const minhasTarefas = (tarR.data ?? []).filter(meu);
      const meusRelatorios = (relR.data ?? []).filter(meu);
      const meusAvisos = avisosAtivos.filter(
        (a) => !a.colaboradores_ids?.length || (colabId && a.colaboradores_ids.includes(colabId)),
      );

      const total =
        minhasDemandas.length + minhasReunioes.length + minhasTarefas.length +
        meusRelatorios.length + meusAvisos.length;
      if (total === 0) return;

      const isHoje = (d: string | null | undefined) => !!d && d.slice(0, 10) === hoje;
      const sec = (titulo: string, icone: string, items: string) =>
        items
          ? `<h3 style="margin:18px 0 8px;color:#1f2937">${icone} ${titulo}</h3><ul style="list-style:none;padding:0;margin:0">${items}</ul>`
          : "";
      const badgeHoje = `<span style="background:#dc2626;color:#fff;font-size:11px;padding:2px 6px;border-radius:4px;margin-left:6px">HOJE</span>`;

      const liDemanda = minhasDemandas
        .sort((a, b) => (a.prazo ?? "").localeCompare(b.prazo ?? ""))
        .map((d) => {
          const hj = isHoje(d.prazo);
          const cor = hj ? "#dc2626" : "#f59e0b";
          const bg = hj ? "#fef2f2" : "#fffbeb";
          return `<li style="padding:10px;border-left:3px solid ${cor};background:${bg};margin-bottom:8px"><b>${escapeHtml(d.titulo)}</b>${hj ? badgeHoje : ""}<div style="color:#666;font-size:13px">Prazo: ${d.prazo} · Prioridade: ${d.prioridade}</div></li>`;
        }).join("");

      const liReuniao = minhasReunioes
        .sort((a, b) => a.data_reuniao.localeCompare(b.data_reuniao))
        .map((r) => {
          const hj = isHoje(r.data_reuniao);
          const cor = hj ? "#dc2626" : "#6366f1";
          const bg = hj ? "#fef2f2" : "#eef2ff";
          const dt = new Date(r.data_reuniao);
          return `<li style="padding:10px;border-left:3px solid ${cor};background:${bg};margin-bottom:8px"><b>${escapeHtml(r.titulo)}</b>${hj ? badgeHoje : ""}<div style="color:#666;font-size:13px">${dt.toLocaleDateString("pt-BR")} ${dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div></li>`;
        }).join("");

      const liTarefa = minhasTarefas
        .sort((a, b) => (a.data_prevista ?? "").localeCompare(b.data_prevista ?? ""))
        .map((t) => {
          const hj = isHoje(t.data_prevista);
          const cor = hj ? "#dc2626" : "#10b981";
          const bg = hj ? "#fef2f2" : "#ecfdf5";
          return `<li style="padding:10px;border-left:3px solid ${cor};background:${bg};margin-bottom:8px"><b>${escapeHtml(t.titulo)}</b>${hj ? badgeHoje : ""}<div style="color:#666;font-size:13px">Prazo: ${t.data_prevista}</div></li>`;
        }).join("");

      const liRel = meusRelatorios.map((r) =>
        `<li style="padding:10px;border-left:3px solid #0ea5e9;background:#f0f9ff;margin-bottom:8px"><b>${escapeHtml(r.codigo)} — ${escapeHtml(r.titulo ?? "")}</b><div style="color:#666;font-size:13px">${r.cliente ? "Cliente: " + escapeHtml(r.cliente) + " · " : ""}Status: ${r.status}${r.prazo ? " · Prazo: " + r.prazo : ""}</div></li>`,
      ).join("");

      const liAviso = meusAvisos.map((a) =>
        `<li style="padding:10px;border-left:3px solid #a855f7;background:#faf5ff;margin-bottom:8px"><b>[${String(a.tipo).toUpperCase()}] ${escapeHtml(a.titulo)}</b><div style="color:#666;font-size:13px">${escapeHtml(a.mensagem ?? "")}</div></li>`,
      ).join("");

      const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#111">
        <h2 style="color:#1f2937;margin-bottom:4px">☀️ Bom dia, ${escapeHtml(u.nome ?? "")}!</h2>
        <p style="color:#555;margin-top:0">Resumo semanal — destaque para hoje (${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })})</p>
        <p style="color:#374151"><b>${total}</b> item(ns) requerem sua atenção esta semana:</p>
        ${sec(`Avisos ativos (${meusAvisos.length})`, "📣", liAviso)}
        ${sec(`Relatórios pendentes (${meusRelatorios.length})`, "📄", liRel)}
        ${sec(`Demandas da semana (${minhasDemandas.length})`, "📌", liDemanda)}
        ${sec(`Tarefas da semana (${minhasTarefas.length})`, "✅", liTarefa)}
        ${sec(`Reuniões da semana (${minhasReunioes.length})`, "🗓️", liReuniao)}
        <p style="color:#888;font-size:12px;margin-top:24px">Acesse o sistema para mais detalhes.</p>
      </div>`;

      const text = `Resumo semanal — ${total} item(ns).\nAvisos: ${meusAvisos.length} · Relatórios: ${meusRelatorios.length} · Demandas: ${minhasDemandas.length} · Tarefas: ${minhasTarefas.length} · Reuniões: ${minhasReunioes.length}`;

      await admin.from("email_send_log").insert({
        user_id: u.user_id,
        recipient_email: u.email,
        subject: `☀️ Resumo do dia — ${new Date().toLocaleDateString("pt-BR")}`,
        body_html: html,
        body_text: text,
        status: "pending",
      });
    }),
  );
}

async function processarPendentes() {
  const { data: pendentes } = await admin
    .from("email_send_log").select("*").eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .lte("attempts", 5).order("created_at", { ascending: true }).limit(50);
  const pend = pendentes ?? [];
  if (!N8N_URL || pend.length === 0) return;
  const CONCURRENCY = 10;
  for (let i = 0; i < pend.length; i += CONCURRENCY) {
    const batch = pend.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (e) => {
      const result = await sendViaN8n({
        to: e.recipient_email, subject: e.subject,
        html: e.body_html ?? `<pre>${escapeHtml(e.body_text ?? "")}</pre>`,
        text: e.body_text ?? "",
      });
      const newAttempts = (e.attempts ?? 0) + 1;
      if (result.ok) {
        await admin.from("email_send_log").update({
          status: "sent", sent_at: new Date().toISOString(),
          attempts: newAttempts, webhook_response: { status: result.status, body: result.body },
        }).eq("id", e.id);
      } else {
        await admin.from("email_send_log").update({
          status: newAttempts >= 5 ? "failed" : "pending",
          attempts: newAttempts, last_error: `HTTP ${result.status}: ${result.body}`,
          webhook_response: { status: result.status, body: result.body },
        }).eq("id", e.id);
      }
    }));
  }
}

// deno-lint-ignore no-explicit-any
const EdgeRuntime: any = (globalThis as any).EdgeRuntime;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (!isAuthorized(req)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  let mode = "imediato";
  try {
    const b = await req.clone().json();
    mode = b?.mode ?? mode;
  } catch {
    /* noop */
  }

  // Background: roda sem bloquear a resposta
  const work = (async () => {
    if (mode === "resumo_diario") await runResumoDiario();
    if (mode === "digest") await runDigest();
    await processarPendentes();
  })();

  if (EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(work);
  else work.catch((e) => console.error("[bg]", e));

  return new Response(JSON.stringify({ mode, queued: true }), {
    headers: { "Content-Type": "application/json", ...CORS },
  });
});

// ============================================================
// (código antigo abaixo desativado — mantido para referência)
// ============================================================
async function runDigest() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: users } = await admin.from("profiles").select("user_id, email, nome");
  await Promise.all((users ?? []).map(async (u) => {
    if (!u.email) return;
    const { data: notifs } = await admin
      .from("notificacao").select("id, tipo, titulo, mensagem, link, created_at")
      .eq("user_id", u.user_id).gte("created_at", since).order("created_at", { ascending: false });
    if (!notifs || notifs.length === 0) return;
    const { data: prefs } = await admin
      .from("notificacao_preferencia").select("evento, ativo")
      .eq("user_id", u.user_id).eq("canal", "email");
    const desativados = new Set((prefs ?? []).filter((p) => p.ativo === false).map((p) => p.evento));
    const filtradas = notifs.filter((n) => !desativados.has(n.tipo));
    if (filtradas.length === 0) return;
    const { data: jaEnviados } = await admin
      .from("email_send_log").select("notificacao_ids")
      .eq("user_id", u.user_id).in("status", ["sent", "pending"]).gte("created_at", since);
    const enviadosSet = new Set((jaEnviados ?? []).flatMap((r) => r.notificacao_ids ?? []));
    const novos = filtradas.filter((n) => !enviadosSet.has(n.id));
    if (novos.length === 0) return;
    const subject = `📋 ${novos.length} notificação${novos.length > 1 ? "ões" : ""} — ${new Date().toLocaleDateString("pt-BR")}`;
    const html = buildDigestHtml(novos);
    const text = novos.map((n) => `• ${n.titulo}${n.mensagem ? " — " + n.mensagem : ""}`).join("\n");
    await admin.from("email_send_log").insert({
      user_id: u.user_id, recipient_email: u.email, subject,
      body_html: html, body_text: text,
      notificacao_ids: novos.map((n) => n.id), status: "pending",
    });
  }));
}

