import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getN8nDbClient(): SupabaseClient {
  if (client) return client;
  // Desde a migração a tabela do n8n vive no mesmo projeto do NEXUS: sem N8N_DB_*,
  // usa a URL e a service_role do próprio projeto.
  const raw = process.env.N8N_DB_URL ?? process.env.SUPABASE_URL;
  const url = raw ? new URL(raw).origin : undefined;
  const key =
    process.env.N8N_DB_SERVICE_ROLE_KEY ??
    process.env.N8N_DB_ANON_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("N8N_DB_URL ou chave de acesso não configurados");
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}