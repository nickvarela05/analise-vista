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
    if (data.google_calendar_id !== undefined) patch.google_calendar_id = data.google_calendar_id || null;
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

export const listGoogleCalendars = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureGestor(context.userId);
    const bearer = process.env.LOVABLE_API_KEY;
    const key = process.env.GOOGLE_CALENDAR_API_KEY;
    if (!bearer || !key) throw new Error("Conector Google Agenda não configurado.");
    const res = await fetch(
      "https://connector-gateway.lovable.dev/google_calendar/calendar/v3/users/me/calendarList",
      {
        headers: {
          Authorization: `Bearer ${bearer}`,
          "X-Connection-Api-Key": key,
        },
      },
    );
    if (!res.ok) throw new Error(`Falha ao listar calendários: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as {
      items?: Array<{ id: string; summary: string; primary?: boolean; accessRole?: string }>;
    };
    return (body.items ?? [])
      .filter((c) => c.accessRole === "owner" || c.accessRole === "writer")
      .map((c) => ({ id: c.id, summary: c.summary, primary: !!c.primary }));
  });
