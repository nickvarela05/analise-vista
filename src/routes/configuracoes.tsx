import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-provider";
import {
  Sun,
  Moon,
  LogOut,
  Settings2,
  Mail,
  ShieldCheck,
  Palette,
  Bell,
  Sparkles,
  User as UserIcon,
} from "lucide-react";
import { PreferenciasNotificacao } from "@/components/notificacoes/PreferenciasNotificacao";
import { ConfiguracoesEmails } from "@/components/notificacoes/ConfiguracoesEmails";
import { ConfiguracoesIA } from "@/components/notificacoes/ConfiguracoesIA";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHero } from "@/components/shared/PageHero";

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

  const initials =
    (user?.email ?? "?")
      .split("@")[0]
      .split(/[._-]/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Workspace"
        title="Configurações"
        description="Preferências da conta, notificações, envio de e-mails e instruções da IA."
        icon={Settings2}
        tone="indigo"
        statsGridClassName="grid-cols-2 sm:grid-cols-4"
        stats={[
          {
            label: "Papel",
            value: role ?? "—",
            icon: ShieldCheck,
            tone: "indigo",
          },
          {
            label: "Tema atual",
            value: theme === "dark" ? "Escuro" : "Claro",
            icon: theme === "dark" ? Moon : Sun,
            tone: theme === "dark" ? "violet" : "amber",
          },
          {
            label: "Eventos notificáveis",
            value: 8,
            icon: Bell,
            tone: "primary",
          },
          {
            label: "Canais",
            value: "2",
            hint: "Sistema · E-mail",
            icon: Mail,
            tone: "sky",
          },
        ]}
      />

      <Tabs defaultValue="conta" className="space-y-5">
        <div className="rounded-2xl border bg-card/60 p-1 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/50">
          <TabsList className="h-auto w-full justify-start gap-1 bg-transparent p-0">
            {[
              { v: "conta", label: "Conta", icon: UserIcon },
              { v: "notificacoes", label: "Notificações", icon: Bell },
              { v: "emails", label: "E-mails", icon: Mail },
              { v: "ia", label: "IA", icon: Sparkles },
            ].map((t) => (
              <TabsTrigger
                key={t.v}
                value={t.v}
                className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm data-[state=active]:bg-indigo-500/10 data-[state=active]:text-indigo-700 data-[state=active]:shadow-none dark:data-[state=active]:text-indigo-300"
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="conta" className="space-y-4">
          {/* Identidade */}
          <Card className="overflow-hidden border-indigo-500/15">
            <div className="relative bg-gradient-to-br from-indigo-500/10 via-background to-background p-5">
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-500/15 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl" />
              <div className="relative flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 text-base font-semibold text-indigo-700 ring-1 ring-indigo-500/30 dark:text-indigo-300">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Conta
                  </p>
                  <p className="truncate text-sm font-medium">{user?.email}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-indigo-500/30 bg-indigo-500/10 capitalize text-indigo-700 dark:text-indigo-300"
                    >
                      <ShieldCheck className="mr-1 h-3 w-3" />
                      {role ?? "—"}
                    </Badge>
                    <Badge variant="outline" className="text-[11px]">
                      Sessão ativa
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Aparência */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-amber-500/15 p-2.5 text-amber-600 ring-1 ring-amber-500/25 dark:text-amber-400">
                  <Palette className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Tema da interface</p>
                  <p className="text-xs text-muted-foreground">
                    Atualmente usando o tema{" "}
                    <span className="font-medium text-foreground">
                      {theme === "dark" ? "escuro" : "claro"}
                    </span>
                    .
                  </p>
                </div>
                <Button variant="outline" onClick={toggle} className="gap-2">
                  {theme === "dark" ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                  Mudar para {theme === "dark" ? "claro" : "escuro"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sessão */}
          <Card className="border-destructive/20">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-destructive/10 p-2.5 text-destructive ring-1 ring-destructive/25">
                  <LogOut className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Encerrar sessão</p>
                  <p className="text-xs text-muted-foreground">
                    Você será desconectado neste navegador.
                  </p>
                </div>
                <Button variant="destructive" onClick={() => signOut()} className="gap-2">
                  <LogOut className="h-4 w-4" />
                  Sair
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notificacoes">
          <PreferenciasNotificacao />
        </TabsContent>

        <TabsContent value="emails" className="space-y-4">
          <ConfiguracoesEmails />
          <DestinatariosResumoDiario />
        </TabsContent>

        <TabsContent value="ia">
          <ConfiguracoesIA />
        </TabsContent>
      </Tabs>
    </div>
  );
}
