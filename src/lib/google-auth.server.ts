/**
 * Acesso ao Google Agenda por OAuth da conta da equipe (server-only).
 *
 * Histórico: a ponte da Lovable parou com a saída dela; a conta de serviço foi
 * descartada em 15/10/2026 porque o Workspace da prefeitura só deixa compartilhar
 * a agenda com contas externas em "disponível/ocupado". Agora um gestor conecta a
 * conta (relatorioged@) uma vez e o refresh token fica em google_oauth_conta, tabela
 * sem nenhuma policy (só o service role lê).
 *
 * Segredos no Worker: GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_CLIENT_SECRET.
 */
export const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/calendar";
export const OAUTH_CALLBACK_PATH = "/api/public/google-oauth-callback";
const STATE_VALIDADE_MS = 10 * 60_000;

let tokenCache: { token: string; expiraEm: number } | null = null;

function clienteOAuth() {
  // trim: colar no terminal pode trazer quebra de linha junto com o valor.
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!id || !secret) {
    throw new Error(
      "GOOGLE_OAUTH_CLIENT_ID ou GOOGLE_OAUTH_CLIENT_SECRET não configurados no Worker.",
    );
  }
  // O ID do cliente não é segredo (vai na URL do Google); dá para diagnosticar.
  if (!id.endsWith(".apps.googleusercontent.com")) {
    throw new Error(
      `GOOGLE_OAUTH_CLIENT_ID gravado parece incompleto (${id.length} caracteres); ` +
        "o ID termina em .apps.googleusercontent.com.",
    );
  }
  return { id, secret };
}

function base64url(dados: ArrayBuffer | string): string {
  const bytes = typeof dados === "string" ? new TextEncoder().encode(dados) : new Uint8Array(dados);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(texto: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(clienteOAuth().secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64url(await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(texto)));
}

/** URL de consentimento do Google; o state assinado leva quem pediu e quando. */
export async function urlConsentimento(origem: string, userId: string): Promise<string> {
  const carga = base64url(JSON.stringify({ u: userId, t: Date.now() }));
  const params = new URLSearchParams({
    client_id: clienteOAuth().id,
    redirect_uri: origem + OAUTH_CALLBACK_PATH,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state: `${carga}.${await hmac(carga)}`,
  });
  return `${AUTH_URL}?${params}`;
}

/** Confere o state do callback; devolve o userId do gestor que iniciou, ou null. */
export async function validarState(state: string | null): Promise<string | null> {
  if (!state) return null;
  const [carga, assinatura] = state.split(".");
  if (!carga || !assinatura || (await hmac(carga)) !== assinatura) return null;
  const json = atob(carga.replace(/-/g, "+").replace(/_/g, "/"));
  const { u, t } = JSON.parse(json) as { u: string; t: number };
  return Date.now() - t <= STATE_VALIDADE_MS ? u : null;
}

async function pedirToken(params: Record<string, string>) {
  const { id, secret } = clienteOAuth();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, ...params }),
  });
  if (!res.ok) throw new Error(`Google recusou o token: ${res.status} ${await res.text()}`);
  return (await res.json()) as { access_token: string; expires_in: number; refresh_token?: string };
}

/** Troca o code do callback, descobre o e-mail da conta e guarda o refresh token. */
export async function concluirConexao(origem: string, code: string, userId: string) {
  const tokens = await pedirToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: origem + OAUTH_CALLBACK_PATH,
  });
  if (!tokens.refresh_token)
    throw new Error("O Google não devolveu refresh token; conecte de novo.");
  const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const email = res.ok ? (((await res.json()) as { id?: string }).id ?? null) : null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("google_oauth_conta").upsert({
    id: true,
    refresh_token: tokens.refresh_token,
    email,
    conectado_por: userId,
    conectado_em: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  tokenCache = { token: tokens.access_token, expiraEm: Date.now() + tokens.expires_in * 1000 };
  return email;
}

export async function contaConectada(): Promise<{
  email: string | null;
  refresh_token: string;
} | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("google_oauth_conta")
    .select("email, refresh_token")
    .eq("id", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Token de acesso da conta conectada, reaproveitado até 1 min antes de expirar. */
export async function googleAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiraEm - 60_000 > Date.now()) return tokenCache.token;
  const conta = await contaConectada();
  if (!conta) throw new Error('Nenhuma conta Google conectada. Use "Conectar conta Google".');
  try {
    const body = await pedirToken({
      grant_type: "refresh_token",
      refresh_token: conta.refresh_token,
    });
    tokenCache = { token: body.access_token, expiraEm: Date.now() + body.expires_in * 1000 };
    return body.access_token;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      msg.includes("invalid_grant")
        ? "A autorização da conta Google expirou ou foi revogada. Conecte de novo."
        : msg,
    );
  }
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
