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
  // Regra: qualquer 2xx do n8n é sucesso, exceto se o corpo indicar
  // explicitamente falha (success:false / ok:false / error sem success).
  // Antes exigíamos flag positiva, o que marcava como "failed" e-mails
  // que o n8n de fato disparou (bug: aparecem no backlog do n8n, mas o
  // sistema registra falha por ausência da flag).
  let explicitFailure = false;
  try {
    const json = JSON.parse(text);
    if (
      json?.success === false ||
      json?.ok === false ||
      (json?.error && json?.success !== true && json?.ok !== true)
    ) {
      explicitFailure = true;
    }
  } catch { /* body não-JSON: aceita 2xx */ }
  return {
    ok: res.ok && !explicitFailure,
    status: res.status,
    body: text.slice(0, 500),
  };
}

/**
 * @description Autoriza chamadas do cron interno via header `x-cron-secret`
 * (valor em `CRON_SECRET`), do cron interno via SERVICE_ROLE_KEY OU de
 * usuários autenticados com papel `gestor` (disparo manual via UI).
 */
async function isAuthorized(req: Request): Promise<boolean> {
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const headerCron = req.headers.get("x-cron-secret") ?? "";
  if (cronSecret && headerCron && headerCron === cronSecret) return true;

  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return false;
  if (token === SERVICE_KEY) return true;
  try {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return false;
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .eq("role", "gestor");
    return (roles ?? []).length > 0;
  } catch {
    return false;
  }
}

