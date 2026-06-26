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
  Sparkles,
  CheckCheck,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { format, isThisMonth, isFuture } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppLayout } from "@/components/AppLayout";
import { PageHero } from "@/components/shared/PageHero";
import { EmptyState } from "@/components/EmptyState";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
import { UploadAudioReuniao } from "@/components/reunioes/UploadAudioReuniao";
import { TranscricaoFormatada } from "@/components/reunioes/TranscricaoFormatada";
import { DialogHero } from "@/components/shared/DialogHero";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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

const REUNIAO_TONE: Record<string, { accent: string; statusBadge: string; dot: string }> = {
  agendada: {
    accent: "from-sky-500/80 via-sky-500/40 to-transparent",
    statusBadge: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    dot: "bg-sky-500",
  },
  realizada: {
    accent: "from-emerald-500/80 via-emerald-500/40 to-transparent",
    statusBadge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  cancelada: {
    accent: "from-rose-500/80 via-rose-500/40 to-transparent",
    statusBadge: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
  },
};


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
  // Áudio já enviado para o storage (caminho final). null = sem áudio.
  const [audioPath, setAudioPath] = React.useState<string | null>(null);
  const [audioSize, setAudioSize] = React.useState<number | null>(null);
  const [audioMime, setAudioMime] = React.useState<string | null>(null);
  const [audioUploadedThisSession, setAudioUploadedThisSession] = React.useState(false);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [generatingReport, setGeneratingReport] = React.useState(false);

  const handleGerarRelatorio = async (reuniao: any) => {
    if (!reuniao?.id) return;
    setGeneratingReport(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gerar-relatorio-reuniao`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ reuniao_id: reuniao.id }),
      });
      if (!res.ok) {
        let msg = `Erro ${res.status}`;
        try {
          const j = await res.json();
          msg = j.error || msg;
        } catch {}
        throw new Error(msg);
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename="?([^";]+)"?/);
      const filename = match?.[1] || `Relatorio_${reuniao.titulo || "reuniao"}.docx`;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
      toast.success("Relatório gerado!", { description: filename });
    } catch (e: any) {
      toast.error("Falha ao gerar relatório", { description: e?.message });
    } finally {
      setGeneratingReport(false);
    }
  };

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

  // Audio signed URL para detalhe (Sheet)
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

  // Realtime: atualiza lista quando edge function termina o processamento
  React.useEffect(() => {
    const channel = supabase
      .channel("reuniao-rt")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "reuniao" },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["reunioes"] });
          // Mantém o detail aberto sincronizado
          setOpenDetail((cur: any) =>
            cur && cur.id === (payload.new as any).id ? { ...cur, ...payload.new } : cur,
          );
          // Mantém form aberto sincronizado se for a mesma reunião
          if (
            editingId &&
            (payload.new as any).id === editingId &&
            (payload.new as any).transcricao_status === "concluido"
          ) {
            const n = payload.new as any;
            setForm((f) => ({
              ...f,
              transcricao: n.transcricao ?? f.transcricao,
              resumo: n.resumo ?? f.resumo,
              pauta: n.pauta ?? f.pauta,
              proximos_passos: n.proximos_passos ?? f.proximos_passos,
            }));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, editingId]);

  const resetAudioState = () => {
    setAudioPath(null);
    setAudioSize(null);
    setAudioMime(null);
    setAudioUploadedThisSession(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    resetAudioState();
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
    setAudioPath(r.audio_path ?? null);
    setAudioSize(r.audio_size ?? null);
    setAudioMime(r.audio_mime ?? null);
    setAudioUploadedThisSession(false);
    setFormOpen(true);
  };

  // Encontra a reunião atual em edição (para status de transcrição em tempo real)
  const editingRow = React.useMemo(
    () => (editingId ? data.find((r: any) => r.id === editingId) : null),
    [editingId, data],
  );

  // Cria rascunho da reunião (usado pelo upload em segundo plano antes de enfileirar).
  const handleAutoSaveDraft = async (): Promise<string | null> => {
    if (!user) {
      toast.error("Faça login para anexar áudio");
      return null;
    }
    if (editingId) return editingId;
    if (!form.titulo.trim()) {
      toast.error("Informe um título antes de anexar o áudio");
      return null;
    }
    const { participantes_str, ...rest } = form;
    const participantes = participantes_str
      ? participantes_str.split(",").map((s) => s.trim()).filter(Boolean)
      : null;
    const { data: inserted, error } = await supabase
      .from("reuniao")
      .insert({
        ...rest,
        data_reuniao: new Date(form.data_reuniao).toISOString(),
        duracao_min: Number(form.duracao_min) || null,
        responsaveis_ids: form.responsaveis_ids,
        equipe_toda: form.equipe_toda,
        participantes,
        criado_por: user.id,
      })
      .select("id")
      .single();
    if (error || !inserted) {
      toast.error("Erro ao salvar rascunho", { description: error?.message });
      return null;
    }
    setEditingId(inserted.id);
    qc.invalidateQueries({ queryKey: ["reunioes"] });
    return inserted.id;
  };

  const handleEarlyAnalysis = async () => {
    if (!user) {
      toast.error("Faça login para iniciar a análise");
      return;
    }
    if (!audioPath) {
      toast.error("Anexe um áudio antes de iniciar a análise");
      return;
    }
    if (!form.titulo.trim()) {
      toast.error("Informe um título antes de iniciar a análise");
      return;
    }
    setAnalyzing(true);
    try {
      // Se ainda é criação, cria rascunho para podermos atrelar a transcrição
      let rid = editingId;
      if (!rid) {
        const { participantes_str, ...rest } = form;
        const participantes = participantes_str
          ? participantes_str.split(",").map((s) => s.trim()).filter(Boolean)
          : null;
        const { data: inserted, error } = await supabase
          .from("reuniao")
          .insert({
            ...rest,
            data_reuniao: new Date(form.data_reuniao).toISOString(),
            duracao_min: Number(form.duracao_min) || null,
            responsaveis_ids: form.responsaveis_ids,
            equipe_toda: form.equipe_toda,
            participantes,
            audio_path: audioPath,
            audio_size: audioSize,
            audio_mime: audioMime,
            criado_por: user.id,
          })
          .select("id")
          .single();
        if (error || !inserted) {
          toast.error("Erro ao criar rascunho", { description: error?.message });
          return;
        }
        rid = inserted.id;
        setEditingId(rid);
        setAudioUploadedThisSession(false);
      }
      const { error: fnError } = await supabase.functions.invoke("transcrever-reuniao", {
        body: { reuniao_id: rid, audio_path: audioPath },
      });
      if (fnError) {
        toast.error("Falha ao iniciar análise", { description: fnError.message });
      } else {
        toast.info("🎧 Transcrevendo e analisando com IA...", {
          description: "Os campos serão preenchidos automaticamente. Continue editando e salve depois.",
        });
      }
      qc.invalidateQueries({ queryKey: ["reunioes"] });
    } finally {
      setAnalyzing(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim() || !user) {
      toast.error(user ? "Informe título" : "Faça login para criar reuniões");
      return;
    }
    setSaving(true);

    const { participantes_str, ...rest } = form;
    const participantes = participantes_str
      ? participantes_str.split(",").map((s) => s.trim()).filter(Boolean)
      : null;

    let savedId = editingId;

    if (editingId) {
      const updatePayload: any = {
        ...rest,
        data_reuniao: new Date(form.data_reuniao).toISOString(),
        duracao_min: Number(form.duracao_min) || null,
        responsaveis_ids: form.responsaveis_ids,
        equipe_toda: form.equipe_toda,
        participantes,
        audio_path: audioPath,
        audio_size: audioSize,
        audio_mime: audioMime,
      };
      const { error } = await supabase.from("reuniao").update(updatePayload).eq("id", editingId);
      if (error) {
        setSaving(false);
        toast.error("Erro ao atualizar", { description: error.message });
        return;
      }
      toast.success("Reunião atualizada");
    } else {
      const { data: inserted, error } = await supabase
        .from("reuniao")
        .insert({
          ...rest,
          data_reuniao: new Date(form.data_reuniao).toISOString(),
          duracao_min: Number(form.duracao_min) || null,
          responsaveis_ids: form.responsaveis_ids,
          equipe_toda: form.equipe_toda,
          participantes,
          audio_path: audioPath,
          audio_size: audioSize,
          audio_mime: audioMime,
          criado_por: user.id,
        })
        .select("id")
        .single();
      if (error || !inserted) {
        setSaving(false);
        toast.error("Erro ao salvar", { description: error?.message });
        return;
      }
      savedId = inserted.id;
      toast.success("Reunião registrada");
    }

    // Se o áudio foi anexado nesta sessão e ainda não foi processado, dispara IA
    if (savedId && audioPath && audioUploadedThisSession) {
      supabase.functions
        .invoke("transcrever-reuniao", {
          body: { reuniao_id: savedId, audio_path: audioPath },
        })
        .then(({ error }) => {
          if (error) toast.error("Falha ao iniciar análise IA", { description: error.message });
          else
            toast.info("🎧 Transcrevendo e analisando com IA...", {
              description: "A reunião será atualizada automaticamente.",
            });
        });
    }

    setSaving(false);
    setFormOpen(false);
    resetAudioState();
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

  const [regenerating, setRegenerating] = React.useState(false);
  const handleRegerar = async (reuniaoId: string) => {
    setRegenerating(true);
    const { error } = await supabase.functions.invoke("analisar-transcricao", {
      body: { reuniao_id: reuniaoId },
    });
    setRegenerating(false);
    if (error) toast.error("Falha ao regerar análise", { description: error.message });
    else toast.info("✨ Regerando análise com IA...", { description: "A reunião será atualizada em instantes." });
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
    <div className="space-y-5">
      <PageHero
        eyebrow="Conversas e decisões"
        title="Reuniões"
        description="Pautas, resumos, transcrições, participantes e próximos passos — com IA."
        icon={CalIcon}
        tone="violet"
        actions={
          <Button
            onClick={openCreate}
            className="gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-md shadow-violet-500/20 hover:from-violet-500/90 hover:to-fuchsia-500/90"
          >
            <Plus className="h-4 w-4" /> Nova reunião
          </Button>
        }
        statsGridClassName="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        stats={[
          { icon: CalIcon, label: "Total", value: total, tone: "violet", hint: "Registradas" },
          {
            icon: CalendarDays,
            label: "Agendadas",
            value: agendadas,
            tone: "sky",
            hint: `${proximas} futuras`,
          },
          { icon: CheckCircle2, label: "Realizadas", value: realizadas, tone: "emerald", hint: "Concluídas" },
          {
            icon: XCircle,
            label: "Canceladas",
            value: canceladas,
            tone: canceladas > 0 ? "rose" : "emerald",
            hint: canceladas > 0 ? "Revisar motivos" : "Sem cancelamentos",
          },
          { icon: Sparkles, label: "Neste mês", value: noMes, tone: "amber", hint: "Ritmo do time" },
        ]}
      />

      {/* Toolbar */}
      <div className="rounded-xl border bg-card/60 p-3 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="flex flex-wrap items-center gap-2">
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
          {filtered.map((r: any) => {
            const tone = REUNIAO_TONE[r.status] ?? REUNIAO_TONE.agendada;
            const isFuturo = r.status === "agendada" && isFuture(new Date(r.data_reuniao));
            const hasIA = !!(r.transcricao && r.resumo);
            return (
              <div
                key={r.id}
                className={cn(
                  "group relative cursor-pointer overflow-hidden rounded-xl border bg-card shadow-sm transition-all",
                  "hover:-translate-y-0.5 hover:shadow-lg hover:border-foreground/15",
                )}
                onClick={() => setOpenDetail(r)}
              >
                {/* top accent strip */}
                <span
                  aria-hidden
                  className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", tone.accent)}
                />
                {/* hover wash */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/0 to-fuchsia-500/0 opacity-0 transition-opacity group-hover:opacity-100 group-hover:from-violet-500/[0.04] group-hover:to-fuchsia-500/[0.04]"
                />

                <div className="relative p-4 pt-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold leading-snug text-foreground">
                        {r.titulo}
                      </h3>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <CalIcon className="h-3 w-3" />
                          {format(new Date(r.data_reuniao), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                        </span>
                        {r.duracao_min ? (
                          <>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {r.duracao_min}min
                            </span>
                          </>
                        ) : null}
                        {isFuturo && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-1.5 py-0.5 font-medium text-sky-700 dark:text-sky-300">
                            futura
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                            tone.statusBadge,
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
                          {r.status}
                        </span>
                        <Badge variant="outline" className="capitalize text-[10px] text-muted-foreground">
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

                  {/* IA Resumo destacado */}
                  {r.resumo && (
                    <div
                      className={cn(
                        "rounded-lg border p-2.5 text-xs leading-relaxed",
                        hasIA
                          ? "border-violet-500/20 bg-gradient-to-br from-violet-500/[0.06] to-fuchsia-500/[0.04] text-foreground/80"
                          : "border-border/50 bg-muted/40 text-muted-foreground",
                      )}
                    >
                      {hasIA && (
                        <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                          <Sparkles className="h-3 w-3" />
                          Resumo IA
                        </div>
                      )}
                      <p className="line-clamp-3">{r.resumo}</p>
                    </div>
                  )}

                  <div onClick={(e) => e.stopPropagation()}>
                    <AssigneeBadges
                      selectedIds={r.responsaveis_ids}
                      equipeToda={r.equipe_toda}
                      options={colabs}
                      max={3}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    {r.transcricao_status === "processando" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                        <Loader2 className="h-3 w-3 animate-spin" /> processando
                      </span>
                    )}
                    {r.transcricao_status === "erro" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive">
                        ⚠ erro IA
                      </span>
                    )}
                    {r.participantes && r.participantes.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        <Users className="h-3 w-3" /> {r.participantes.length}
                      </span>
                    )}
                    {r.transcricao && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        <FileText className="h-3 w-3" /> transcrição
                      </span>
                    )}
                    {r.proximos_passos && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                        <CheckCheck className="h-3 w-3" /> próximos passos
                      </span>
                    )}
                    {r.audio_path && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        🎵 áudio
                      </span>
                    )}
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
                </div>
              </div>
            );
          })}
        </div>
      )}


      {/* Form criar/editar */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="w-[95vw] sm:max-w-3xl lg:max-w-4xl max-h-[92vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          <DialogHeader className="sr-only">
            <DialogTitle>{editingId ? "Editar reunião" : "Nova reunião"}</DialogTitle>
          </DialogHeader>
          <DialogHero
            icon={Video}
            tone="violet"
            eyebrow="Reuniões"
            title={editingId ? "Editar reunião" : "Nova reunião"}
            description={
              editingId
                ? "Atualize informações, anexe áudio e re-execute a transcrição se necessário."
                : "Agende uma reunião e, opcionalmente, anexe áudio para transcrição automática."
            }
          />
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

            {/* Upload de áudio + análise IA — disponível em criação e edição */}
            {user && (
              <UploadAudioReuniao
                reuniaoId={editingId}
                userId={user.id}
                titulo={form.titulo}
                audioPath={audioPath}
                status={(editingRow?.transcricao_status as any) ?? "pendente"}
                errorMessage={editingRow?.transcricao_erro ?? null}
                onUploaded={async (info) => {
                  setAudioPath(info.audio_path || null);
                  setAudioSize(info.audio_size || null);
                  setAudioMime(info.audio_mime || null);
                  // Já foi disparado pelo manager — não reprocessar no submit
                  setAudioUploadedThisSession(false);
                }}
                onAutoSaveDraft={handleAutoSaveDraft}
              />
            )}

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                Pauta
                {form.pauta && audioPath && (
                  <Badge variant="outline" className="border-primary/30 bg-primary/5 text-[10px] text-primary">
                    <Sparkles className="mr-1 h-2.5 w-2.5" /> IA
                  </Badge>
                )}
              </Label>
              <Textarea rows={6} className="min-h-[140px] resize-y leading-relaxed" value={form.pauta} onChange={(e) => setForm({ ...form, pauta: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                Resumo
                {form.resumo && audioPath && (
                  <Badge variant="outline" className="border-primary/30 bg-primary/5 text-[10px] text-primary">
                    <Sparkles className="mr-1 h-2.5 w-2.5" /> IA
                  </Badge>
                )}
              </Label>
              <Textarea rows={6} className="min-h-[140px] resize-y leading-relaxed" value={form.resumo} onChange={(e) => setForm({ ...form, resumo: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                Próximos passos
                {form.proximos_passos && audioPath && (
                  <Badge variant="outline" className="border-primary/30 bg-primary/5 text-[10px] text-primary">
                    <Sparkles className="mr-1 h-2.5 w-2.5" /> IA
                  </Badge>
                )}
              </Label>
              <Textarea
                rows={5}
                className="min-h-[120px] resize-y leading-relaxed"
                value={form.proximos_passos}
                onChange={(e) => setForm({ ...form, proximos_passos: e.target.value })}
              />
            </div>
            {form.transcricao && (
              <Accordion type="single" collapsible>
                <AccordionItem value="transcricao" className="rounded-md border px-3">
                  <AccordionTrigger className="text-sm">
                    📝 Ver transcrição completa
                  </AccordionTrigger>
                  <AccordionContent>
                    <Textarea
                      rows={8}
                      value={form.transcricao}
                      onChange={(e) => setForm({ ...form, transcricao: e.target.value })}
                      className="font-mono text-xs"
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="secondary"
                disabled={
                  analyzing ||
                  !audioPath ||
                  (editingRow?.transcricao_status as any) === "processando"
                }
                onClick={handleEarlyAnalysis}
              >
                {analyzing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Iniciar análise por IA
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingId ? "Salvar alterações" : "Salvar"}
                </Button>
              </div>
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
                      {openDetail.transcricao && openDetail.resumo && (
                        <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/5 text-primary">
                          <Sparkles className="h-3 w-3" /> Analisada por IA
                        </Badge>
                      )}
                      {openDetail.transcricao_status === "processando" && (
                        <Badge variant="outline" className="gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" /> processando
                        </Badge>
                      )}
                      {openDetail.transcricao_status === "erro" && (
                        <Badge variant="destructive">⚠️ erro IA</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1">
                    <Button
                      variant="default"
                      size="sm"
                      disabled={generatingReport}
                      onClick={() => handleGerarRelatorio(openDetail)}
                      title="Gera um relatório detalhado em Word usando IA"
                    >
                      {generatingReport ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FileText className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Gerar relatório (Word)
                    </Button>
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
                {openDetail.proximos_passos && (
                  <Section title="Próximos passos" content={openDetail.proximos_passos} />
                )}

                {openDetail.decisoes && openDetail.decisoes.length > 0 && (
                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
                      <CheckCheck className="h-3.5 w-3.5" /> Decisões tomadas
                    </p>
                    <ul className="space-y-1.5 rounded-md border bg-muted/30 p-3">
                      {openDetail.decisoes.map((d: string, i: number) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <span className="mt-0.5 text-success">✓</span>
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {openDetail.participantes_detectados &&
                  openDetail.participantes_detectados.length > 0 && (
                    <div>
                      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
                        <Sparkles className="h-3.5 w-3.5" /> Participantes detectados pela IA
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {openDetail.participantes_detectados.map((p: string, i: number) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="border-primary/30 bg-primary/5 text-primary"
                          >
                            {p}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                {openDetail.transcricao_erro && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    <p className="font-semibold">⚠️ Erro no processamento IA</p>
                    <p className="mt-1 text-xs">{openDetail.transcricao_erro}</p>
                  </div>
                )}

                {openDetail.transcricao && (
                  <Accordion type="single" collapsible>
                    <AccordionItem value="transcricao" className="rounded-md border px-3">
                      <AccordionTrigger className="text-sm">
                        <span className="flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5" /> Ver transcrição completa
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <TranscricaoFormatada transcricao={openDetail.transcricao} />
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}

                {openDetail.transcricao && (
                  <div className="flex justify-end pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRegerar(openDetail.id)}
                      disabled={regenerating || openDetail.transcricao_status === "processando"}
                    >
                      {regenerating || openDetail.transcricao_status === "processando" ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Regerar análise com IA
                    </Button>
                  </div>
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
