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
  try {
    const [, payloadB64] = token.split(".");
    if (payloadB64) {
      const json = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
      if (json?.iss === "supabase" && (json?.role === "anon" || json?.role === "service_role")) {
        return true;
      }
    }
  } catch {
    /* noop */
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (!isAuthorized(req)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  let mode = "imediato";
  try {
    const b = await req.clone().json();
    mode = b?.mode ?? mode;
  } catch {
    /* noop */
  }

  // ============================================================
  // Modo resumo_diario
  // ============================================================
  if (mode === "resumo_diario") {
    const now = new Date();
    const hoje = now.toISOString().slice(0, 10);
    const em3dias = new Date(now.getTime() + 3 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const ontemISO = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
    const inicioDia = `${hoje}T00:00:00Z`;
    const fimDia = `${hoje}T23:59:59Z`;

    const { data: users } = await admin.from("profiles").select("user_id, email, nome, recebe_resumo_diario");
    let resumoEnqueued = 0;

    for (const u of users ?? []) {
      if (!u.email) continue;
      if (u.recebe_resumo_diario === false) continue;

      const { data: pref } = await admin
        .from("notificacao_preferencia")
        .select("ativo")
        .eq("user_id", u.user_id)
        .eq("canal", "email")
        .eq("evento", "sistema")
        .maybeSingle();
      if (pref?.ativo === false) continue;

      const { data: demandas } = await admin
        .from("demanda")
        .select("id, titulo, prazo, prioridade, status, responsavel_id, responsaveis_ids")
        .eq("prazo", hoje)
        .not("status", "in", "(concluida,cancelada)");
      const minhasDemandas = (demandas ?? []).filter(
        (d) => d.responsavel_id === u.user_id || (d.responsaveis_ids ?? []).includes(u.user_id),
      );

      const { data: reunioes } = await admin
        .from("reuniao")
        .select("id, titulo, data_reuniao, status, responsavel_id, responsaveis_ids, equipe_toda")
        .gte("data_reuniao", inicioDia)
        .lte("data_reuniao", fimDia)
        .not("status", "in", "(realizada,cancelada)");
      const minhasReunioes = (reunioes ?? []).filter(
        (r) =>
          r.responsavel_id === u.user_id || (r.responsaveis_ids ?? []).includes(u.user_id) || r.equipe_toda === true,
      );

      const { data: tarefas } = await admin
        .from("todo")
        .select("id, titulo, data_prevista, em_teste, status, responsavel_id, responsaveis_ids")
        .not("status", "in", "(encerrada,concluida,producao,cancelada)")
        .not("data_prevista", "is", null)
        .lte("data_prevista", em3dias);
      const minhasTarefas = (tarefas ?? []).filter((t) => {
        const meu = t.responsavel_id === u.user_id || (t.responsaveis_ids ?? []).includes(u.user_id);
        if (!meu) return false;
        const emTesteAtrasada = t.em_teste === true && t.data_prevista < hoje;
        const pertoPrazo = t.data_prevista <= em3dias;
        return emTesteAtrasada || pertoPrazo;
      });

      const { data: relatorios } = await admin
        .from("chamado_externo")
        .select(
          "id, codigo, titulo, cliente, prazo, prioridade, status, responsavel_id, responsaveis_ids, equipe_toda, created_at",
        )
        .gte("created_at", ontemISO)
        .neq("status", "finalizado");
      const meusRelatorios = (relatorios ?? []).filter(
        (r) =>
          r.responsavel_id === u.user_id || (r.responsaveis_ids ?? []).includes(u.user_id) || r.equipe_toda === true,
      );

      const total = minhasDemandas.length + minhasReunioes.length + minhasTarefas.length + meusRelatorios.length;
      if (total === 0) continue;

      const sec = (titulo: string, icone: string, items: string) =>
        items
          ? `<h3 style="margin:18px 0 8px;color:#1f2937">${icone} ${titulo}</h3><ul style="list-style:none;padding:0;margin:0">${items}</ul>`
          : "";

      const liDemanda = minhasDemandas
        .map(
          (d) =>
            `<li style="padding:10px;border-left:3px solid #f59e0b;background:#fffbeb;margin-bottom:8px"><b>${escapeHtml(d.titulo)}</b><div style="color:#666;font-size:13px">Prioridade: ${d.prioridade} · Status: ${d.status}</div></li>`,
        )
        .join("");
      const liReuniao = minhasReunioes
        .map(
          (r) =>
            `<li style="padding:10px;border-left:3px solid #6366f1;background:#eef2ff;margin-bottom:8px"><b>${escapeHtml(r.titulo)}</b><div style="color:#666;font-size:13px">${new Date(r.data_reuniao).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div></li>`,
        )
        .join("");
      const liTarefa = minhasTarefas
        .map((t) => {
          const atrasada = t.em_teste && t.data_prevista < hoje;
          const cor = atrasada ? "#ef4444" : "#10b981";
          const bg = atrasada ? "#fef2f2" : "#ecfdf5";
          const tag = atrasada ? " · ⚠️ Em teste atrasada" : "";
          return `<li style="padding:10px;border-left:3px solid ${cor};background:${bg};margin-bottom:8px"><b>${escapeHtml(t.titulo)}</b><div style="color:#666;font-size:13px">Prazo: ${t.data_prevista}${tag}</div></li>`;
        })
        .join("");
      const liRel = meusRelatorios
        .map(
          (r) =>
            `<li style="padding:10px;border-left:3px solid #0ea5e9;background:#f0f9ff;margin-bottom:8px"><b>${escapeHtml(r.codigo)} — ${escapeHtml(r.titulo ?? "")}</b><div style="color:#666;font-size:13px">${r.cliente ? "Cliente: " + escapeHtml(r.cliente) + " · " : ""}Prioridade: ${r.prioridade}${r.prazo ? " · Prazo: " + r.prazo : ""}</div></li>`,
        )
        .join("");

      const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#111">
        <h2 style="color:#1f2937;margin-bottom:4px">☀️ Bom dia, ${escapeHtml(u.nome ?? "")}!</h2>
        <p style="color:#555;margin-top:0">Resumo do seu dia — ${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</p>
        <p style="color:#374151"><b>${total}</b> item(ns) requerem sua atenção hoje:</p>
        ${sec(`Demandas do dia (${minhasDemandas.length})`, "📌", liDemanda)}
        ${sec(`Reuniões do dia (${minhasReunioes.length})`, "🗓️", liReuniao)}
        ${sec(`Tarefas em alerta (${minhasTarefas.length})`, "✅", liTarefa)}
        ${sec(`Novos relatórios (${meusRelatorios.length})`, "📄", liRel)}
        <p style="color:#888;font-size:12px;margin-top:24px">Acesse o sistema para mais detalhes.</p>
      </div>`;

      const text =
        `Resumo do dia — ${total} item(ns).\n` +
        `Demandas: ${minhasDemandas.length} · Reuniões: ${minhasReunioes.length} · Tarefas em alerta: ${minhasTarefas.length} · Relatórios: ${meusRelatorios.length}`;

      await admin.from("email_send_log").insert({
        user_id: u.user_id,
        recipient_email: u.email,
        subject: `☀️ Resumo do dia — ${new Date().toLocaleDateString("pt-BR")}`,
        body_html: html,
        body_text: text,
        status: "pending",
      });
      resumoEnqueued++;
    }
    console.log(`[resumo_diario] enfileirados: ${resumoEnqueued}`);
  }

  // ============================================================
  // Modo digest
  // ============================================================
  if (mode === "digest") {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: users } = await admin.from("profiles").select("user_id, email, nome");

    let enqueued = 0;
    for (const u of users ?? []) {
      if (!u.email) continue;

      const { data: notifs } = await admin
        .from("notificacao")
        .select("id, tipo, titulo, mensagem, link, created_at")
        .eq("user_id", u.user_id)
        .gte("created_at", since)
        .order("created_at", { ascending: false });

      if (!notifs || notifs.length === 0) continue;

      const { data: prefs } = await admin
        .from("notificacao_preferencia")
        .select("evento, ativo")
        .eq("user_id", u.user_id)
        .eq("canal", "email");

      const desativados = new Set((prefs ?? []).filter((p) => p.ativo === false).map((p) => p.evento));
      const filtradas = notifs.filter((n) => !desativados.has(n.tipo));
      if (filtradas.length === 0) continue;

      const { data: jaEnviados } = await admin
        .from("email_send_log")
        .select("notificacao_ids")
        .eq("user_id", u.user_id)
        .in("status", ["sent", "pending"])
        .gte("created_at", since);
      const enviadosSet = new Set((jaEnviados ?? []).flatMap((r) => r.notificacao_ids ?? []));
      const novos = filtradas.filter((n) => !enviadosSet.has(n.id));
      if (novos.length === 0) continue;

      const subject = `📋 ${novos.length} notificação${novos.length > 1 ? "ões" : ""} — ${new Date().toLocaleDateString("pt-BR")}`;
      const html = buildDigestHtml(novos);
      const text = novos.map((n) => `• ${n.titulo}${n.mensagem ? " — " + n.mensagem : ""}`).join("\n");

      await admin.from("email_send_log").insert({
        user_id: u.user_id,
        recipient_email: u.email,
        subject,
        body_html: html,
        body_text: text,
        notificacao_ids: novos.map((n) => n.id),
        status: "pending",
      });
      enqueued++;
    }
    console.log(`[digest] enfileirados: ${enqueued}`);
  }

  // ============================================================
  // Processa pendentes (todos os modos)
  // ============================================================
  const { data: pendentes } = await admin
    .from("email_send_log")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .lte("attempts", 5)
    .order("created_at", { ascending: true })
    .limit(50);

  let sent = 0,
    failed = 0,
    skipped = 0;
  for (const e of pendentes ?? []) {
    if (!N8N_URL) {
      skipped++;
      continue;
    }
    const result = await sendViaN8n({
      to: e.recipient_email,
      subject: e.subject,
      html: e.body_html ?? `<pre>${escapeHtml(e.body_text ?? "")}</pre>`,
      text: e.body_text ?? "",
    });
    if (result.ok) {
      await admin
        .from("email_send_log")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          attempts: (e.attempts ?? 0) + 1,
          webhook_response: { status: result.status, body: result.body },
        })
        .eq("id", e.id);
      sent++;
    } else {
      const newAttempts = (e.attempts ?? 0) + 1;
      await admin
        .from("email_send_log")
        .update({
          status: newAttempts >= 5 ? "failed" : "pending",
          attempts: newAttempts,
          last_error: `HTTP ${result.status}: ${result.body}`,
          webhook_response: { status: result.status, body: result.body },
        })
        .eq("id", e.id);
      failed++;
    }
  }

  return new Response(JSON.stringify({ mode, processed: pendentes?.length ?? 0, sent, failed, skipped }), {
    headers: { "Content-Type": "application/json" },
  });
});
