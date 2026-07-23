import { createFileRoute } from "@tanstack/react-router";

/**
 * Endpoint público chamado pelo pg_cron para sincronizar Atividades Semanais
 * com o Google Agenda da equipe. Protegido por CRON_SECRET (Bearer).
 */
export const Route = createFileRoute("/api/public/hooks/sync-google-calendar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.replace(/^Bearer\s+/i, "");
        const expected = process.env.CRON_SECRET;
        if (!expected || token !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        try {
          const { syncGoogleCalendar } = await import("@/lib/google-calendar-sync.server");
          const result = await syncGoogleCalendar();
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
