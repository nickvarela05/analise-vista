import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireGestor, jsonError } from "@/server/admin-auth.server";

export type UsuarioRow = {
  user_id: string;
  email: string | null;
  nome: string | null;
  avatar_url: string | null;
  cargo: string | null;
  colaborador_id: string | null;
  role: "gestor" | "analista" | null;
  must_change_password: boolean;
  created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
};

/** Gera senha temporária de 12 chars: maiúsc + minúsc + dígito + símbolo. */
function gerarSenhaTemporaria(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digit = "23456789";
  const symbol = "!@#$%&*?";
  const all = upper + lower + digit + symbol;
  const rand = (set: string) => set[Math.floor(Math.random() * set.length)];
  const chars = [rand(upper), rand(lower), rand(digit), rand(symbol)];
  for (let i = 0; i < 8; i++) chars.push(rand(all));
  // shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

const createSchema = z.object({
  email: z.string().email().max(255),
  nome: z.string().min(1).max(120),
  role: z.enum(["gestor", "analista"]),
  colaborador_id: z.string().uuid().nullable().optional(),
});

const roleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["gestor", "analista"]),
});

const linkSchema = z.object({
  user_id: z.string().uuid(),
  colaborador_id: z.string().uuid().nullable(),
});

const deleteSchema = z.object({ user_id: z.string().uuid() });
const resetSchema = z.object({ user_id: z.string().uuid() });
const inviteSchema = z.object({
  email: z.string().email().max(255),
  role: z.enum(["gestor", "analista"]),
});

export const Route = createFileRoute("/api/admin/usuarios")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { admin } = await requireGestor(request);
          const { data: usersResp, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
          if (error) return jsonError(error.message, 500);

          const ids = usersResp.users.map((u) => u.id);
          const [{ data: profiles }, { data: roles }] = await Promise.all([
            admin
              .from("profiles")
              .select("user_id,nome,email,avatar_url,cargo,colaborador_id,must_change_password")
              .in("user_id", ids),
            admin.from("user_roles").select("user_id,role").in("user_id", ids),
          ]);

          const pMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
          const rMap = new Map<string, "gestor" | "analista">();
          for (const r of roles ?? []) {
            if (r.role === "gestor") rMap.set(r.user_id, "gestor");
            else if (!rMap.has(r.user_id)) rMap.set(r.user_id, r.role as "analista");
          }

          const usuarios: UsuarioRow[] = usersResp.users.map((u) => {
            const p = pMap.get(u.id);
            return {
              user_id: u.id,
              email: u.email ?? p?.email ?? null,
              nome: p?.nome ?? null,
              avatar_url: p?.avatar_url ?? null,
              cargo: p?.cargo ?? null,
              colaborador_id: p?.colaborador_id ?? null,
              role: rMap.get(u.id) ?? null,
              must_change_password: p?.must_change_password ?? false,
              created_at: u.created_at ?? null,
              last_sign_in_at: u.last_sign_in_at ?? null,
              email_confirmed_at: u.email_confirmed_at ?? null,
            };
          });

          return Response.json({ usuarios });
        } catch (e) {
          if (e instanceof Response) return e;
          console.error("api.admin.usuarios GET error:", e);
          return jsonError("Erro interno ao listar usuários", 500);
        }
      },

      POST: async ({ request }) => {
        try {
          const { admin, userId } = await requireGestor(request);
          const url = new URL(request.url);
          const action = url.searchParams.get("action");
          const body = await request.json();

          if (action === "create") {
            const data = createSchema.parse(body);
            const tempPassword = gerarSenhaTemporaria();
            const { data: created, error } = await admin.auth.admin.createUser({
              email: data.email,
              password: tempPassword,
              email_confirm: true,
              user_metadata: { nome: data.nome },
            });
            if (error) return jsonError(error.message, 400);
            const newId = created.user?.id;
            if (!newId) return jsonError("Falha ao criar usuário", 500);
            await admin.from("user_roles").delete().eq("user_id", newId);
            await admin.from("user_roles").insert({ user_id: newId, role: data.role });
            const updates: { nome: string; must_change_password: boolean; colaborador_id?: string } = {
              nome: data.nome,
              must_change_password: true,
            };
            if (data.colaborador_id) updates.colaborador_id = data.colaborador_id;
            await admin.from("profiles").update(updates).eq("user_id", newId);
            return Response.json({ ok: true, user_id: newId, temp_password: tempPassword });
          }

          if (action === "reset-password") {
            const data = resetSchema.parse(body);
            const tempPassword = gerarSenhaTemporaria();
            const { error } = await admin.auth.admin.updateUserById(data.user_id, {
              password: tempPassword,
            });
            if (error) return jsonError(error.message, 400);
            await admin
              .from("profiles")
              .update({ must_change_password: true })
              .eq("user_id", data.user_id);
            return Response.json({ ok: true, temp_password: tempPassword });
          }

          if (action === "role") {
            const data = roleSchema.parse(body);
            if (data.user_id === userId && data.role !== "gestor") {
              const { count } = await admin
                .from("user_roles")
                .select("*", { count: "exact", head: true })
                .eq("role", "gestor");
              if ((count ?? 0) <= 1) {
                return jsonError("Você é o único gestor; não pode rebaixar a si mesmo.", 400);
              }
            }
            await admin.from("user_roles").delete().eq("user_id", data.user_id);
            const { error } = await admin
              .from("user_roles")
              .insert({ user_id: data.user_id, role: data.role });
            if (error) return jsonError(error.message, 400);
            return Response.json({ ok: true });
          }

          if (action === "link") {
            const data = linkSchema.parse(body);
            if (data.colaborador_id) {
              await admin
                .from("profiles")
                .update({ colaborador_id: null })
                .eq("colaborador_id", data.colaborador_id)
                .neq("user_id", data.user_id);
            }
            const { error } = await admin
              .from("profiles")
              .update({ colaborador_id: data.colaborador_id })
              .eq("user_id", data.user_id);
            if (error) return jsonError(error.message, 400);
            return Response.json({ ok: true });
          }

          if (action === "delete") {
            const data = deleteSchema.parse(body);
            if (data.user_id === userId) {
              return jsonError("Você não pode remover seu próprio usuário.", 400);
            }
            const { error } = await admin.auth.admin.deleteUser(data.user_id);
            if (error) return jsonError(error.message, 400);
            return Response.json({ ok: true });
          }

          if (action === "invite") {
            const data = inviteSchema.parse(body);
            const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
            const { error } = await admin.from("invite_token").insert({
              email: data.email,
              role: data.role,
              token,
              created_by: userId,
            });
            if (error) {
              console.error("invite insert error", error);
              return jsonError("Não foi possível gerar o convite", 500);
            }
            return Response.json({ ok: true, token, email: data.email, role: data.role });
          }

          return jsonError("Ação inválida", 400);
        } catch (e) {
          if (e instanceof Response) return e;
          if (e instanceof z.ZodError) return jsonError(e.issues[0]?.message ?? "Dados inválidos", 400);
          console.error("api.admin.usuarios POST error:", e);
          return jsonError("Erro interno", 500);
        }
      },
    },
  },
});
