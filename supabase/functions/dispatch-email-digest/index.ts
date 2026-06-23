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
      if (
        (iss === "supabase" || iss.includes("supabase")) &&
        (role === "anon" || role === "service_role" || role === "authenticated")
      ) {
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
        admin
          .from("demanda")
          .select("id, titulo, prazo, prioridade, status, responsavel_id, responsaveis_ids")
          .gte("prazo", hoje)
          .lte("prazo", em7dias)
          .not("status", "in", "(concluida,cancelada)"),
        // Reuniões da semana
        admin
          .from("reuniao")
          .select("id, titulo, data_reuniao, status, responsavel_id, responsaveis_ids, equipe_toda")
          .gte("data_reuniao", inicioDia)
          .lte("data_reuniao", fimSemanaISO)
          .not("status", "in", "(realizada,cancelada)"),
        // Tarefas com prazo nos próximos 7 dias
        admin
          .from("todo")
          .select("id, titulo, data_prevista, em_teste, status, responsavel_id, responsaveis_ids")
          .not("status", "in", "(encerrada,concluida,producao,cancelada)")
          .not("data_prevista", "is", null)
          .gte("data_prevista", hoje)
          .lte("data_prevista", em7dias),
        // Relatórios pendentes (não finalizados)
        admin
          .from("chamado_externo")
          .select(
            "id, codigo, titulo, cliente, prazo, prioridade, status, responsavel_id, responsaveis_ids, equipe_toda, created_at",
          )
          .neq("status", "finalizado"),
        admin.from("profiles").select("colaborador_id").eq("user_id", u.user_id).maybeSingle(),
      ]);

      const colabId = profR.data?.colaborador_id ?? null;
      // responsavel_id / responsaveis_ids armazenam COLABORADOR_ID (não user_id)
      const meu = (r: {
        responsavel_id?: string | null;
        responsaveis_ids?: string[] | null;
        equipe_toda?: boolean | null;
      }) =>
        r.equipe_toda === true ||
        (!!colabId && (r.responsavel_id === colabId || (r.responsaveis_ids ?? []).includes(colabId)));
      // chamado_externo (relatórios) usa user_id nos campos de responsável
      const meuChamado = (r: {
        responsavel_id?: string | null;
        responsaveis_ids?: string[] | null;
        equipe_toda?: boolean | null;
      }) => r.equipe_toda === true || r.responsavel_id === u.user_id || (r.responsaveis_ids ?? []).includes(u.user_id);

      const minhasDemandas = (demR.data ?? []).filter(meu);
      const minhasReunioes = (reuR.data ?? []).filter(meu);
      const minhasTarefas = (tarR.data ?? []).filter(meu);
      const meusRelatorios = (relR.data ?? []).filter(meuChamado);
      const meusAvisos = avisosAtivos.filter(
        (a) => !a.colaboradores_ids?.length || (colabId && a.colaboradores_ids.includes(colabId)),
      );

      const total =
        minhasDemandas.length +
        minhasReunioes.length +
        minhasTarefas.length +
        meusRelatorios.length +
        meusAvisos.length;
      if (total === 0) return;

      const isHoje = (d: string | null | undefined) => !!d && d.slice(0, 10) === hoje;
      const fmtData = (d: string) => {
        const dt = new Date(d.length <= 10 ? `${d}T00:00:00` : d);
        return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
      };
      const fmtHora = (d: string) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const diasAte = (d: string | null | undefined) => {
        if (!d) return null;
        const dt = new Date(d.length <= 10 ? `${d}T00:00:00` : d);
        const ms = dt.getTime() - new Date(`${hoje}T00:00:00`).getTime();
        return Math.round(ms / 86400000);
      };
      const prazoBadge = (d: string | null | undefined) => {
        const n = diasAte(d);
        if (n === null) return "";
        if (n <= 0)
          return `<span style="background:#dc2626;color:#fff;font-size:10px;font-weight:700;padding:3px 9px;border-radius:10px;letter-spacing:.3px">HOJE</span>`;
        if (n === 1)
          return `<span style="background:#f59e0b;color:#fff;font-size:10px;font-weight:700;padding:3px 9px;border-radius:10px;letter-spacing:.3px">AMANHÃ</span>`;
        return `<span style="background:#e5e7eb;color:#374151;font-size:10px;font-weight:600;padding:3px 9px;border-radius:10px">em ${n}d</span>`;
      };

      type Item = { prazo?: string | null; data_prevista?: string | null; data_reuniao?: string | null };
      const partition = <T extends Item>(arr: T[], key: "prazo" | "data_prevista" | "data_reuniao") => {
        const hojeArr: T[] = [],
          semanaArr: T[] = [];
        for (const it of arr) {
          if (isHoje(it[key] as string | null | undefined)) hojeArr.push(it);
          else semanaArr.push(it);
        }
        return { hojeArr, semanaArr };
      };

      const demP = partition(minhasDemandas, "prazo");
      const tarP = partition(minhasTarefas, "data_prevista");
      const reuP = partition(minhasReunioes, "data_reuniao");
      const totalHoje = demP.hojeArr.length + tarP.hojeArr.length + reuP.hojeArr.length;

      const card = (accent: string, body: string) =>
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;border-collapse:separate;background:#ffffff;border:1px solid #e5e7eb;border-left:4px solid ${accent};border-radius:8px"><tr><td style="padding:12px 14px">${body}</td></tr></table>`;

      const headRow = (titulo: string, badge: string) =>
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="color:#111827;font-size:14px;font-weight:600">${titulo}</td><td align="right">${badge}</td></tr></table>`;

      const renderDemanda = (d: (typeof minhasDemandas)[number]) =>
        card(
          "#f59e0b",
          `${headRow(escapeHtml(d.titulo), prazoBadge(d.prazo))}
         <div style="color:#6b7280;font-size:12px;margin-top:6px">📅 ${d.prazo ? fmtData(d.prazo) : "sem prazo"} &nbsp;·&nbsp; 🎯 ${escapeHtml(String(d.prioridade ?? "—"))}</div>`,
        );

      const renderTarefa = (t: (typeof minhasTarefas)[number]) =>
        card(
          "#10b981",
          `${headRow(escapeHtml(t.titulo), prazoBadge(t.data_prevista))}
         <div style="color:#6b7280;font-size:12px;margin-top:6px">📅 ${t.data_prevista ? fmtData(t.data_prevista) : "sem prazo"}</div>`,
        );

      const renderReuniao = (r: (typeof minhasReunioes)[number]) =>
        card(
          "#6366f1",
          `${headRow(escapeHtml(r.titulo), prazoBadge(r.data_reuniao))}
         <div style="color:#6b7280;font-size:12px;margin-top:6px">🗓️ ${fmtData(r.data_reuniao)} às ${fmtHora(r.data_reuniao)}</div>`,
        );

      const renderRelatorio = (r: (typeof meusRelatorios)[number]) =>
        card(
          "#0ea5e9",
          `${headRow(escapeHtml(r.codigo) + " — " + escapeHtml(r.titulo ?? ""), r.prazo ? prazoBadge(r.prazo) : "")}
         <div style="color:#6b7280;font-size:12px;margin-top:6px">${r.cliente ? "🏢 " + escapeHtml(r.cliente) + " &nbsp;·&nbsp; " : ""}Status: <b style="color:#0369a1">${escapeHtml(r.status)}</b></div>`,
        );

      const renderAviso = (a: (typeof meusAvisos)[number]) =>
        card(
          "#a855f7",
          `<div><span style="background:#a855f7;color:#fff;font-size:10px;font-weight:700;padding:3px 9px;border-radius:10px;letter-spacing:.3px">${escapeHtml(String(a.tipo).toUpperCase())}</span>
         <strong style="color:#111827;font-size:14px;margin-left:8px">${escapeHtml(a.titulo)}</strong></div>
         ${a.mensagem ? `<div style="color:#6b7280;font-size:13px;margin-top:6px;line-height:1.5">${escapeHtml(a.mensagem)}</div>` : ""}`,
        );

      const bloco = (titulo: string, icone: string, count: number, items: string) =>
        count === 0
          ? ""
          : `
        <div style="margin:26px 0 10px">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="color:#111827;font-size:15px;font-weight:700;letter-spacing:-.2px">${icone} ${titulo}</td>
            <td style="padding-left:8px"><span style="background:#f3f4f6;color:#374151;font-size:11px;font-weight:600;padding:3px 9px;border-radius:10px">${count}</span></td>
          </tr></table>
          <div style="margin-top:10px">${items}</div>
        </div>`;

      const sectionHoje =
        totalHoje > 0
          ? `
        <div style="margin:20px 0 8px;padding:18px;background:linear-gradient(135deg,#fef2f2 0%,#fff7ed 100%);border:1px solid #fecaca;border-radius:12px">
          <div style="font-size:11px;font-weight:700;color:#dc2626;letter-spacing:1.5px">🔥 FOCO DE HOJE</div>
          <div style="font-size:18px;font-weight:700;color:#7f1d1d;margin-top:4px">${totalHoje} ${totalHoje === 1 ? "item precisa" : "itens precisam"} da sua atenção</div>
          <div style="margin-top:14px">
            ${reuP.hojeArr
              .sort((a, b) => a.data_reuniao.localeCompare(b.data_reuniao))
              .map(renderReuniao)
              .join("")}
            ${demP.hojeArr.map(renderDemanda).join("")}
            ${tarP.hojeArr.map(renderTarefa).join("")}
          </div>
        </div>`
          : `
        <div style="margin:20px 0 8px;padding:20px;background:linear-gradient(135deg,#ecfdf5 0%,#f0fdfa 100%);border:1px solid #a7f3d0;border-radius:12px;text-align:center">
          <div style="font-size:28px">✨</div>
          <div style="font-size:14px;font-weight:600;color:#065f46;margin-top:6px">Nenhum compromisso urgente para hoje</div>
          <div style="font-size:12px;color:#047857;margin-top:2px">Aproveite para adiantar as atividades da semana 👇</div>
        </div>`;

      const semanaItems =
        reuP.semanaArr
          .sort((a, b) => a.data_reuniao.localeCompare(b.data_reuniao))
          .map(renderReuniao)
          .join("") +
        demP.semanaArr
          .sort((a, b) => (a.prazo ?? "").localeCompare(b.prazo ?? ""))
          .map(renderDemanda)
          .join("") +
        tarP.semanaArr
          .sort((a, b) => (a.data_prevista ?? "").localeCompare(b.data_prevista ?? ""))
          .map(renderTarefa)
          .join("");
      const semanaCount = reuP.semanaArr.length + demP.semanaArr.length + tarP.semanaArr.length;

      const dataExtenso = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
      const dataCap = dataExtenso.charAt(0).toUpperCase() + dataExtenso.slice(1);
      const primeiroNome = (u.nome ?? "").split(" ")[0] || "";

      const html = `<div style="background:#f3f4f6;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.06)">
          <tr><td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:28px 28px 24px;color:#ffffff">
            <div style="font-size:11px;font-weight:600;letter-spacing:2px;opacity:.85">${dataCap.toUpperCase()}</div>
            <h1 style="margin:6px 0 4px;font-size:26px;font-weight:700;letter-spacing:-.5px;color:#ffffff">☀️ Bom dia, ${escapeHtml(primeiroNome)}!</h1>
            <p style="margin:0;font-size:14px;opacity:.92">Seu resumo da semana — ${total} ${total === 1 ? "item" : "itens"} no radar</p>
          </td></tr>
          <tr><td style="padding:8px 24px 28px">
            ${sectionHoje}
            ${bloco("Avisos da gestão", "📣", meusAvisos.length, meusAvisos.map(renderAviso).join(""))}
            ${bloco("Relatórios pendentes", "📄", meusRelatorios.length, meusRelatorios.map(renderRelatorio).join(""))}
            ${bloco("Agenda da semana", "📆", semanaCount, semanaItems)}
            <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center">
              <a href="https://analise-vista.lovable.app" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px">Abrir painel completo →</a>
              <p style="color:#9ca3af;font-size:12px;margin:16px 0 0">Você recebe este resumo porque a opção está ativa. Ajuste em <i>Configurações → Notificações</i>.</p>
            </div>
          </td></tr>
        </table>
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
    .from("email_send_log")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .lte("attempts", 5)
    .order("created_at", { ascending: true })
    .limit(50);
  const pend = pendentes ?? [];
  if (!N8N_URL || pend.length === 0) return;
  const CONCURRENCY = 10;
  for (let i = 0; i < pend.length; i += CONCURRENCY) {
    const batch = pend.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (e) => {
        const result = await sendViaN8n({
          to: e.recipient_email,
          subject: e.subject,
          html: e.body_html ?? `<pre>${escapeHtml(e.body_text ?? "")}</pre>`,
          text: e.body_text ?? "",
        });
        const newAttempts = (e.attempts ?? 0) + 1;
        if (result.ok) {
          await admin
            .from("email_send_log")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              attempts: newAttempts,
              webhook_response: { status: result.status, body: result.body },
            })
            .eq("id", e.id);
        } else {
          await admin
            .from("email_send_log")
            .update({
              status: newAttempts >= 5 ? "failed" : "pending",
              attempts: newAttempts,
              last_error: `HTTP ${result.status}: ${result.body}`,
              webhook_response: { status: result.status, body: result.body },
            })
            .eq("id", e.id);
        }
      }),
    );
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
  await Promise.all(
    (users ?? []).map(async (u) => {
      if (!u.email) return;
      const { data: notifs } = await admin
        .from("notificacao")
        .select("id, tipo, titulo, mensagem, link, created_at")
        .eq("user_id", u.user_id)
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      if (!notifs || notifs.length === 0) return;
      const { data: prefs } = await admin
        .from("notificacao_preferencia")
        .select("evento, ativo")
        .eq("user_id", u.user_id)
        .eq("canal", "email");
      const desativados = new Set((prefs ?? []).filter((p) => p.ativo === false).map((p) => p.evento));
      const filtradas = notifs.filter((n) => !desativados.has(n.tipo));
      if (filtradas.length === 0) return;
      const { data: jaEnviados } = await admin
        .from("email_send_log")
        .select("notificacao_ids")
        .eq("user_id", u.user_id)
        .in("status", ["sent", "pending"])
        .gte("created_at", since);
      const enviadosSet = new Set((jaEnviados ?? []).flatMap((r) => r.notificacao_ids ?? []));
      const novos = filtradas.filter((n) => !enviadosSet.has(n.id));
      if (novos.length === 0) return;
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
    }),
  );
}
