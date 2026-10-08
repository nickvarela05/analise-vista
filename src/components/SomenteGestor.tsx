import type { ReactNode } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/lib/auth-context";

/** Mostra o conteúdo só para gestor (menu Gestão, 08/10/2026); os demais veem um aviso. */
export function SomenteGestor({ children }: { children: ReactNode }) {
  const { role, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
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
