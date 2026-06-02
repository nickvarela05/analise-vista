import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getN8nDbClient(): SupabaseClient {
  if (client) return client;
  const raw = process.env.N8N_DB_URL;
  const url = raw ? new URL(raw).origin : undefined;
  const key = process.env.N8N_DB_SERVICE_ROLE_KEY ?? process.env.N8N_DB_ANON_KEY;
  if (!url || !key) {
    throw new Error("N8N_DB_URL ou chave de acesso não configurados");
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}