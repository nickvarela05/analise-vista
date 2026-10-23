import * as React from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/lib/auth-context";
import { BackgroundJobsIndicator } from "@/components/reunioes/BackgroundJobsIndicator";
import { EsqueletoPagina } from "@/components/shared/Esqueletos";

/**
 * @param bare Sem menu e cabeçalho, só com as checagens de login (usado pelo Modo TV).
 */
export function AppLayout({
  children,
  bare = false,
}: {
  children: React.ReactNode;
  bare?: boolean;
}) {
  const { session, sessaoPronta, loading, mustChangePassword } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  // Endereço pedido: lido do navegador, porque no primeiro carregamento o roteador ainda está
  // na casca inicial ("/") e o ?redirect= saía vazio (visto na prévia em 13/10/2026).
  const path =
    (typeof window !== "undefined" ? window.location.pathname : location.pathname) || "/";

  // Desvio para o login ou para a troca de senha, uma vez só. Antes era um <Navigate> no render,
  // que a cada nova renderização disparava outra navegação: abrir uma página interna sem login
  // gerava 53 erros "React #185" (laço de atualização) e perdia o endereço pedido (13/10/2026).
  // A página monta assim que a sessão é lida; papel e troca de senha chegam em paralelo e, se
  // for preciso trocar a senha, o desvio acontece logo depois (23/10/2026).
  const destino = !sessaoPronta
    ? null
    : !session
      ? path === "/login" || path === "/"
        ? "/login"
        : `/login?redirect=${encodeURIComponent(path + (typeof window !== "undefined" ? window.location.search : ""))}`
      : !loading && mustChangePassword && path !== "/alterar-senha"
        ? "/alterar-senha"
        : null;
  const desviouPara = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!destino || desviouPara.current === destino) return;
    desviouPara.current = destino;
    void navigate({ href: destino, replace: true });
  }, [destino, navigate]);

  // Enquanto confere o login, mostra o esqueleto da página em vez da rodinha (23/10/2026).
  if (!sessaoPronta || destino) return <EsqueletoPagina />;

  if (bare) return <>{children}</>;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          {/* overflow-x-clip: nada dentro da página empurra a tela para o lado no celular (sem
              virar contêiner de rolagem, para não quebrar elementos fixos com sticky). */}
          <main className="animate-page-in min-w-0 flex-1 overflow-x-clip p-3 sm:p-4 lg:p-6">
            {children}
          </main>
        </SidebarInset>
      </div>
      <BackgroundJobsIndicator />
    </SidebarProvider>
  );
}
