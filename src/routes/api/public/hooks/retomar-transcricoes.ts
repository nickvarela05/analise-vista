import { createFileRoute } from "@tanstack/react-router";

/**
 * Vigia anti-travamento das transcrições de reunião.
 *
 * Procura reuniões em `processando`/`pausado` que não recebem atualização há
 * mais de 10 minutos e dispara uma nova execução da transcrição, que continua
 * da última parte concluída. Protegido por CRON_SECRET (Bearer).
 */
export const Route = createFileRoute("/api/public/hooks/retomar-transcricoes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        const secret = process.env.CRON_SECRET;
        if (!secret || token !== secret) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const limite = new Date(Date.now() - 10 * 60 * 1000).toISOString();

          const { data, error } = await supabaseAdmin
            .from("reuniao")
            .select("id, audio_path, transcricao_status, transcricao_rodadas")
            .in("transcricao_status", ["processando", "pausado"])
            .lt("updated_at", limite)
            .limit(5);
          if (error) throw error;

          const alvos = (data ?? []).filter((r) => !!r.audio_path);
          let retomadas = 0;

          for (const r of alvos) {
            const res = await fetch(
              `${process.env.SUPABASE_URL}/functions/v1/transcrever-reuniao`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-internal-secret": secret,
                  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
                },
                body: JSON.stringify({
                  reuniao_id: r.id,
                  audio_path: r.audio_path,
                  retomar: true,
                }),
              },
            );
            if (res.ok) retomadas++;
          }

          return new Response(
            JSON.stringify({ ok: true, encontradas: alvos.length, retomadas }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
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
