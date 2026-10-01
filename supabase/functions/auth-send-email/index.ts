// Send Email Hook do Supabase Auth: substitui o SMTP padrão (limitado e sem entrega para
// fora da equipe do projeto) e envia os e-mails de autenticação pelo webhook do n8n.
// Com o hook ativo, TODOS os e-mails do Auth passam por aqui (recuperação de senha,
// confirmação de cadastro, convite, troca de e-mail, avisos de segurança).
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { sendEmailViaN8n } from "../_shared/n8n-email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const HOOK_SECRET = (Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "").replace("v1,whsec_", "");

type EmailData = {
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: string;
  site_url: string;
  token_new?: string;
  token_hash_new?: string;
};

type Texto = { assunto: string; titulo: string; corpo: string; botao?: string };

const TEXTOS: Record<string, Texto> = {
  recovery: {
    assunto: "Redefinição de senha — Nexus",
    titulo: "Redefinir sua senha",
    corpo:
      "Recebemos um pedido para redefinir a senha da sua conta no Nexus. O link abaixo vale por tempo limitado e só pode ser usado uma vez.",
    botao: "Criar nova senha",
  },
  signup: {
    assunto: "Confirme seu cadastro — Nexus",
    titulo: "Confirme seu e-mail",
    corpo: "Seu cadastro no Nexus foi recebido. Confirme o e-mail para concluir o acesso.",
    botao: "Confirmar e-mail",
  },
  invite: {
    assunto: "Convite para o Nexus",
    titulo: "Você foi convidado para o Nexus",
    corpo: "Aceite o convite para criar seu acesso ao Nexus.",
    botao: "Aceitar convite",
  },
  magiclink: {
    assunto: "Seu link de acesso — Nexus",
    titulo: "Acesse o Nexus",
    corpo: "Use o link abaixo para entrar no Nexus. Ele vale por tempo limitado e só pode ser usado uma vez.",
    botao: "Entrar no Nexus",
  },
  email_change: {
    assunto: "Confirme a troca de e-mail — Nexus",
    titulo: "Confirme o novo e-mail",
    corpo: "Recebemos um pedido para trocar o e-mail da sua conta no Nexus.",
    botao: "Confirmar troca",
  },
  reauthentication: {
    assunto: "Código de confirmação — Nexus",
    titulo: "Código de confirmação",
    corpo: "Use o código abaixo para confirmar a operação no Nexus.",
  },
  password_changed_notification: {
    assunto: "Sua senha foi alterada — Nexus",
    titulo: "Senha alterada",
    corpo: "A senha da sua conta no Nexus acabou de ser alterada.",
  },
  email_changed_notification: {
    assunto: "O e-mail da sua conta foi alterado — Nexus",
    titulo: "E-mail alterado",
    corpo: "O e-mail da sua conta no Nexus foi alterado.",
  },
};

const TEXTO_PADRAO: Texto = {
  assunto: "Aviso de segurança — Nexus",
  titulo: "Aviso de segurança",
  corpo: "Houve uma alteração de segurança na sua conta do Nexus.",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function montarEmail(tipo: string, d: EmailData): { subject: string; html: string; text: string } {
  const t = TEXTOS[tipo] ?? TEXTO_PADRAO;
  const link = t.botao
    ? `${SUPABASE_URL}/auth/v1/verify?token=${encodeURIComponent(d.token_hash)}&type=${encodeURIComponent(tipo)}` +
      `&redirect_to=${encodeURIComponent(d.redirect_to || d.site_url)}`
    : null;
  const codigo = tipo === "reauthentication" ? d.token : null;
  const rodape =
    "Se você não fez este pedido, ignore este e-mail — nada será alterado. Em caso de dúvida, fale com o gestor da equipe.";

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111827">
  <h2 style="margin:0 0 12px;font-size:20px">${escapeHtml(t.titulo)}</h2>
  <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#374151">${escapeHtml(t.corpo)}</p>
  ${link ? `<a href="${escapeHtml(link)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:8px">${escapeHtml(t.botao!)}</a>
  <p style="margin:16px 0 0;font-size:12px;color:#6b7280">Se o botão não funcionar, copie este endereço no navegador:<br><span style="word-break:break-all">${escapeHtml(link)}</span></p>` : ""}
  ${codigo ? `<p style="font-size:24px;font-weight:700;letter-spacing:4px;margin:8px 0 0">${escapeHtml(codigo)}</p>` : ""}
  <p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af">${escapeHtml(rodape)}</p>
</div>`;

  const text = [t.titulo, "", t.corpo, link ? `\n${t.botao}: ${link}` : "", codigo ? `\nCódigo: ${codigo}` : "", "", rodape]
    .filter((l) => l !== "")
    .join("\n");

  return { subject: t.assunto, html, text };
}

function erro(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: { http_code: status, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return erro(405, "method not allowed");
  if (!HOOK_SECRET) {
    console.error("[auth-send-email] SEND_EMAIL_HOOK_SECRET não configurado");
    return erro(500, "hook sem segredo configurado");
  }

  const payload = await req.text();
  let user: { email: string };
  let emailData: EmailData;
  try {
    ({ user, email_data: emailData } = new Webhook(HOOK_SECRET).verify(
      payload,
      Object.fromEntries(req.headers),
    ) as { user: { email: string }; email_data: EmailData });
  } catch (e) {
    console.error("[auth-send-email] assinatura inválida:", e);
    return erro(401, "assinatura inválida");
  }

  const tipo = emailData.email_action_type;
  const { subject, html, text } = montarEmail(tipo, emailData);

  // O Auth espera o hook por no máximo 5 s. Se passar disso, ele cancela o pedido e DESCARTA
  // o token — mas o e-mail já em andamento sai mesmo assim, com um link que nunca vai valer
  // ("One-time token not found"; caso real em 01/10/2026, quando o n8n levou ~7 s).
  // Por isso respondemos na hora e enviamos em segundo plano.
  const envio = sendEmailViaN8n({ to: user.email, subject, html, text })
    .then((r) => {
      if (r.ok) console.log(`[auth-send-email] enviado: ${tipo}`);
      else console.error(`[auth-send-email] falha no n8n (${tipo}): ${r.status} ${r.body}`);
    })
    .catch((e) => console.error(`[auth-send-email] erro ao enviar (${tipo}):`, e));

  const runtime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  if (runtime) runtime.waitUntil(envio);
  else await envio;

  return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
});
