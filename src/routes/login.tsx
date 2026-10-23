import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { NexusMark } from "@/components/NexusMark";
import { mensagemSenha, REGRA_SENHA_TEXTO } from "@/lib/domain/senha";

// Marca no visual "Grafite e menta" (23/10/2026): sem anel girando, halo, brilho nem texto em
// degradê; o "N" num quadrado de menta suave e o nome com peso.
function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`grid place-items-center rounded-2xl bg-primary/12 ${compact ? "h-11 w-11" : "h-12 w-12"}`}
      >
        <NexusMark className={compact ? "h-7 w-7" : "h-8 w-8"} />
      </div>
      <div className="leading-tight">
        <p className={`${compact ? "text-lg" : "text-xl"} font-semibold tracking-tight`}>Nexus</p>
        <p className="text-xs text-muted-foreground">Análise de requisitos</p>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

// No login não se confere a regra nova: quem tem senha antiga, mais fraca, precisa conseguir
// entrar para trocá-la (o Supabase avisa com "weak_password", tratado em onLogin).
const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

const signupSchema = loginSchema.extend({
  password: z.string().superRefine((s, ctx) => {
    const problema = mensagemSenha(s);
    if (problema) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problema });
  }),
  nome: z.string().min(2, "Informe seu nome").max(120),
  invite: z.string().min(8, "Informe o código de convite"),
});

const NETWORK_HINT =
  "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente em instantes.";

function isNetworkError(message: string) {
  return /failed to fetch|network|networkerror|load failed|retryable/i.test(message);
}

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const redirectedRef = React.useRef(false);

  const finishLogin = React.useCallback(() => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    let target = "/";
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const r = params.get("redirect");
      if (r && r.startsWith("/") && !r.startsWith("//")) target = r;
    }
    void navigate({ to: target, replace: true });
  }, [navigate]);

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
      // Senha válida, mas fora da regra nova (14/10/2026): se o Supabase abriu a sessão, leva
      // direto para a troca; se não, orienta a usar "Esqueci minha senha".
      const fraca =
        (error as { code?: string }).code === "weak_password" || /weak/i.test(error.name);
      if (fraca) {
        const { data: s } = await supabase.auth.getSession();
        if (s.session) {
          toast.warning("Sua senha precisa ser atualizada", { description: REGRA_SENHA_TEXTO });
          void navigate({ to: "/alterar-senha", replace: true });
          return;
        }
        toast.error("Sua senha não atende às regras novas", {
          description: `${REGRA_SENHA_TEXTO} Use "Esqueci minha senha" para criar uma nova.`,
        });
        return;
      }
      toast.error("Falha no login", {
        description: isNetworkError(error.message) ? NETWORK_HINT : error.message,
      });
      return;
    }

    toast.success("Login realizado com sucesso");
    finishLogin();
  };

  const onEsqueciSenha = async () => {
    const email = loginForm.getValues("email").trim();
    if (!z.string().email().safeParse(email).success) {
      toast.error("Informe seu e-mail", {
        description: "Digite o e-mail da sua conta no campo acima e clique de novo.",
      });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/alterar-senha?recuperacao=1`,
    });
    setLoading(false);
    if (error && (error.status === 429 || /security purposes|rate limit/i.test(error.message))) {
      toast.error("Aguarde um pouco", {
        description: "Já enviamos um link há pouco. Tente de novo em 1 minuto.",
      });
      return;
    }
    if (error && isNetworkError(error.message)) {
      toast.error("Falha ao enviar", { description: NETWORK_HINT });
      return;
    }
    // Mesma mensagem com ou sem conta cadastrada, para não revelar quais e-mails existem.
    toast.success("Verifique seu e-mail", {
      description:
        "Se houver uma conta com esse e-mail, enviamos um link para criar uma nova senha.",
    });
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
          : isNetworkError(error.message)
            ? NETWORK_HINT
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
      <div className="relative m-3 hidden flex-1 overflow-hidden rounded-3xl border border-border/60 bg-card lg:flex">
        {/* Um brilho de menta só, e uma trama de pontos bem leve para o fundo não ficar chapado. */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_420px_at_0%_0%,color-mix(in_oklab,var(--primary)_14%,transparent),transparent_65%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(color-mix(in_oklab,var(--foreground)_14%,transparent)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" />
        <div className="relative z-10 flex flex-col justify-between p-12">
          <BrandMark />

          <div className="max-w-md space-y-4">
            <h2 className="text-4xl font-semibold leading-[1.1] tracking-[-0.03em]">
              Centralize demandas, tarefas e reuniões da Análise de Requisitos.
            </h2>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Plataforma interna para acompanhar o trabalho da equipe — com integração pronta para
              automações e fluxos via n8n.
            </p>
          </div>

          <p className="text-xs text-muted-foreground/70">
            © {new Date().getFullYear()} Nexus · Uso interno
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="flex flex-1 items-center justify-center p-6">
        <Card className="animate-page-in w-full max-w-md rounded-3xl border-border/60 bg-card/80 shadow-none backdrop-blur-xl">
          <CardContent className="p-8">
            <div className="mb-6 flex justify-center lg:hidden">
              <BrandMark compact />
            </div>

            <h1 className="text-2xl font-semibold tracking-[-0.02em]">Acessar plataforma</h1>
            <p className="mt-1 text-sm text-muted-foreground">Entre com seu e-mail corporativo.</p>

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
                    <button
                      type="button"
                      onClick={onEsqueciSenha}
                      disabled={loading}
                      className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
                    >
                      Esqueci minha senha
                    </button>
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
                    <Input
                      id="su-invite"
                      {...signupForm.register("invite")}
                      placeholder="Cole aqui o código recebido do gestor"
                    />
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
