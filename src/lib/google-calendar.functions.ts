import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureGestor(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "gestor")
    .maybeSingle();
  if (error) throw new Error("Falha ao verificar papel do usuário.");
  if (!data) throw new Error("Apenas gestores podem gerenciar a integração com Google Agenda.");
}

export const getGoogleCalendarConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureGestor(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("google_calendar_config")
      .select("*")
      .eq("id", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

const updateSchema = z.object({
  google_calendar_id: z.string().trim().max(200).nullable().optional(),
  sync_ativo: z.boolean().optional(),
  dias_horizonte: z.number().int().min(1).max(180).optional(),
});

export const updateGoogleCalendarConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await ensureGestor(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: {
      google_calendar_id?: string | null;
      sync_ativo?: boolean;
      dias_horizonte?: number;
      updated_at?: string;
    } = { updated_at: new Date().toISOString() };
    if (data.google_calendar_id !== undefined)
      patch.google_calendar_id = data.google_calendar_id || null;
    if (data.sync_ativo !== undefined) patch.sync_ativo = data.sync_ativo;
    if (data.dias_horizonte !== undefined) patch.dias_horizonte = data.dias_horizonte;
    const { data: row, error } = await supabaseAdmin
      .from("google_calendar_config")
      .update(patch)
      .eq("id", true)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const runGoogleCalendarSyncNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureGestor(context.userId);
    const { syncGoogleCalendar } = await import("@/lib/google-calendar-sync.server");
    return await syncGoogleCalendar({ manual: true });
  });

/** URL para o gestor autorizar a conta Google da equipe (fluxo OAuth). */
export const startGoogleOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureGestor(context.userId);
    const { getRequest } = await import("@tanstack/react-start/server");
    const { urlConsentimento } = await import("@/lib/google-auth.server");
    return { url: await urlConsentimento(new URL(getRequest().url).origin, context.userId) };
  });

/** Conta Google conectada e se ela alcança o calendário configurado. */
export const checkGoogleCalendarAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureGestor(context.userId);
    const { contaConectada, googleCalendarFetch } = await import("@/lib/google-auth.server");
    const conta = await contaConectada();
    if (!conta)
      return { conta: null, ok: false, nome: null, erro: "Nenhuma conta Google conectada." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cfg } = await supabaseAdmin
      .from("google_calendar_config")
      .select("google_calendar_id")
      .eq("id", true)
      .maybeSingle();
    if (!cfg?.google_calendar_id) {
      return { conta: conta.email, ok: false, nome: null, erro: "Calendário não configurado." };
    }
    try {
      const res = await googleCalendarFetch(
        "GET",
        `/calendars/${encodeURIComponent(cfg.google_calendar_id)}`,
      );
      if (!res.ok) {
        const erro =
          res.status === 404
            ? `A conta ${conta.email ?? "conectada"} não tem acesso a esse calendário.`
            : `${res.status} ${await res.text()}`;
        return { conta: conta.email, ok: false, nome: null, erro };
      }
      const body = (await res.json()) as { summary?: string };
      return { conta: conta.email, ok: true, nome: body.summary ?? null, erro: null };
    } catch (e) {
      return {
        conta: conta.email,
        ok: false,
        nome: null,
        erro: e instanceof Error ? e.message : String(e),
      };
    }
  });
