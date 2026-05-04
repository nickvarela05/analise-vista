import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/**
 * Cliente Supabase para o banco externo "Banco consulta N8N - relatórios".
 * Usa SERVICE ROLE — só pode ser usado em server functions.
 */
export function getN8nDbClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.N8N_DB_URL;
  const key = process.env.N8N_DB_SERVICE_ROLE_KEY ?? process.env.N8N_DB_ANON_KEY;
  if (!url || !key) {
    throw new Error("N8N_DB_URL ou chave (service role/anon) não configurados");
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}
