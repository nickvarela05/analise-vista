import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import * as React from "react";
import { Loader2, KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/alterar-senha")({
  component: AlterarSenhaPage,
});

function AlterarSenhaPage() {
  const { session, user, loading, mustChangePassword, refreshMustChangePassword } = useAuth();
  const navigate = useNavigate();
  const [novaSenha, setNovaSenha] = React.useState("");
  const [confirmar, setConfirmar] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (novaSenha.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (novaSenha !== confirmar) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    if (error) {
      setSaving(false);
      toast.error("Erro ao atualizar senha", { description: error.message });
      return;
    }
    if (user) {
      await supabase
        .from("profiles")
        .update({ must_change_password: false })
        .eq("user_id", user.id);
    }
    await refreshMustChangePassword();
    setSaving(false);
    toast.success("Senha atualizada com sucesso!");
    navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <KeyRound className="h-5 w-5" />
          </div>
          <CardTitle>
            {mustChangePassword ? "Defina sua nova senha" : "Alterar senha"}
          </CardTitle>
          <CardDescription>
            {mustChangePassword
              ? "Você está usando uma senha temporária. Por segurança, defina uma senha pessoal antes de continuar."
              : "Escolha uma nova senha para sua conta."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="senha">Nova senha</Label>
              <Input
                id="senha"
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
              <p className="text-[11px] text-muted-foreground">Mínimo de 8 caracteres.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmar">Confirmar nova senha</Label>
              <Input
                id="confirmar"
                type="password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-4 w-4" />
              )}
              Salvar nova senha
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
