/**
 * Envio de e-mail pelo webhook do n8n (mesmo contrato usado pelo dispatch-email-digest):
 * POST { to, subject, html, text } com o cabeçalho `x-webhook-secret`.
 */
const N8N_URL = Deno.env.get("N8N_EMAIL_WEBHOOK_URL") ?? "";
const N8N_SECRET = Deno.env.get("N8N_EMAIL_HMAC_SECRET") ?? "";

export async function sendEmailViaN8n(payload: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; status: number; body: string }> {
  if (!N8N_URL) return { ok: false, status: 0, body: "N8N_EMAIL_WEBHOOK_URL não configurado" };
  const res = await fetch(N8N_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-webhook-secret": N8N_SECRET },
    body: JSON.stringify(payload),
  });
  const body = await res.text().catch(() => "");
  // Qualquer 2xx é sucesso, exceto quando o corpo indica falha explicitamente.
  let explicitFailure = false;
  try {
    const json = JSON.parse(body);
    explicitFailure = json?.success === false || json?.ok === false;
  } catch {
    // corpo não-JSON: vale o status HTTP
  }
  return { ok: res.ok && !explicitFailure, status: res.status, body: body.slice(0, 500) };
}
