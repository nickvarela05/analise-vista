import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/lib/auth-context";
import { EsqueletoPagina } from "@/components/shared/Esqueletos";

/** Mostra o conteúdo só para gestor (menu Gestão, 08/10/2026); os demais veem um aviso. */
export function SomenteGestor({ children }: { children: ReactNode }) {
  const { role, loading } = useAuth();
  if (loading) {
    return <EsqueletoPagina />;
  }
  if (role !== "gestor") {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Esta tela é só para gestores."
      />
    );
  }
  return <>{children}</>;
}
