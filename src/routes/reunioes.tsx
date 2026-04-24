import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Loader2,
  Upload,
  Calendar as CalIcon,
  Users,
  FileText,
  ListChecks,
  CheckCircle2,
  XCircle,
  CalendarDays,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  ExternalLink,
  Clock,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { format, isThisMonth, isFuture } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { KpiTile } from "@/components/KpiTile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AssigneeCombobox, AssigneeBadges } from "@/components/AssigneeCombobox";

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

type FormState = {
  titulo: string;
  tipo: (typeof TIPOS)[number];
  status: (typeof STATUS)[number];
  data_reuniao: string;
  duracao_min: number;
  pauta: string;
  resumo: string;
  proximos_passos: string;
  transcricao: string;
  link_calendario: string;
  participantes_str: string;
  responsaveis_ids: string[];
  equipe_toda: boolean;
};

const emptyForm = (): FormState => ({
  titulo: "",
  tipo: "interna",
  status: "agendada",
  data_reuniao: new Date().toISOString().slice(0, 16),
  duracao_min: 60,
  pauta: "",
  resumo: "",
  proximos_passos: "",
  transcricao: "",
  link_calendario: "",
  participantes_str: "",
  responsaveis_ids: [],
  equipe_toda: false,
});

function statusTone(s: string): "info" | "success" | "destructive" | "primary" {
  if (s === "agendada") return "info";
  if (s === "realizada") return "success";
  if (s === "cancelada") return "destructive";
  return "primary";
}

function statusBadgeClass(s: string) {
  if (s === "agendada") return "bg-info/15 text-info border-info/30";
  if (s === "realizada") return "bg-success/15 text-success border-success/30";
  if (s === "cancelada") return "bg-destructive/15 text-destructive border-destructive/30";
  return "";
}

