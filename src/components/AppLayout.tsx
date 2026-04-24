import * as React from "react";
import { Loader2 } from "lucide-react";
import { Navigate, useLocation } from "@tanstack/react-router";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/lib/auth-context";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, loading, mustChangePassword } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    const path = location.pathname || "/";
    const search =
      path === "/login" || path === "/" ? undefined : { redirect: path };
    return <Navigate to="/login" search={search as never} replace />;
  }

  if (mustChangePassword && location.pathname !== "/alterar-senha") {
    return <Navigate to="/alterar-senha" replace />;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/30">
        <AppSidebar />
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          <main className="min-w-0 flex-1 p-3 sm:p-4 lg:p-6">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
