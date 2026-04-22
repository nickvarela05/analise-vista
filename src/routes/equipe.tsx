import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Users as UsersIcon, Clock, Plane, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/equipe")({
  component: EquipeRoute,
});

function EquipeRoute() {
  return (
    <AppLayout>
      <Equipe />
    </AppLayout>
  );
}

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function Equipe() {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [foto, setFoto] = React.useState<File | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({ nome: "", cargo: "", bio: "", email: "" });

  const { data: colabs = [], isLoading } = useQuery({
    queryKey: ["equipe"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaborador")
        .select("*, colaborador_horario(*), colaborador_ferias(*)")
        .eq("ativo", true)
        .order("ordem");
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
      const { error: upErr } = await supabase.storage.from("colaborador-fotos").upload(path, foto);
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
    qc.invalidateQueries({ queryKey: ["equipe"] });
  };

  return (
    <div>
      <PageHeader
        title="Equipe"
        description="Gerencie colaboradores, horários de expediente, almoço e férias."
        actions={
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
        }
      />

      {isLoading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : colabs.length === 0 ? (
        <EmptyState icon={UsersIcon} title="Nenhum colaborador cadastrado" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {colabs.map((c) => <ColaboradorCard key={c.id} colab={c} />)}
        </div>
      )}
    </div>
  );
}

function ColaboradorCard({ colab }: { colab: any }) {
  const qc = useQueryClient();
  const [openH, setOpenH] = React.useState(false);
  const [openF, setOpenF] = React.useState(false);

  const horarios = (colab.colaborador_horario ?? []).sort((a: any, b: any) => a.dia_semana - b.dia_semana);
  const ferias = colab.colaborador_ferias ?? [];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16 ring-2 ring-primary/20">
            {colab.foto_url && <AvatarImage src={colab.foto_url} />}
            <AvatarFallback className="bg-primary/10 text-primary">
              {colab.nome.split(" ").slice(0, 2).map((n: string) => n[0]).join("")}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold">{colab.nome}</h3>
            {colab.cargo && <p className="text-sm text-muted-foreground">{colab.cargo}</p>}
            {colab.email && <p className="text-xs text-muted-foreground">{colab.email}</p>}
          </div>
        </div>

        <Tabs defaultValue="horario" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="horario"><Clock className="mr-1 h-3.5 w-3.5" />Horário</TabsTrigger>
            <TabsTrigger value="ferias"><Plane className="mr-1 h-3.5 w-3.5" />Férias</TabsTrigger>
            <TabsTrigger value="bio">Bio</TabsTrigger>
          </TabsList>

          <TabsContent value="horario" className="mt-3">
            <div className="space-y-1.5 text-xs">
              {horarios.length === 0 ? (
                <p className="text-muted-foreground">Sem horários cadastrados.</p>
              ) : (
                horarios.map((h: any) => (
                  <div key={h.id} className="flex items-center justify-between border-b border-border/50 py-1">
                    <span className="font-medium">{DIAS[h.dia_semana]}</span>
                    <span className="text-muted-foreground">
                      Exp. {h.expediente_inicio?.slice(0, 5) ?? "—"}–{h.expediente_fim?.slice(0, 5) ?? "—"}
                      {h.almoco_inicio && ` · Almoço ${h.almoco_inicio.slice(0, 5)}–${h.almoco_fim?.slice(0, 5)} (${h.local_almoco ?? ""})`}
                    </span>
                  </div>
                ))
              )}
            </div>
            <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => setOpenH(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar horário
            </Button>
            <HorarioDialog open={openH} onOpenChange={setOpenH} colaboradorId={colab.id} onSaved={() => qc.invalidateQueries({ queryKey: ["equipe"] })} />
          </TabsContent>

          <TabsContent value="ferias" className="mt-3">
            <div className="space-y-1.5 text-xs">
              {ferias.length === 0 ? (
                <p className="text-muted-foreground">Sem férias programadas.</p>
              ) : (
                ferias.map((f: any) => (
                  <div key={f.id} className="flex items-center justify-between gap-2 border-b border-border/50 py-1">
                    <Badge variant="outline" className="text-[10px]">
                      {format(new Date(f.data_inicio), "dd/MM/yyyy")} – {format(new Date(f.data_fim), "dd/MM/yyyy")}
                    </Badge>
                    {f.observacao && <span className="truncate text-muted-foreground">{f.observacao}</span>}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={async () => {
                        const { error } = await supabase.from("colaborador_ferias").delete().eq("id", f.id);
                        if (error) toast.error("Erro", { description: error.message });
                        else qc.invalidateQueries({ queryKey: ["equipe"] });
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>
            <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => setOpenF(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar período
            </Button>
            <FeriasDialog open={openF} onOpenChange={setOpenF} colaboradorId={colab.id} onSaved={() => qc.invalidateQueries({ queryKey: ["equipe"] })} />
          </TabsContent>

          <TabsContent value="bio" className="mt-3">
            <p className="text-xs text-muted-foreground">{colab.bio || "Sem bio cadastrada."}</p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function HorarioDialog({ open, onOpenChange, colaboradorId, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; colaboradorId: string; onSaved: () => void }) {
  const [form, setForm] = React.useState({
    dia_semana: 1,
    expediente_inicio: "08:00",
    expediente_fim: "17:00",
    almoco_inicio: "12:00",
    almoco_fim: "13:00",
    local_almoco: "Copa",
  });

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase
      .from("colaborador_horario")
      .upsert({ colaborador_id: colaboradorId, ...form }, { onConflict: "colaborador_id,dia_semana" });
    if (error) toast.error("Erro", { description: error.message });
    else {
      toast.success("Horário salvo");
      onOpenChange(false);
      onSaved();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Adicionar horário</DialogTitle></DialogHeader>
        <form onSubmit={salvar} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Dia da semana</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={form.dia_semana}
              onChange={(e) => setForm({ ...form, dia_semana: Number(e.target.value) })}
            >
              {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Expediente início</Label><Input type="time" value={form.expediente_inicio} onChange={(e) => setForm({ ...form, expediente_inicio: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Expediente fim</Label><Input type="time" value={form.expediente_fim} onChange={(e) => setForm({ ...form, expediente_fim: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Almoço início</Label><Input type="time" value={form.almoco_inicio} onChange={(e) => setForm({ ...form, almoco_inicio: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Almoço fim</Label><Input type="time" value={form.almoco_fim} onChange={(e) => setForm({ ...form, almoco_fim: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Local do almoço</Label>
            <Input value={form.local_almoco} onChange={(e) => setForm({ ...form, local_almoco: e.target.value })} placeholder="Copa, Fora..." />
          </div>
          <DialogFooter><Button type="submit">Salvar</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FeriasDialog({ open, onOpenChange, colaboradorId, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; colaboradorId: string; onSaved: () => void }) {
  const [form, setForm] = React.useState({ data_inicio: "", data_fim: "", observacao: "" });

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.data_inicio || !form.data_fim) {
      toast.error("Informe início e fim");
      return;
    }
    const { error } = await supabase
      .from("colaborador_ferias")
      .insert({ colaborador_id: colaboradorId, ...form });
    if (error) toast.error("Erro", { description: error.message });
    else {
      toast.success("Férias registradas");
      onOpenChange(false);
      onSaved();
      setForm({ data_inicio: "", data_fim: "", observacao: "" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Período de férias</DialogTitle></DialogHeader>
        <form onSubmit={salvar} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Início</Label><Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Fim</Label><Input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Textarea rows={2} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          </div>
          <DialogFooter><Button type="submit">Salvar</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
