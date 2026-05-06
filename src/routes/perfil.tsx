import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import * as React from "react";
import { Loader2, KeyRound, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/perfil")({
  component: PerfilRoute,
});

function PerfilRoute() {
  return (
    <AppLayout>
      <Perfil />
    </AppLayout>
  );
}

function Perfil() {
  const { user, role, loading } = useAuth();
  const [nome, setNome] = React.useState("");
  const [cargo, setCargo] = React.useState("");
  const [loadingProfile, setLoadingProfile] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("nome, cargo")
        .eq("user_id", user.id)
        .maybeSingle();
      setNome(data?.nome ?? "");
      setCargo(data?.cargo ?? "");
      setLoadingProfile(false);
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  const initials = (nome || user.email || "DV").slice(0, 2).toUpperCase();

  const onSave = async () => {
    if (!nome.trim()) {
      toast.error("Informe seu nome");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ nome: nome.trim(), cargo: cargo.trim() || null })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }
    toast.success("Perfil atualizado");
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title="Meu perfil" description="Atualize suas informações pessoais." />

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary text-base font-semibold text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <p className="text-sm font-medium">{user.email}</p>
                <Badge variant="outline" className="capitalize">
                  {role ?? "—"}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                disabled={loadingProfile}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cargo">Cargo</Label>
              <Input
                id="cargo"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                disabled={loadingProfile}
                placeholder="Ex: Analista de Requisitos"
              />
            </div>

            <Button onClick={onSave} disabled={saving || loadingProfile}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <UserIcon className="mr-2 h-4 w-4" />
              Salvar alterações
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Segurança</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link to="/alterar-senha">
                <KeyRound className="mr-2 h-4 w-4" /> Alterar senha
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
