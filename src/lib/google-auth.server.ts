/**
 * Acesso ao Google Agenda por conta de serviço (server-only). Substituiu o
 * connector-gateway da Lovable em 14/10/2026.
 *
 * O segredo GOOGLE_SERVICE_ACCOUNT_JSON (Cloudflare Worker) guarda o JSON da chave
 * baixada no Google Cloud. A agenda da equipe precisa estar compartilhada com o
 * client_email da conta, com "Fazer alterações nos eventos".
 */
export const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/calendar";

interface ContaServico {
  client_email: string;
  private_key: string;
}

let tokenCache: { token: string; expiraEm: number } | null = null;

export function contaServico(): ContaServico {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON não configurado no Worker.");
  const conta = JSON.parse(raw) as Partial<ContaServico>;
  if (!conta.client_email || !conta.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON inválido: faltam client_email ou private_key.");
  }
  return { client_email: conta.client_email, private_key: conta.private_key };
}

function base64url(dados: ArrayBuffer | string): string {
  const bytes = typeof dados === "string" ? new TextEncoder().encode(dados) : new Uint8Array(dados);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function assinarJwt(conta: ContaServico): Promise<string> {
  const agora = Math.floor(Date.now() / 1000);
  const cabecalho = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const corpo = base64url(
    JSON.stringify({
      iss: conta.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: agora,
      exp: agora + 3600,
    }),
  );
  const pem = conta.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const chave = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const assinatura = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    chave,
    new TextEncoder().encode(`${cabecalho}.${corpo}`),
  );
  return `${cabecalho}.${corpo}.${base64url(assinatura)}`;
}

/** Token de acesso OAuth da conta de serviço, reaproveitado até 1 min antes de expirar. */
export async function googleAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiraEm - 60_000 > Date.now()) return tokenCache.token;
  const jwt = await assinarJwt(contaServico());
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok)
    throw new Error(`Google recusou a conta de serviço: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: body.access_token, expiraEm: Date.now() + body.expires_in * 1000 };
  return body.access_token;
}

export async function googleCalendarFetch(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<Response> {
  return fetch(`${GOOGLE_CALENDAR_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await googleAccessToken()}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