async function runResumoDiario(opts: { forceIgnoreWeekday?: boolean } = {}) {
  const now = new Date();

  // Checa configuração de dias da semana (0=Dom .. 6=Sáb).
  // Disparo manual (via UI de gestor) ignora o filtro e sempre executa.
  if (!opts.forceIgnoreWeekday) {
    const { data: cfg } = await admin
      .from("email_digest_config")
      .select("dias_semana")
      .eq("id", true)
      .maybeSingle();
    const dias: number[] = (cfg?.dias_semana as number[] | null) ?? [1, 2, 3, 4, 5];
    // Usa fuso America/Sao_Paulo para determinar o dia da semana efetivo.
    const brDay = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getDay();
    if (!dias.includes(brDay)) {
      console.log(`[resumo_diario] dia ${brDay} não está em ${JSON.stringify(dias)} — pulando.`);
      return;
    }
  }

  const hoje = now.toISOString().slice(0, 10);
  const em7dias = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const inicioDia = `${hoje}T00:00:00Z`;
  const fimSemanaISO = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString();

  const { data: users } = await admin
    .from("profiles")
    .select("user_id, email, nome, recebe_resumo_diario, colaborador_id");

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

  // ---------------------------------------------------------------
  // Consultas GLOBAIS (não dependem do usuário) — carregadas UMA vez
  // e filtradas em memória por usuário. Antes eram disparadas N×
  // (uma por profile), saturando o PostgREST e causando 503/504.
  // ---------------------------------------------------------------
  const [demR, reuR, tarR, tarTesteR, relR, prefR] = await Promise.all([
    admin
      .from("demanda")
      .select("id, titulo, prazo, prioridade, status, responsavel_id, responsaveis_ids")
      .gte("prazo", hoje)
      .lte("prazo", em7dias)
      .not("status", "in", "(concluida,cancelada)"),
    admin
      .from("reuniao")
      .select("id, titulo, data_reuniao, status, responsavel_id, responsaveis_ids, equipe_toda")
      .gte("data_reuniao", inicioDia)
      .lte("data_reuniao", fimSemanaISO)
      .not("status", "in", "(realizada,cancelada)"),
    // Tarefas em HOMOLOGAÇÃO — atribuídas ao usuário, disponíveis para validação.
    admin
      .from("todo")
      .select("id, titulo, data_prevista, em_teste, status, responsavel_id, responsaveis_ids, equipe_toda")
      .eq("status", "homologacao"),
    // Tarefas EM TESTE — atribuídas ao usuário, independente de status.
    admin
      .from("todo")
      .select("id, titulo, data_prevista, em_teste, status, responsavel_id, responsaveis_ids, equipe_toda")
      .eq("em_teste", true)
      .not("status", "in", "(encerrada,concluida,producao,cancelada)"),
    admin
      .from("chamado_externo")
      .select(
        "id, codigo, titulo, cliente, prazo, prioridade, status, responsavel_id, responsaveis_ids, equipe_toda, created_at",
      )
      .neq("status", "finalizado"),
    admin
      .from("notificacao_preferencia")
      .select("user_id, ativo")
      .eq("canal", "email")
      .eq("evento", "sistema"),
  ]);

  const demAll = demR.data ?? [];
  const reuAll = reuR.data ?? [];
  const tarAll = tarR.data ?? [];
  const tarTesteAll = tarTesteR.data ?? [];
  const relAll = relR.data ?? [];
  const prefOff = new Set((prefR.data ?? []).filter((p) => p.ativo === false).map((p) => p.user_id));

  // Processa usuários sequencialmente: as consultas pesadas já foram
  // feitas; resta apenas filtro em memória + 1 INSERT por usuário.
  for (const u of users ?? []) {
    try {
      if (!u.email || u.recebe_resumo_diario === false || jaSet.has(u.user_id)) continue;
      if (prefOff.has(u.user_id)) continue;

      const colabId = u.colaborador_id ?? null;
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

      const minhasDemandas = demAll.filter(meu);
      const minhasReunioes = reuAll.filter(meu);
      const minhasTarefas = tarAll.filter(meu);
      const idsHomolog = new Set(minhasTarefas.map((t) => t.id));
      const minhasTarefasTeste = tarTesteAll.filter((t) => meu(t) && !idsHomolog.has(t.id));
      const meusRelatorios = relAll.filter(meuChamado);
      const meusAvisos = avisosAtivos.filter(
        (a) => !a.colaboradores_ids?.length || (colabId && a.colaboradores_ids.includes(colabId)),
      );

      const total =
        minhasDemandas.length +
        minhasReunioes.length +
        minhasTarefas.length +
        minhasTarefasTeste.length +
        meusRelatorios.length +
        meusAvisos.length;
      if (total === 0) continue;

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

      const renderTarefaTeste = (t: (typeof minhasTarefasTeste)[number]) =>
        card(
          "#f43f5e",
          `${headRow(escapeHtml(t.titulo), t.data_prevista ? prazoBadge(t.data_prevista) : `<span style="background:#fce7f3;color:#9d174d;font-size:10px;font-weight:700;padding:3px 9px;border-radius:10px;letter-spacing:.3px">EM TESTE</span>`)}
         <div style="color:#6b7280;font-size:12px;margin-top:6px">🧪 Disponível para validação${t.data_prevista ? " &nbsp;·&nbsp; 📅 " + fmtData(t.data_prevista) : ""}</div>`,
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
            ${bloco("Tarefas em teste — aguardando validação", "🧪", minhasTarefasTeste.length, minhasTarefasTeste.map(renderTarefaTeste).join(""))}
            ${bloco("Relatórios pendentes", "📄", meusRelatorios.length, meusRelatorios.map(renderRelatorio).join(""))}
            ${bloco("Agenda da semana", "📆", semanaCount, semanaItems)}
            <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center">
              <a href="https://analise-vista.lovable.app" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px">Abrir painel completo →</a>
              <p style="color:#9ca3af;font-size:12px;margin:16px 0 0">Você recebe este resumo porque a opção está ativa. Ajuste em <i>Configurações → Notificações</i>.</p>
            </div>
          </td></tr>
        </table>
      </div>`;

      const text = `Resumo semanal — ${total} item(ns).\nAvisos: ${meusAvisos.length} · Em teste: ${minhasTarefasTeste.length} · Relatórios: ${meusRelatorios.length} · Demandas: ${minhasDemandas.length} · Tarefas: ${minhasTarefas.length} · Reuniões: ${minhasReunioes.length}`;

      await admin.from("email_send_log").insert({
        user_id: u.user_id,
        recipient_email: u.email,
        subject: `☀️ Resumo do dia — ${new Date().toLocaleDateString("pt-BR")}`,
        body_html: html,
        body_text: text,
        status: "pending",
      });
    } catch (err) {
      // Uma falha por usuário não deve travar o lote inteiro.
      console.error("[runResumoDiario] falha para user", u.user_id, err);
    }
  }
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
  if (!(await isAuthorized(req))) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  let mode = "imediato";
  let force = false;
  try {
    const b = await req.clone().json();
    mode = b?.mode ?? mode;
    force = b?.force === true;
  } catch {
    /* noop */
  }

  // Chamadas manuais (gestor pela UI) ignoram o filtro de dias da semana.
  // O cron sempre envia sem `force`, então respeita a configuração.
  const cameFromCron = (req.headers.get("x-cron-secret") ?? "") !== "";
  const forceIgnoreWeekday = force || !cameFromCron;

  // Background: roda sem bloquear a resposta
  const work = (async () => {
    if (mode === "resumo_diario") await runResumoDiario({ forceIgnoreWeekday });
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
