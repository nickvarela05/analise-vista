import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/_inspect-n8n")({
  server: {
    handlers: {
      GET: async () => {
        const url = process.env.N8N_DB_URL;
        const key =
          process.env.N8N_DB_SERVICE_ROLE_KEY ?? process.env.N8N_DB_ANON_KEY;
        if (!url || !key) {
          return Response.json(
            { ok: false, error: "Credenciais N8N_DB não configuradas" },
            { status: 500 },
          );
        }
        const res = await fetch(`${url}/rest/v1/`, {
          headers: { apikey: key, Authorization: `Bearer ${key}` },
        });
        if (!res.ok) {
          return Response.json(
            {
              ok: false,
              status: res.status,
              error: await res.text().catch(() => ""),
            },
            { status: 500 },
          );
        }
        const spec = (await res.json()) as {
          definitions?: Record<
            string,
            {
              properties?: Record<
                string,
                { type?: string; format?: string; description?: string }
              >;
            }
          >;
        };
        const tables = Object.entries(spec.definitions ?? {}).map(
          ([name, def]) => ({
            name,
            columns: Object.entries(def.properties ?? {}).map(([col, meta]) => ({
              name: col,
              type: meta.type,
              format: meta.format,
              description: meta.description,
            })),
          }),
        );
        return Response.json({ ok: true, tableCount: tables.length, tables });
      },
    },
  },
});
