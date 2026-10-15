import { createFileRoute } from "@tanstack/react-router";

/**
 * Volta do consentimento do Google (OAuth). O state assinado prova qual gestor
 * iniciou a conexão; aqui só se troca o code pelo refresh token e se volta para
 * Configurações com o resultado na URL.
 */
export const Route = createFileRoute("/api/public/google-oauth-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const voltar = (resultado: string) =>
          Response.redirect(
            `${url.origin}/configuracoes?google=${encodeURIComponent(resultado)}`,
            302,
          );
        try {
          const { validarState, concluirConexao } = await import("@/lib/google-auth.server");
          const userId = await validarState(url.searchParams.get("state"));
          if (!userId) return voltar("erro: link expirado ou inválido, tente de novo");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: gestor } = await supabaseAdmin
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .eq("role", "gestor")
            .maybeSingle();
          if (!gestor) return voltar("erro: apenas gestores conectam a conta Google");
          const erroGoogle = url.searchParams.get("error");
          if (erroGoogle) return voltar(`erro: ${erroGoogle}`);
          const code = url.searchParams.get("code");
          if (!code) return voltar("erro: o Google não devolveu o código");
          const email = await concluirConexao(url.origin, code, userId);
          return voltar(`conectado ${email ?? ""}`.trim());
        } catch (e) {
          return voltar(`erro: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300));
        }
      },
    },
  },
});
