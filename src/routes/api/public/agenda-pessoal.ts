import { createFileRoute } from "@tanstack/react-router";

/**
 * Agenda pessoal do Nickolas para o MemorIA (27/10/2026): reuniões e processos anuais dele, só leitura.
 * Protegido por AGENDA_PESSOAL_TOKEN (Bearer), o mesmo valor gravado no MemorIA como NEXUS_AGENDA_TOKEN.
 * GET /api/public/agenda-pessoal?de=AAAA-MM-DD&ate=AAAA-MM-DD
 */
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const Route = createFileRoute("/api/public/agenda-pessoal")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        const esperado = process.env.AGENDA_PESSOAL_TOKEN;
        if (!esperado || token !== esperado) return json({ error: "unauthorized" }, 401);
        const url = new URL(request.url);
        try {
          const { lerAgendaPessoal } = await import("@/lib/agenda-pessoal.server");
          return json(
            await lerAgendaPessoal(
              url.searchParams.get("de") ?? "",
              url.searchParams.get("ate") ?? "",
            ),
          );
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : String(e) }, 400);
        }
      },
    },
  },
});
