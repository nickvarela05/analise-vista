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

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

const signupSchema = loginSchema.extend({
  nome: z.string().min(2, "Informe seu nome"),
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
    defaultValues: { email: "", password: "", nome: "" },
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
        data: { nome: values.nome },
      },
    });
    setLoading(false);
    if (error) {
      toast.error("Falha no cadastro", { description: error.message });
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
          <div className="flex items-center gap-4">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-sidebar-primary/30 to-sidebar-primary/10 ring-1 ring-sidebar-primary/40 shadow-[0_0_40px_-8px_var(--sidebar-primary)]">
              <div className="absolute inset-0 rounded-2xl bg-sidebar-primary/10 blur-xl" />
              <img
                src={logoUrl}
                alt="Sisteplan"
                className="relative h-14 w-14 object-contain drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)]"
              />
            </div>
            <div className="leading-tight">
              <p className="text-2xl font-bold tracking-wide">SISTEPLAN</p>
              <p className="text-[11px] uppercase tracking-[0.25em] text-sidebar-foreground/70">
                Gestão Interna
              </p>
            </div>
          </div>

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
            <div className="mb-6 flex flex-col items-center text-center lg:hidden">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/30 shadow-[0_0_30px_-6px_var(--primary)]">
                <img src={logoUrl} alt="" className="h-14 w-14 object-contain" />
              </div>
              <h1 className="mt-3 text-xl font-bold tracking-wide">SISTEPLAN</h1>
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
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Criar conta
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    O primeiro usuário cadastrado vira <strong>gestor</strong>.
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
