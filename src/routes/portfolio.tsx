import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { GaleriaDialog } from "@/components/equipe/GaleriaDialog";

export const Route = createFileRoute("/portfolio")({
  component: PortfolioRoute,
});

function PortfolioRoute() {
  return (
    <AppLayout>
      <Portfolio />
    </AppLayout>
  );
}

function Portfolio() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const isGestor = role === "gestor";
  const [open, setOpen] = React.useState(false);
  const [foto, setFoto] = React.useState<File | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({ nome: "", cargo: "", bio: "", email: "" });

  const { data = [], isLoading } = useQuery({
    queryKey: ["colaboradores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaborador")
        .select("*")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setSaving(true);

    let foto_url: string | null = null;
    if (foto) {
      const path = `team/${Date.now()}-${foto.name}`;
      const { error: upErr } = await supabase.storage
        .from("colaborador-fotos")
        .upload(path, foto);
      if (upErr) {
        setSaving(false);
        toast.error("Erro no upload", { description: upErr.message });
        return;
      }
      const { data: pub } = supabase.storage.from("colaborador-fotos").getPublicUrl(path);
      foto_url = pub.publicUrl;
    }

    const { error } = await supabase.from("colaborador").insert({ ...form, foto_url });
    setSaving(false);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    toast.success("Colaborador adicionado");
    setOpen(false);
    setFoto(null);
    setForm({ nome: "", cargo: "", bio: "", email: "" });
    qc.invalidateQueries({ queryKey: ["colaboradores"] });
  };

  return (
    <div>
      <PageHeader
        title="Portfólio da Equipe"
        description="Conheça quem faz parte da Análise de Requisitos."
        actions={
          <div className="flex items-center gap-2">
            <GaleriaDialog canManage={isGestor} />
            {isGestor && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> Novo colaborador</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo colaborador</DialogTitle></DialogHeader>
                <form onSubmit={criar} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Nome</Label>
                    <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cargo</Label>
                    <Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>E-mail</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Bio</Label>
                    <Textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Foto</Label>
                    <Input type="file" accept="image/*" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={saving}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            )}
          </div>
        }
      />

      {isLoading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : data.length === 0 ? (
        <EmptyState icon={UsersIcon} title="Nenhum colaborador cadastrado" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => (
            <Card key={c.id} className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <Avatar className="h-14 w-14 ring-2 ring-primary/20">
                    {c.foto_url && <AvatarImage src={c.foto_url} />}
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {c.nome.split(" ").slice(0, 2).map((n) => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="truncate text-sm font-semibold">{c.nome}</h3>
                    {c.cargo && <p className="truncate text-xs text-muted-foreground">{c.cargo}</p>}
                  </div>
                </div>
                {c.bio && <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{c.bio}</p>}
                {c.email && <p className="mt-2 text-xs text-muted-foreground">{c.email}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
