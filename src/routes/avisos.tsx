import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/avisos")({
  component: AvisosRoute,
});

function AvisosRoute() {
  return (
    <AppLayout>
      <Avisos />
    </AppLayout>
  );
}

const TIPOS = ["informativo", "alerta", "critico"] as const;

function tipoStyle(t: string) {
  if (t === "critico") return "border-destructive/40 bg-destructive/5 text-destructive";
  if (t === "alerta") return "border-warning/40 bg-warning/5";
  return "border-info/40 bg-info/5";
}

function Avisos() {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const isGestor = role === "gestor";
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    titulo: "",
    mensagem: "",
    tipo: "informativo" as (typeof TIPOS)[number],
    ativo: true,
  });

  const { data = [], isLoading } = useQuery({
    queryKey: ["avisos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aviso_gestor")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim() || !form.mensagem.trim()) return;
    const { error } = await supabase.from("aviso_gestor").insert({ ...form, criado_por: user?.id });
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    toast.success("Aviso publicado");
    setOpen(false);
    setForm({ titulo: "", mensagem: "", tipo: "informativo", ativo: true });
    qc.invalidateQueries({ queryKey: ["avisos"] });
    qc.invalidateQueries({ queryKey: ["dash-avisos"] });
  };

  const toggle = async (id: string, ativo: boolean) => {
    const { error } = await supabase.from("aviso_gestor").update({ ativo }).eq("id", id);
    if (error) toast.error("Erro", { description: error.message });
    else qc.invalidateQueries({ queryKey: ["avisos"] });
  };

  const remover = async (id: string) => {
    if (!confirm("Excluir este aviso?")) return;
    const { error } = await supabase.from("aviso_gestor").delete().eq("id", id);
    if (error) toast.error("Erro", { description: error.message });
    else {
      toast.success("Aviso removido");
      qc.invalidateQueries({ queryKey: ["avisos"] });
    }
  };

  return (
    <div>
      <PageHeader
        title="Avisos do Gestor"
        description="Comunicados da liderança para a equipe."
        actions={
          isGestor && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> Novo aviso</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo aviso</DialogTitle></DialogHeader>
                <form onSubmit={criar} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Título</Label>
                    <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Mensagem</Label>
                    <Textarea rows={4} value={form.mensagem} onChange={(e) => setForm({ ...form, mensagem: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tipo</Label>
                    <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as typeof form.tipo })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <DialogFooter><Button type="submit">Publicar</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )
        }
      />

      {isLoading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : data.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="Nenhum aviso ativo" />
      ) : (
        <div className="space-y-3">
          {data.map((a) => (
            <Card key={a.id} className={`border ${tipoStyle(a.tipo)}`}>
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize text-[10px]">{a.tipo}</Badge>
                    {!a.ativo && <Badge variant="secondary" className="text-[10px]">inativo</Badge>}
                  </div>
                  <h3 className="mt-2 text-sm font-semibold">{a.titulo}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{a.mensagem}</p>
                </div>
                {isGestor && (
                  <div className="flex items-center gap-3">
                    <Switch checked={a.ativo} onCheckedChange={(v) => toggle(a.id, v)} />
                    <Button variant="ghost" size="icon" onClick={() => remover(a.id)} className="h-8 w-8">
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