function Reunioes() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Dialogs / drawers
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [openDetail, setOpenDetail] = React.useState<any>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<any>(null);

  // Form
  const [form, setForm] = React.useState<FormState>(emptyForm());
  const [audio, setAudio] = React.useState<File | null>(null);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  // Filtros
  const [search, setSearch] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState<string>("todos");
  const [filterTipo, setFilterTipo] = React.useState<string>("todos");

  const { data: colabs = [] } = useQuery({
    queryKey: ["reu-colabs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaborador")
        .select("id, nome, cargo")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
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

  // Audio signed URL para detalhe
  React.useEffect(() => {
    let active = true;
    setAudioUrl(null);
    if (openDetail?.audio_path) {
      supabase.storage
        .from("reuniao-audios")
        .createSignedUrl(openDetail.audio_path, 3600)
        .then(({ data }) => {
          if (active) setAudioUrl(data?.signedUrl ?? null);
        });
    }
    return () => {
      active = false;
    };
  }, [openDetail]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setAudio(null);
    setFormOpen(true);
  };

  const openEdit = (r: any) => {
    setEditingId(r.id);
    setForm({
      titulo: r.titulo ?? "",
      tipo: r.tipo ?? "interna",
      status: r.status ?? "agendada",
      data_reuniao: r.data_reuniao
        ? new Date(r.data_reuniao).toISOString().slice(0, 16)
        : new Date().toISOString().slice(0, 16),
      duracao_min: r.duracao_min ?? 60,
      pauta: r.pauta ?? "",
      resumo: r.resumo ?? "",
      proximos_passos: r.proximos_passos ?? "",
      transcricao: r.transcricao ?? "",
      link_calendario: r.link_calendario ?? "",
      participantes_str: (r.participantes ?? []).join(", "),
      responsaveis_ids: r.responsaveis_ids ?? [],
      equipe_toda: !!r.equipe_toda,
    });
    setAudio(null);
    setFormOpen(true);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim() || !user) {
      toast.error(user ? "Informe título" : "Faça login para criar reuniões");
      return;
    }
    setSaving(true);

    let audio_path: string | null = null;
    let audio_size: number | null = null;
    let audio_mime: string | null = null;

    if (audio) {
      const path = `${user.id}/${Date.now()}-${audio.name}`;
      const { error: upErr } = await supabase.storage.from("reuniao-audios").upload(path, audio);
      if (upErr) {
        setSaving(false);
        toast.error("Erro no upload do áudio", { description: upErr.message });
        return;
      }
      audio_path = path;
      audio_size = audio.size;
      audio_mime = audio.type;
    }

    const { participantes_str, ...rest } = form;
    const participantes = participantes_str
      ? participantes_str.split(",").map((s) => s.trim()).filter(Boolean)
      : null;

    if (editingId) {
      const baseUpdate = {
        ...rest,
        data_reuniao: new Date(form.data_reuniao).toISOString(),
        duracao_min: Number(form.duracao_min) || null,
        responsaveis_ids: form.responsaveis_ids,
        equipe_toda: form.equipe_toda,
        participantes,
      };
      const updatePayload = audio_path
        ? { ...baseUpdate, audio_path, audio_size, audio_mime }
        : baseUpdate;
      const { error } = await supabase.from("reuniao").update(updatePayload).eq("id", editingId);
      setSaving(false);
      if (error) {
        toast.error("Erro ao atualizar", { description: error.message });
        return;
      }
      toast.success("Reunião atualizada");
    } else {
      const { error } = await supabase.from("reuniao").insert({
        ...rest,
        data_reuniao: new Date(form.data_reuniao).toISOString(),
        duracao_min: Number(form.duracao_min) || null,
        responsaveis_ids: form.responsaveis_ids,
        equipe_toda: form.equipe_toda,
        participantes,
        audio_path,
        audio_size,
        audio_mime,
        criado_por: user.id,
      });
      setSaving(false);
      if (error) {
        toast.error("Erro ao salvar", { description: error.message });
        return;
      }
      toast.success("Reunião registrada");
    }

    setFormOpen(false);
    setAudio(null);
    setEditingId(null);
    setForm(emptyForm());
    qc.invalidateQueries({ queryKey: ["reunioes"] });
    qc.invalidateQueries({ queryKey: ["dash-reunioes"] });
    qc.invalidateQueries({ queryKey: ["dash-atribuicoes"] });
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const r = confirmDelete;
    if (r.audio_path) {
      await supabase.storage.from("reuniao-audios").remove([r.audio_path]);
    }
    const { error } = await supabase.from("reuniao").delete().eq("id", r.id);
    if (error) {
      toast.error("Erro ao excluir", { description: error.message });
      return;
    }
    toast.success("Reunião excluída");
    setConfirmDelete(null);
    if (openDetail?.id === r.id) setOpenDetail(null);
    qc.invalidateQueries({ queryKey: ["reunioes"] });
    qc.invalidateQueries({ queryKey: ["dash-reunioes"] });
  };

  const updateAssignees = async (
    id: string,
    next: { selectedIds: string[]; equipeToda: boolean },
  ) => {
    const { error } = await supabase
      .from("reuniao")
      .update({ responsaveis_ids: next.selectedIds, equipe_toda: next.equipeToda })
      .eq("id", id);
    if (error) toast.error("Erro", { description: error.message });
    else {
      qc.invalidateQueries({ queryKey: ["reunioes"] });
      qc.invalidateQueries({ queryKey: ["dash-atribuicoes"] });
    }
  };

  // Filtragem em memória
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((r: any) => {
      if (filterStatus !== "todos" && r.status !== filterStatus) return false;
      if (filterTipo !== "todos" && r.tipo !== filterTipo) return false;
      if (!q) return true;
      const hay = [r.titulo, r.resumo, r.pauta, r.proximos_passos, (r.participantes ?? []).join(" ")]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [data, search, filterStatus, filterTipo]);

  const total = data.length;
  const agendadas = data.filter((r: any) => r.status === "agendada").length;
  const realizadas = data.filter((r: any) => r.status === "realizada").length;
  const canceladas = data.filter((r: any) => r.status === "cancelada").length;
  const noMes = data.filter((r: any) => isThisMonth(new Date(r.data_reuniao))).length;
  const proximas = data.filter(
    (r: any) => r.status === "agendada" && isFuture(new Date(r.data_reuniao)),
  ).length;

  return (
    <div>
      <PageHeader
        title="Reuniões"
        description="Pautas, resumos, transcrições, participantes, responsável e prazos."
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Nova reunião
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <KpiTile icon={CalIcon} label="Total" value={total} tone="primary" loading={isLoading} />
        <KpiTile
          icon={CalendarDays}
          label="Agendadas"
          value={agendadas}
          hint={`${proximas} futuras`}
          tone="info"
          loading={isLoading}
        />
        <KpiTile icon={CheckCircle2} label="Realizadas" value={realizadas} tone="success" loading={isLoading} />
        <KpiTile icon={XCircle} label="Canceladas" value={canceladas} tone="destructive" loading={isLoading} />
        <KpiTile icon={CalIcon} label="Neste mês" value={noMes} tone="warning" loading={isLoading} />
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, resumo, pauta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            {STATUS.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos tipos</SelectItem>
            {TIPOS.map((t) => (
              <SelectItem key={t} value={t} className="capitalize">
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search || filterStatus !== "todos" || filterTipo !== "todos") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setFilterStatus("todos");
              setFilterTipo("todos");
            }}
          >
            Limpar
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} de {data.length}
        </span>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CalIcon}
          title={data.length === 0 ? "Nenhuma reunião registrada" : "Nenhuma reunião com esses filtros"}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r: any) => (
            <Card
              key={r.id}
              className="group cursor-pointer transition hover:border-primary/50 hover:shadow-md"
              onClick={() => setOpenDetail(r)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate text-sm">{r.titulo}</CardTitle>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <CalIcon className="h-3 w-3" />
                      {format(new Date(r.data_reuniao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      {r.duracao_min ? (
                        <>
                          <span className="mx-0.5">·</span>
                          <Clock className="h-3 w-3" />
                          {r.duracao_min} min
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="outline" className={`capitalize text-[10px] ${statusBadgeClass(r.status)}`}>
                        {r.status}
                      </Badge>
                      <Badge variant="outline" className="capitalize text-[10px]">
                        {r.tipo}
                      </Badge>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setOpenDetail(r)}>
                            <ExternalLink className="mr-2 h-4 w-4" /> Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(r)}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setConfirmDelete(r)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0 text-sm">
                {r.resumo && <p className="line-clamp-2 text-xs text-muted-foreground">{r.resumo}</p>}
                <div onClick={(e) => e.stopPropagation()}>
                  <AssigneeBadges
                    selectedIds={r.responsaveis_ids}
                    equipeToda={r.equipe_toda}
                    options={colabs}
                    max={2}
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {r.participantes && r.participantes.length > 0 && (
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <Users className="h-3 w-3" /> {r.participantes.length}
                    </Badge>
                  )}
                  {r.transcricao && (
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <FileText className="h-3 w-3" /> transcrição
                    </Badge>
                  )}
                  {r.proximos_passos && (
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <ListChecks className="h-3 w-3" /> próximos
                    </Badge>
                  )}
                  {r.audio_path && <Badge variant="secondary" className="text-[10px]">🎵 áudio</Badge>}
                </div>
                <div onClick={(e) => e.stopPropagation()} className="pt-1">
                  <AssigneeCombobox
                    options={colabs}
                    selectedIds={r.responsaveis_ids ?? []}
                    equipeToda={!!r.equipe_toda}
                    onChange={(n) => updateAssignees(r.id, n)}
                    placeholder="Atribuir..."
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form criar/editar */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar reunião" : "Nova reunião"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as typeof form.tipo })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Data e hora</Label>
                <Input
                  type="datetime-local"
                  value={form.data_reuniao}
                  onChange={(e) => setForm({ ...form, data_reuniao: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Duração (min)</Label>
                <Input
                  type="number"
                  value={form.duracao_min}
                  onChange={(e) => setForm({ ...form, duracao_min: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Atribuir a</Label>
                <AssigneeCombobox
                  options={colabs}
                  selectedIds={form.responsaveis_ids}
                  equipeToda={form.equipe_toda}
                  onChange={(n) =>
                    setForm({ ...form, responsaveis_ids: n.selectedIds, equipe_toda: n.equipeToda })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Link do calendário</Label>
                <Input
                  value={form.link_calendario}
                  onChange={(e) => setForm({ ...form, link_calendario: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Participantes (separados por vírgula)</Label>
              <Input
                value={form.participantes_str}
                onChange={(e) => setForm({ ...form, participantes_str: e.target.value })}
                placeholder="João, Maria, Pedro"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Pauta</Label>
              <Textarea rows={3} value={form.pauta} onChange={(e) => setForm({ ...form, pauta: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Resumo</Label>
              <Textarea rows={3} value={form.resumo} onChange={(e) => setForm({ ...form, resumo: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Transcrição</Label>
              <Textarea
                rows={4}
                value={form.transcricao}
                onChange={(e) => setForm({ ...form, transcricao: e.target.value })}
                placeholder="Cole aqui a transcrição automática do áudio"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Próximos passos</Label>
              <Textarea
                rows={3}
                value={form.proximos_passos}
                onChange={(e) => setForm({ ...form, proximos_passos: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Áudio {editingId ? "(opcional — substitui o atual)" : "(opcional)"}</Label>
              <Input
                type="file"
                accept="audio/*"
                onChange={(e) => setAudio(e.target.files?.[0] ?? null)}
              />
              {audio && (
                <p className="text-xs text-muted-foreground">
                  {audio.name} ({Math.round(audio.size / 1024)} KB)
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {audio ? (
                  <>
                    <Upload className="mr-2 h-4 w-4" /> Salvar e enviar
                  </>
                ) : editingId ? (
                  "Salvar alterações"
                ) : (
                  "Salvar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Drawer de visualização */}
      <Sheet open={!!openDetail} onOpenChange={(v) => !v && setOpenDetail(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          {openDetail && (
            <>
              <SheetHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="text-xl">{openDetail.titulo}</SheetTitle>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className={`capitalize ${statusBadgeClass(openDetail.status)}`}>
                        {openDetail.status}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {openDetail.tipo}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="outline" size="sm" onClick={() => openEdit(openDetail)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setConfirmDelete(openDetail)}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Excluir
                    </Button>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-5 text-sm">
                {/* Meta */}
                <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
                  <MetaItem
                    icon={CalIcon}
                    label="Data"
                    value={format(new Date(openDetail.data_reuniao), "EEEE, dd 'de' MMMM 'de' yyyy", {
                      locale: ptBR,
                    })}
                  />
                  <MetaItem
                    icon={Clock}
                    label="Horário"
                    value={`${format(new Date(openDetail.data_reuniao), "HH:mm")}${
                      openDetail.duracao_min ? ` · ${openDetail.duracao_min} min` : ""
                    }`}
                  />
                  {openDetail.link_calendario && (
                    <div className="sm:col-span-2">
                      <a
                        href={openDetail.link_calendario}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Abrir no calendário
                      </a>
                    </div>
                  )}
                </div>

                {/* Responsáveis */}
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">Responsáveis</p>
                  <AssigneeBadges
                    selectedIds={openDetail.responsaveis_ids}
                    equipeToda={openDetail.equipe_toda}
                    options={colabs}
                    max={20}
                  />
                </div>

                {/* Participantes */}
                {openDetail.participantes && openDetail.participantes.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">
                      Participantes ({openDetail.participantes.length})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {openDetail.participantes.map((p: string, i: number) => (
                        <Badge key={i} variant="outline">
                          {p}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Áudio */}
                {openDetail.audio_path && (
                  <div>
                    <p className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground">
                      <span>Áudio</span>
                      {audioUrl && (
                        <a
                          href={audioUrl}
                          download
                          className="inline-flex items-center gap-1 text-[10px] normal-case text-primary hover:underline"
                        >
                          <Download className="h-3 w-3" /> Baixar
                        </a>
                      )}
                    </p>
                    {audioUrl ? (
                      <audio controls src={audioUrl} className="w-full" />
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Carregando áudio...
                      </div>
                    )}
                  </div>
                )}

                {openDetail.pauta && <Section title="Pauta" content={openDetail.pauta} />}
                {openDetail.resumo && <Section title="Resumo" content={openDetail.resumo} />}
                {openDetail.transcricao && (
                  <Section title="Transcrição" content={openDetail.transcricao} mono />
                )}
                {openDetail.proximos_passos && (
                  <Section title="Próximos passos" content={openDetail.proximos_passos} />
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Confirmar exclusão */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir reunião?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A reunião <strong>{confirmDelete?.titulo}</strong> e seus dados
              (incluindo o áudio, se houver) serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MetaItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}

function Section({ title, content, mono }: { title: string; content: string; mono?: boolean }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">{title}</p>
      <div
        className={`whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm leading-relaxed ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {content}
      </div>
    </div>
  );
}

// statusTone reservada para uso futuro com KpiTile/badges tonais.
void statusTone;
