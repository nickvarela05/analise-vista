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
  created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
};

const inviteSchema = z.object({
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
            admin.from("profiles").select("user_id,nome,email,avatar_url,cargo,colaborador_id").in("user_id", ids),
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
              created_at: u.created_at ?? null,
              last_sign_in_at: u.last_sign_in_at ?? null,
              email_confirmed_at: u.email_confirmed_at ?? null,
            };
          });

          return Response.json({ usuarios });
        } catch (e) {
          if (e instanceof Response) return e;
          return jsonError((e as Error).message, 500);
        }
      },

      POST: async ({ request }) => {
        try {
          const { admin, userId } = await requireGestor(request);
          const url = new URL(request.url);
          const action = url.searchParams.get("action");
          const body = await request.json();

          if (action === "invite") {
            const data = inviteSchema.parse(body);
            const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(data.email, {
              data: { nome: data.nome },
            });
            if (error) return jsonError(error.message, 400);
            const newId = invited.user?.id;
            if (!newId) return jsonError("Falha ao criar usuário", 500);
            await admin.from("user_roles").delete().eq("user_id", newId);
            await admin.from("user_roles").insert({ user_id: newId, role: data.role });
            const updates: { nome: string; colaborador_id?: string } = { nome: data.nome };
            if (data.colaborador_id) updates.colaborador_id = data.colaborador_id;
            await admin.from("profiles").update(updates).eq("user_id", newId);
            return Response.json({ ok: true, user_id: newId });
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

          return jsonError("Ação inválida", 400);
        } catch (e) {
          if (e instanceof Response) return e;
          if (e instanceof z.ZodError) return jsonError(e.errors[0]?.message ?? "Dados inválidos", 400);
          return jsonError((e as Error).message, 500);
        }
      },
    },
  },
});
