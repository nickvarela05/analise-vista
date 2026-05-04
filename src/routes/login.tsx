import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import * as React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import logoUrl from "@/assets/logo.png";

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center ${compact ? "gap-3" : "gap-4"}`}>
      {/* Vitrine do logo: anel cromático + halo + monograma original preservado */}
      <div className="relative">
        {/* Halo difuso */}
        <div
          aria-hidden
          className="absolute -inset-3 rounded-2xl blur-2xl opacity-70"
          style={{
            background:
              "conic-gradient(from 140deg, oklch(0.72 0.14 180 / 0.55), oklch(0.55 0.18 200 / 0.35), oklch(0.78 0.16 160 / 0.45), oklch(0.72 0.14 180 / 0.55))",
          }}
        />
        {/* Anel cromático girando lentamente */}
        <div
          aria-hidden
          className="absolute -inset-[3px] rounded-2xl animate-[spin_14s_linear_infinite]"
          style={{
            background:
              "conic-gradient(from 0deg, oklch(0.78 0.16 160), oklch(0.55 0.18 210), oklch(0.85 0.12 180), oklch(0.78 0.16 160))",
            WebkitMask:
              "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            padding: 1.5,
          }}
        />
        {/* Frame do monograma — fundo escuro vidro */}
        <div
          className={`relative ${compact ? "h-14 w-14" : "h-16 w-16"} grid place-items-center rounded-2xl bg-sidebar/80 ring-1 ring-white/10 backdrop-blur-sm shadow-[inset_0_1px_0_oklch(1_0_0/0.08),0_8px_30px_-8px_oklch(0.55_0.18_200/0.45)]`}
        >
          <img
            src={logoUrl}
            alt="Sisteplan"
            width={64}
            height={64}
            className={`${compact ? "h-9 w-9" : "h-10 w-10"} object-contain drop-shadow-[0_2px_8px_oklch(0.78_0.16_180/0.55)]`}
          />
          {/* Brilho diagonal sutil */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl bg-[linear-gradient(120deg,transparent_30%,oklch(1_0_0/0.18)_45%,transparent_60%)] opacity-60"
          />
        </div>
        {/* Pontinho de status pulsando */}
        <span
          aria-hidden
          className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-sidebar shadow-[0_0_12px_oklch(0.78_0.16_160/0.9)] animate-pulse"
        />
      </div>

      {/* Wordmark em camadas */}
      <div className="leading-none">
        <div className="flex items-baseline gap-1">
          <span
            className={`${compact ? "text-xl" : "text-2xl"} font-semibold tracking-[0.18em] text-sidebar-foreground`}
            style={{
              backgroundImage:
                "linear-gradient(180deg, oklch(0.98 0.01 180) 0%, oklch(0.78 0.06 180) 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            SISTE
          </span>
          <span
            className={`${compact ? "text-xl" : "text-2xl"} font-light tracking-[0.18em]`}
            style={{
              backgroundImage:
                "linear-gradient(180deg, oklch(0.85 0.14 180) 0%, oklch(0.55 0.18 210) 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            PLAN
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <span
            aria-hidden
            className="h-px w-6 bg-gradient-to-r from-transparent via-sidebar-foreground/60 to-sidebar-foreground/0"
          />
          <span className="text-[10px] uppercase tracking-[0.32em] text-sidebar-foreground/55">
            Gestão Interna
          </span>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

const signupSchema = loginSchema.extend({
  nome: z.string().min(2, "Informe seu nome").max(120),
  invite: z.string().min(8, "Informe o código de convite"),
});

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [loading, setLoading] = React.useState(false);

  const finishLogin = React.useCallback(() => {
    let target = "/";
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const r = params.get("redirect");
      if (r && r.startsWith("/") && !r.startsWith("//")) target = r;
    }
    window.location.replace(target);
  }, []);

  React.useEffect(() => {
    if (!authLoading && session) finishLogin();
  }, [session, authLoading, finishLogin]);

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const signupForm = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: "", password: "", nome: "", invite: "" },
  });

  const onLogin = async (values: z.infer<typeof loginSchema>) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    setLoading(false);

    if (error) {
      toast.error("Falha no login", { description: error.message });
      return;
    }

    toast.success("Login realizado com sucesso");
    finishLogin();
  };

  const onSignup = async (values: z.infer<typeof signupSchema>) => {
    setLoading(true);
    const redirectTo = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: redirectTo,
        data: { nome: values.nome, invite_token: values.invite },
      },
    });
    setLoading(false);
    if (error) {
      toast.error("Falha no cadastro", {
        description: /invite|convite/i.test(error.message)
          ? "Código de convite inválido ou expirado. Solicite um novo ao gestor."
          : error.message,
      });
      return;
    }
    toast.success("Cadastro realizado", {
      description: "Verifique seu e-mail para confirmar o acesso.",
    });
  };

  return (
    <div className="flex min-h-screen w-full">
      {/* Painel decorativo */}
      <div className="relative hidden flex-1 overflow-hidden bg-sidebar lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,oklch(0.6_0.09_180/0.25),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,oklch(0.7_0.1_180/0.18),transparent_50%)]" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-sidebar-foreground">
          <BrandMark />


          <div className="max-w-md space-y-4">
            <h2 className="text-3xl font-semibold leading-tight">
              Centralize demandas, tarefas e reuniões da Análise de Requisitos.
            </h2>
            <p className="text-sm text-sidebar-foreground/70">
              Plataforma interna para acompanhar o trabalho da equipe — com integração pronta
              para automações e fluxos via n8n.
            </p>
          </div>

          <p className="text-xs text-sidebar-foreground/50">
            © {new Date().getFullYear()} Sisteplan · Uso interno
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="flex flex-1 items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md border-border/60 shadow-lg">
          <CardContent className="p-8">
            <div className="mb-6 flex justify-center lg:hidden">
              <BrandMark compact />
            </div>

            <h1 className="text-xl font-semibold tracking-tight">Acessar plataforma</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Entre com seu e-mail corporativo.
            </p>

            <Tabs defaultValue="login" className="mt-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Cadastrar</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    onLogin(loginForm.getValues());
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email">E-mail</Label>
                    <Input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      {...loginForm.register("email")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-password">Senha</Label>
                    <Input
                      id="login-password"
                      type="password"
                      autoComplete="current-password"
                      {...loginForm.register("password")}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Entrar
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-4">
                <form onSubmit={signupForm.handleSubmit(onSignup)} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="su-nome">Nome</Label>
                    <Input id="su-nome" {...signupForm.register("nome")} />
                    {signupForm.formState.errors.nome && (
                      <p className="text-xs text-destructive">
                        {signupForm.formState.errors.nome.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-email">E-mail</Label>
                    <Input id="su-email" type="email" {...signupForm.register("email")} />
                    {signupForm.formState.errors.email && (
                      <p className="text-xs text-destructive">
                        {signupForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-pass">Senha</Label>
                    <Input
                      id="su-pass"
                      type="password"
                      autoComplete="new-password"
                      {...signupForm.register("password")}
                    />
                    {signupForm.formState.errors.password && (
                      <p className="text-xs text-destructive">
                        {signupForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-invite">Código de convite</Label>
                    <Input id="su-invite" {...signupForm.register("invite")} placeholder="Cole aqui o código recebido do gestor" />
                    {signupForm.formState.errors.invite && (
                      <p className="text-xs text-destructive">
                        {signupForm.formState.errors.invite.message}
                      </p>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Criar conta
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Cadastro requer convite. Solicite ao seu gestor.
                  </p>
                </form>
              </TabsContent>
            </Tabs>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              <Link to="/" className="hover:text-foreground">
                ← Voltar
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
