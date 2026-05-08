import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-provider";
import { Sun, Moon, LogOut } from "lucide-react";
import { PreferenciasNotificacao } from "@/components/notificacoes/PreferenciasNotificacao";

export const Route = createFileRoute("/configuracoes")({
  component: ConfigRoute,
});

function ConfigRoute() {
  return (
    <AppLayout>
      <Configuracoes />
    </AppLayout>
  );
}

function Configuracoes() {
  const { user, role, signOut } = useAuth();
  const { theme, toggle } = useTheme();

  return (
    <div className="max-w-2xl">
      <PageHeader title="Configurações" description="Preferências da conta e sessão." />

      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Conta</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">E-mail</span>
              <span className="font-medium">{user?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Papel</span>
              <Badge variant="outline" className="capitalize">{role ?? "—"}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Aparência</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Tema</p>
                <p className="text-xs text-muted-foreground">Alternar entre claro e escuro.</p>
              </div>
              <Button variant="outline" onClick={toggle}>
                {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                {theme === "dark" ? "Claro" : "Escuro"}
              </Button>
            </div>
          </CardContent>
        </Card>
        <PreferenciasNotificacao />

        <Card>
          <CardHeader><CardTitle className="text-base">Sessão</CardTitle></CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={() => signOut()}>
              <LogOut className="mr-2 h-4 w-4" /> Encerrar sessão
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
