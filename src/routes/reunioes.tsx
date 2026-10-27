import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Calendar as CalIcon,
  CheckCircle2,
  XCircle,
  CalendarDays,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { isThisMonth, isFuture } from "date-fns";
import { AppLayout } from "@/components/AppLayout";
import { PageHero } from "@/components/shared/PageHero";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useUploadStore } from "@/lib/reuniao-upload-manager";
import { EsqueletoCartoes } from "@/components/shared/Esqueletos";
import type { ReuniaoRow } from "@/lib/db-types";
import { ReuniaoCard } from "@/components/reunioes/ReuniaoCard";
import { ReuniaoDetalhe } from "@/components/reunioes/ReuniaoDetalhe";
import { ReuniaoFormDialog } from "@/components/reunioes/ReuniaoFormDialog";
import { useFormularioReuniao } from "@/components/reunioes/useFormularioReuniao";
import { STATUS, TIPOS, type ReuniaoLista } from "@/components/reunioes/reunioes-lib";
import { reunioesConsulta } from "@/lib/consultas-telas";

export const Route = createFileRoute("/reunioes")({
  // Pré-carrega a lista ao passar o mouse no menu (só na pré-carga: na entrada direta a
  // sessão ainda pode não estar pronta, e a lista viria vazia por causa das regras de acesso).
  loader: ({ context, preload }) => {
    if (preload) void context.queryClient.prefetchQuery(reunioesConsulta());
  },
  component: ReunioesRoute,
});

function ReunioesRoute() {
  return (
    <AppLayout>
      <Reunioes />
    </AppLayout>
  );
}

function Reunioes() {
  const qc = useQueryClient();

  // Dialogs / drawers
  const [openDetail, setOpenDetail] = React.useState<ReuniaoLista | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<ReuniaoLista | null>(null);

  // Background upload jobs (compressão/upload em segundo plano) → anima cards
  const uploadJobs = useUploadStore((s) => s.jobs);

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

  const { data = [], isLoading } = useQuery(reunioesConsulta());

  const formulario = useFormularioReuniao(data);
  const { editingId, setForm, openCreate, openEdit } = formulario;

  // Realtime: atualiza lista quando edge function termina o processamento
  React.useEffect(() => {
    const channel = supabase
      .channel("reuniao-rt")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "reuniao" },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["reunioes"] });
          const nova = payload.new as Partial<ReuniaoRow>;
          if (nova.id) qc.invalidateQueries({ queryKey: ["reuniao-transcricao", nova.id] });
          // Mantém o detail aberto sincronizado
          const { transcricao, ...semTranscricao } = nova;
          setOpenDetail((cur) =>
            cur && cur.id === nova.id
              ? {
                  ...cur,
                  ...semTranscricao,
                  ...(transcricao !== undefined && { temTranscricao: !!transcricao }),
                }
              : cur,
          );
          // Mantém form aberto sincronizado se for a mesma reunião
          if (editingId && nova.id === editingId && nova.transcricao_status === "concluido") {
            const n = nova;
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
  }, [qc, editingId, setForm]);

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

  // Retomada automática: reuniões pausadas há mais de 1 minuto voltam a
  // processar sozinhas assim que alguém abre a tela (rede de segurança para
  // quando o encadeamento automático no servidor é interrompido).
  const autoResumidas = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    const alvos = data.filter(
      (r) =>
        r.transcricao_status === "pausado" &&
        r.audio_path &&
        !autoResumidas.current.has(r.id) &&
        Date.now() - new Date(r.updated_at).getTime() > 60_000,
    );
    if (alvos.length === 0) return;
    alvos.forEach((r) => {
      autoResumidas.current.add(r.id);
      supabase.functions
        .invoke("transcrever-reuniao", {
          body: { reuniao_id: r.id, audio_path: r.audio_path, retomar: true },
        })
        .then(() => qc.invalidateQueries({ queryKey: ["reunioes"] }))
        .catch(() => autoResumidas.current.delete(r.id));
    });
  }, [data, qc]);

  // Filtragem em memória
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((r) => {
      if (filterStatus !== "todos" && r.status !== filterStatus) return false;
      if (filterTipo !== "todos" && r.tipo !== filterTipo) return false;
      if (!q) return true;
      const hay = [
        r.titulo,
        r.resumo,
        r.pauta,
        r.proximos_passos,
        (r.participantes ?? []).join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [data, search, filterStatus, filterTipo]);

  const total = data.length;
  const agendadas = data.filter((r) => r.status === "agendada").length;
  const realizadas = data.filter((r) => r.status === "realizada").length;
  const canceladas = data.filter((r) => r.status === "cancelada").length;
  const noMes = data.filter((r) => isThisMonth(new Date(r.data_reuniao))).length;
  const proximas = data.filter(
    (r) => r.status === "agendada" && isFuture(new Date(r.data_reuniao)),
  ).length;

  return (
    <div className="space-y-5">
      <PageHero
        loading={isLoading}
        eyebrow="Conversas e decisões"
        title="Reuniões"
        description="Pautas, resumos, transcrições, participantes e próximos passos — com IA."
        icon={CalIcon}
        tone="violet"
        actions={
          <Button onClick={openCreate} className="gap-2">
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
          {
            icon: CheckCircle2,
            label: "Realizadas",
            value: realizadas,
            tone: "emerald",
            hint: "Concluídas",
          },
          {
            icon: XCircle,
            label: "Canceladas",
            value: canceladas,
            tone: canceladas > 0 ? "rose" : "emerald",
            hint: canceladas > 0 ? "Revisar motivos" : "Sem cancelamentos",
          },
          {
            icon: Sparkles,
            label: "Neste mês",
            value: noMes,
            tone: "amber",
            hint: "Ritmo do time",
          },
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
        <EsqueletoCartoes quantidade={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CalIcon}
          title={
            data.length === 0 ? "Nenhuma reunião registrada" : "Nenhuma reunião com esses filtros"
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <ReuniaoCard
              key={r.id}
              r={r}
              job={uploadJobs[r.id]}
              colabs={colabs}
              onAbrir={setOpenDetail}
              onEditar={openEdit}
              onExcluir={setConfirmDelete}
              onAtribuir={updateAssignees}
            />
          ))}
        </div>
      )}

      <ReuniaoFormDialog formulario={formulario} colabs={colabs} />

      <ReuniaoDetalhe
        reuniao={openDetail}
        colabs={colabs}
        onFechar={() => setOpenDetail(null)}
        onEditar={openEdit}
        onExcluir={setConfirmDelete}
      />

      {/* Confirmar exclusão */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir reunião?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A reunião <strong>{confirmDelete?.titulo}</strong> e
              seus dados (incluindo o áudio, se houver) serão removidos permanentemente.
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
