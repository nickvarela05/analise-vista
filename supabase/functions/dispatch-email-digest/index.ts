// Processa fila de e-mails pendentes e envia via webhook N8N (com HMAC).
// Modo "imediato" (cada 5min): envia tudo que está pending agora.
// Modo "digest" (8h diário): consolida notificações não enviadas das últimas 24h em 1 e-mail por usuário.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const N8N_URL = Deno.env.get("N8N_EMAIL_WEBHOOK_URL") ?? "";
const N8N_SECRET = Deno.env.get("N8N_EMAIL_HMAC_SECRET") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function buildDigestHtml(rows: Array<{ titulo: string; mensagem: string | null; tipo: string; created_at: string; link: string | null }>) {
  const items = rows.map((r) => `
    <li style="margin-bottom:12px;padding:12px;border-left:3px solid #4f46e5;background:#f9fafb">
      <strong style="color:#111">${escapeHtml(r.titulo)}</strong>
      <div style="color:#555;font-size:14px;margin-top:4px">${escapeHtml(r.mensagem ?? "")}</div>
      <div style="color:#888;font-size:12px;margin-top:4px">${new Date(r.created_at).toLocaleString("pt-BR")}</div>
    </li>`).join("");
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
    <h2 style="color:#1f2937">📋 Resumo de notificações</h2>
    <p style="color:#555">Você tem ${rows.length} notificações desde ontem:</p>
    <ul style="list-style:none;padding:0">${items}</ul>
    <p style="color:#888;font-size:12px;margin-top:24px">Acesse o sistema para ver detalhes.</p>
  </div>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

async function sendViaN8n(payload: { to: string; subject: string; html: string; text: string }): Promise<{ ok: boolean; status: number; body: string }> {
  if (!N8N_URL) return { ok: false, status: 0, body: "N8N_EMAIL_WEBHOOK_URL não configurado" };
  const body = JSON.stringify(payload);
  const sig = N8N_SECRET ? await hmacSha256Hex(N8N_SECRET, body) : "";
  const res = await fetch(N8N_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Signature": sig },
    body,
  });
  const text = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, body: text.slice(0, 500) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  let mode = "imediato";
  try { const b = await req.json(); mode = b?.mode ?? "imediato"; } catch { /* noop */ }

  // Modo digest: consolida notificações não-enviadas das últimas 24h em 1 e-mail por user
  if (mode === "digest") {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: users } = await admin
      .from("profiles")
      .select("user_id, email, nome");

    let enqueued = 0;
    for (const u of users ?? []) {
      if (!u.email) continue;

      // pega notificações do user nas últimas 24h que NÃO estão em algum email_send_log já enviado/pendente
      const { data: notifs } = await admin
        .from("notificacao")
        .select("id, tipo, titulo, mensagem, link, created_at")
        .eq("user_id", u.user_id)
        .gte("created_at", since)
        .order("created_at", { ascending: false });

      if (!notifs || notifs.length === 0) continue;

      // checa preferência de e-mail: se desativou TODOS os tipos, pula
      const { data: prefs } = await admin
        .from("notificacao_preferencia")
        .select("evento, ativo")
        .eq("user_id", u.user_id)
        .eq("canal", "email");

      const desativados = new Set((prefs ?? []).filter((p) => p.ativo === false).map((p) => p.evento));
      const filtradas = notifs.filter((n) => !desativados.has(n.tipo));
      if (filtradas.length === 0) continue;

      // ignora as que já foram enviadas individualmente (imediato)
      const ids = filtradas.map((n) => n.id);
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
        subject, body_html: html, body_text: text,
        notificacao_ids: novos.map((n) => n.id),
        status: "pending",
      });
      enqueued++;
    }
    // continua e processa os pendings abaixo
    console.log(`[digest] enfileirados: ${enqueued}`);
  }

  // Processa pendentes (independente do modo)
  const { data: pendentes } = await admin
    .from("email_send_log")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .lte("attempts", 5)
    .order("created_at", { ascending: true })
    .limit(50);

  let sent = 0, failed = 0, skipped = 0;
  for (const e of pendentes ?? []) {
    if (!N8N_URL) {
      // sem webhook configurado: marca como skipped (continua na fila)
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
      await admin.from("email_send_log").update({
        status: "sent",
        sent_at: new Date().toISOString(),
        attempts: (e.attempts ?? 0) + 1,
        webhook_response: { status: result.status, body: result.body },
      }).eq("id", e.id);
      sent++;
    } else {
      const newAttempts = (e.attempts ?? 0) + 1;
      await admin.from("email_send_log").update({
        status: newAttempts >= 5 ? "failed" : "pending",
        attempts: newAttempts,
        last_error: `HTTP ${result.status}: ${result.body}`,
        webhook_response: { status: result.status, body: result.body },
      }).eq("id", e.id);
      failed++;
    }
  }

  return new Response(JSON.stringify({ mode, processed: pendentes?.length ?? 0, sent, failed, skipped }), {
    headers: { "Content-Type": "application/json" },
  });
});
