import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

/** Valida o JWT do request e devolve o user. Lança Response 401 se inválido. */
export async function requireUser(req: Request): Promise<{ id: string; email: string | null }> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const token = auth.slice(7);
  const client: SupabaseClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return { id: data.user.id, email: data.user.email ?? null };
}

/** Verifica se user pode acessar a reunião (criador, responsável, gestor ou em responsaveis_ids). */
export async function assertReuniaoAccess(
  admin: SupabaseClient,
  userId: string,
  reuniaoId: string,
): Promise<void> {
  const [{ data: r }, { data: roles }] = await Promise.all([
    admin.from("reuniao").select("criado_por,responsavel_id,responsaveis_ids,equipe_toda").eq("id", reuniaoId).single(),
    admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "gestor"),
  ]);
  const isGestor = (roles ?? []).length > 0;
  if (isGestor) return;
  if (!r) throw new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  const allowed =
    r.criado_por === userId ||
    r.responsavel_id === userId ||
    r.equipe_toda === true ||
    (Array.isArray(r.responsaveis_ids) && r.responsaveis_ids.includes(userId));
  if (!allowed) {
    throw new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
}
