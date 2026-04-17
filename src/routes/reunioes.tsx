import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Upload, Calendar as CalIcon } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export const Route = createFileRoute("/reunioes")({
  component: ReunioesRoute,
});

function ReunioesRoute() {
  return (
    <AppLayout>
      <Reunioes />
    </AppLayout>
  );
}

const TIPOS = ["interna", "cliente", "fornecedor", "alinhamento", "outro"] as const;
const STATUS = ["agendada", "realizada", "cancelada"] as const;

function Reunioes() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [audio, setAudio] = React.useState<File | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [form, setForm] = React.useState({
    titulo: "",
    tipo: "interna" as (typeof TIPOS)[number],
    status: "agendada" as (typeof STATUS)[number],
    data_reuniao: new Date().toISOString().slice(0, 16),
    duracao_min: 60,
    pauta: "",
    resumo: "",
    proximos_passos: "",
    link_calendario: "",
  });

  const { data = [], isLoading } = useQuery({
    queryKey: ["reunioes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reuniao")
        .select("*")
        .order("data_reuniao", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim() || !user) return;
    setSaving(true);

    let audio_path: string | null = null;
    let audio_size: number | null = null;
    let audio_mime: string | null = null;

    if (audio) {
      const path = `${user.id}/${Date.now()}-${audio.name}`;
      const { error: upErr } = await supabase.storage
        .from("reuniao-audios")
        .upload(path, audio);
      if (upErr) {
        setSaving(false);
        toast.error("Erro no upload do áudio", { description: upErr.message });
        return;
      }
      audio_path = path;
      audio_size = audio.size;
      audio_mime = audio.type;
    }

    const { error } = await supabase.from("reuniao").insert({
      ...form,
      data_reuniao: new Date(form.data_reuniao).toISOString(),
      duracao_min: Number(form.duracao_min) || null,
      audio_path,
      audio_size,
      audio_mime,
      criado_por: user.id,
      responsavel_id: user.id,
    });
    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }

    toast.success("Reunião registrada");
    setOpen(false);
    setAudio(null);
    setForm({ ...form, titulo: "", pauta: "", resumo: "", proximos_passos: "", link_calendario: "" });
    qc.invalidateQueries({ queryKey: ["reunioes"] });
    qc.invalidateQueries({ queryKey: ["dash-reunioes"] });
  };

  return (
    <div>
      <PageHeader
        title="Reuniões"
        description="Pautas, resumos, próximos passos e áudios para transcrição posterior."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Nova reunião</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Nova reunião</DialogTitle></DialogHeader>
              <form onSubmit={onSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Título</Label>
                  <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Tipo</Label>
                    <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as typeof form.tipo })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUS.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Data e hora</Label>
                    <Input type="datetime-local" value={form.data_reuniao} onChange={(e) => setForm({ ...form, data_reuniao: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Duração (min)</Label>
                    <Input type="number" value={form.duracao_min} onChange={(e) => setForm({ ...form, duracao_min: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Link do calendário</Label>
                  <Input value={form.link_calendario} onChange={(e) => setForm({ ...form, link_calendario: e.target.value })} placeholder="https://..." />
                </div>
                <div className="space-y-1.5">
                  <Label>Pauta</Label>
                  <Textarea rows={3} value={form.pauta} onChange={(e) => setForm({ ...form, pauta: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Resumo</Label>
                  <Textarea rows={4} value={form.resumo} onChange={(e) => setForm({ ...form, resumo: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Próximos passos</Label>
                  <Textarea rows={3} value={form.proximos_passos} onChange={(e) => setForm({ ...form, proximos_passos: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Áudio (opcional)</Label>
                  <Input type="file" accept="audio/*" onChange={(e) => setAudio(e.target.files?.[0] ?? null)} />
                  {audio && <p className="text-xs text-muted-foreground">{audio.name} ({Math.round(audio.size / 1024)} KB)</p>}
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {audio ? <><Upload className="mr-2 h-4 w-4" /> Salvar e enviar</> : "Salvar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : data.length === 0 ? (
        <EmptyState icon={CalIcon} title="Nenhuma reunião registrada" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{r.titulo}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {format(new Date(r.data_reuniao), "dd/MM/yyyy 'às' HH:mm")}
                      {r.duracao_min ? ` · ${r.duracao_min} min` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Badge variant="outline" className="capitalize text-[10px]">{r.tipo}</Badge>
                    <Badge variant="outline" className="capitalize text-[10px]">{r.status}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0 text-sm">
                {r.resumo && <p className="line-clamp-3 text-muted-foreground">{r.resumo}</p>}
                {r.audio_path && (
                  <Badge variant="secondary" className="text-[10px]">
                    🎵 áudio anexado
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
