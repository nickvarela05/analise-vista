import * as React from "react";
import { Loader2 } from "lucide-react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/lib/auth-context";
import { BackgroundJobsIndicator } from "@/components/reunioes/BackgroundJobsIndicator";

/**
 * @param bare Sem menu e cabeçalho, só com as checagens de login (usado pelo Modo TV).
 */
export function AppLayout({ children, bare = false }: { children: React.ReactNode; bare?: boolean }) {
  const { session, loading, mustChangePassword } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  // Endereço pedido: lido do navegador, porque no primeiro carregamento o roteador ainda está
  // na casca inicial ("/") e o ?redirect= saía vazio (visto na prévia em 13/10/2026).
  const path =
    (typeof window !== "undefined" ? window.location.pathname : location.pathname) || "/";

  // Desvio para o login ou para a troca de senha, uma vez só. Antes era um <Navigate> no render,
  // que a cada nova renderização disparava outra navegação: abrir uma página interna sem login
  // gerava 53 erros "React #185" (laço de atualização) e perdia o endereço pedido (13/10/2026).
  const destino = loading
    ? null
    : !session
      ? path === "/login" || path === "/"
        ? "/login"
        : `/login?redirect=${encodeURIComponent(path + (typeof window !== "undefined" ? window.location.search : ""))}`
      : mustChangePassword && path !== "/alterar-senha"
        ? "/alterar-senha"
        : null;
  const desviouPara = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!destino || desviouPara.current === destino) return;
    desviouPara.current = destino;
    void navigate({ href: destino, replace: true });
  }, [destino, navigate]);

  if (loading || destino) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (bare) return <>{children}</>;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/30">
        <AppSidebar />
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          <main className="min-w-0 flex-1 p-3 sm:p-4 lg:p-6">{children}</main>
        </SidebarInset>
      </div>
      <BackgroundJobsIndicator />
    </SidebarProvider>
  );
}
