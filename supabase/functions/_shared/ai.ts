/**
 * Cliente de IA independente de provedor (API compatível com OpenAI Chat Completions).
 *
 * Substitui o Lovable AI Gateway. O provedor é escolhido só por secrets, sem mudar código:
 *   AI_API_KEY    — obrigatório
 *   AI_BASE_URL   — padrão: endpoint OpenAI-compatível do Gemini
 *   AI_MODEL      — modelo padrão (padrão: gemini-3.8-flash)
 *   AI_MODEL_PRO  — modelo usado quando o chamador pede a variante "pro"
 *
 * A Lovable usava gemini-2.5-flash/pro, que não aceitam mais chaves novas
 * ("no longer available to new users", set/2026).
 */
const AI_BASE_URL = (
  Deno.env.get("AI_BASE_URL") ?? "https://generativelanguage.googleapis.com/v1beta/openai"
).replace(/\/+$/, "");
const AI_MODEL = Deno.env.get("AI_MODEL") ?? "gemini-3.8-flash";
const AI_MODEL_PRO = Deno.env.get("AI_MODEL_PRO") ?? "gemini-3.1-pro-preview";

export const AI_API_KEY = Deno.env.get("AI_API_KEY");

/** Mapeia os nomes herdados do gateway ("google/gemini-2.5-pro") para o modelo configurado. */
export function resolveModel(requested?: string): string {
  return requested && /-pro\b/.test(requested) ? AI_MODEL_PRO : AI_MODEL;
}

/** Mesmo contrato do `fetch` usado antes contra o gateway: recebe o RequestInit com body JSON. */
export function aiFetch(init: RequestInit): Promise<Response> {
  if (!AI_API_KEY) throw new Error("AI_API_KEY não configurada");
  const body = JSON.parse(String(init.body ?? "{}"));
  body.model = resolveModel(body.model);
  return fetch(`${AI_BASE_URL}/chat/completions`, { ...init, body: JSON.stringify(body) });
}
