import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import * as React from "react";
import { Loader2, KeyRound, User as UserIcon, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CargoSelect } from "@/components/equipe/CargoSelect";
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
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("nome, cargo, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      setNome(data?.nome ?? "");
      setCargo(data?.cargo ?? "");
      setAvatarUrl(data?.avatar_url ?? null);
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

  const onUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 5MB)");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, cacheControl: "3600" });
    if (upErr) {
      setUploading(false);
      toast.error("Erro no upload", { description: upErr.message });
      return;
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const newUrl = pub.publicUrl;
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: newUrl })
      .eq("user_id", user.id);
    setUploading(false);
    if (error) {
      toast.error("Erro ao salvar foto", { description: error.message });
      return;
    }
    setAvatarUrl(newUrl);
    toast.success("Foto atualizada");
  };

  const onRemovePhoto = async () => {
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("user_id", user.id);
    if (error) {
      toast.error("Erro ao remover foto", { description: error.message });
      return;
    }
    setAvatarUrl(null);
    toast.success("Foto removida");
  };

  const onSave = async () => {
    if (!nome.trim()) {
      toast.error("Informe seu nome");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ nome: nome.trim(), cargo: cargo || null })
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
              <Avatar className="h-20 w-20">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={nome} />}
                <AvatarFallback className="bg-primary text-base font-semibold text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{user.email}</p>
                  <Badge variant="outline" className="capitalize">
                    {role ?? "—"}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void onUpload(f);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    {avatarUrl ? "Trocar foto" : "Enviar foto"}
                  </Button>
                  {avatarUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={onRemovePhoto}
                      disabled={uploading}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Remover
                    </Button>
                  )}
                </div>
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
              <CargoSelect id="cargo" value={cargo} onChange={setCargo} />
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
