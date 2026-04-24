import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

function getAdminClient() {
  const url = process.env.SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function assertGestor(supabase: ReturnType<typeof getAdminClient>, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "gestor")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas gestores podem executar esta operação.");
}

export type UsuarioRow = {
  user_id: string;
  email: string | null;
  nome: string | null;
  avatar_url: string | null;
  cargo: string | null;
  colaborador_id: string | null;
  role: "gestor" | "analista" | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
};

export const listarUsuarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ usuarios: UsuarioRow[] }> => {
    const admin = getAdminClient();
    await assertGestor(admin, context.userId);

    const { data: usersResp, error: usersErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (usersErr) throw new Error(usersErr.message);

    const userIds = usersResp.users.map((u) => u.id);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      admin.from("profiles").select("user_id,nome,email,avatar_url,cargo,colaborador_id").in("user_id", userIds),
      admin.from("user_roles").select("user_id,role").in("user_id", userIds),
    ]);

    const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    const roleMap = new Map<string, "gestor" | "analista">();
    for (const r of roles ?? []) {
      // gestor tem prioridade
      if (r.role === "gestor") roleMap.set(r.user_id, "gestor");
      else if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, r.role as "analista");
    }

    const usuarios: UsuarioRow[] = usersResp.users.map((u) => {
      const p = profileMap.get(u.id);
      return {
        user_id: u.id,
        email: u.email ?? p?.email ?? null,
        nome: p?.nome ?? null,
        avatar_url: p?.avatar_url ?? null,
        cargo: p?.cargo ?? null,
        colaborador_id: p?.colaborador_id ?? null,
        role: roleMap.get(u.id) ?? null,
        created_at: u.created_at ?? null,
        last_sign_in_at: u.last_sign_in_at ?? null,
        email_confirmed_at: u.email_confirmed_at ?? null,
      };
    });

    return { usuarios };
  });

export const alterarRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      user_id: z.string().uuid(),
      role: z.enum(["gestor", "analista"]),
    }).parse,
  )
  .handler(async ({ context, data }) => {
    const admin = getAdminClient();
    await assertGestor(admin, context.userId);

    if (data.user_id === context.userId && data.role !== "gestor") {
      // Impede que o último gestor remova a si mesmo deixando o sistema sem gestor
      const { count } = await admin
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "gestor");
      if ((count ?? 0) <= 1) {
        throw new Error("Não é possível remover sua própria role de gestor: você é o único gestor.");
      }
    }

    // Limpa roles existentes e insere a nova (modelo simples: 1 role por usuário)
    const { error: delErr } = await admin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id);
    if (delErr) throw new Error(delErr.message);

    const { error: insErr } = await admin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (insErr) throw new Error(insErr.message);

    return { ok: true };
  });

export const vincularColaborador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      user_id: z.string().uuid(),
      colaborador_id: z.string().uuid().nullable(),
    }).parse,
  )
  .handler(async ({ context, data }) => {
    const admin = getAdminClient();
    await assertGestor(admin, context.userId);

    if (data.colaborador_id) {
      // Desvincula qualquer outro usuário ligado a esse colaborador
      const { error: clrErr } = await admin
        .from("profiles")
        .update({ colaborador_id: null })
        .eq("colaborador_id", data.colaborador_id)
        .neq("user_id", data.user_id);
      if (clrErr) throw new Error(clrErr.message);
    }

    const { error } = await admin
      .from("profiles")
      .update({ colaborador_id: data.colaborador_id })
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const convidarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      email: z.string().email().max(255),
      nome: z.string().min(1).max(120),
      role: z.enum(["gestor", "analista"]),
      colaborador_id: z.string().uuid().nullable().optional(),
    }).parse,
  )
  .handler(async ({ context, data }) => {
    const admin = getAdminClient();
    await assertGestor(admin, context.userId);

    const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(data.email, {
      data: { nome: data.nome },
    });
    if (error) throw new Error(error.message);
    const newUserId = invited.user?.id;
    if (!newUserId) throw new Error("Falha ao criar usuário.");

    // O trigger handle_new_user cria o profile e atribui role default.
    // Sobrescreve a role conforme escolhido:
    await admin.from("user_roles").delete().eq("user_id", newUserId);
    await admin.from("user_roles").insert({ user_id: newUserId, role: data.role });

    if (data.colaborador_id) {
      await admin
        .from("profiles")
        .update({ colaborador_id: data.colaborador_id, nome: data.nome })
        .eq("user_id", newUserId);
    } else {
      await admin.from("profiles").update({ nome: data.nome }).eq("user_id", newUserId);
    }

    return { ok: true, user_id: newUserId };
  });

export const removerUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ user_id: z.string().uuid() }).parse)
  .handler(async ({ context, data }) => {
    const admin = getAdminClient();
    await assertGestor(admin, context.userId);

    if (data.user_id === context.userId) {
      throw new Error("Você não pode remover seu próprio usuário.");
    }

    const { error } = await admin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
