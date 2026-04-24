import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Inbox,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Search,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { KpiTile } from "@/components/KpiTile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { DemandaCard } from "@/components/demandas/DemandaCard";
import { DemandaDialog } from "@/components/demandas/DemandaDialog";
import { DemandaDetailDrawer } from "@/components/demandas/DemandaDetailDrawer";
import { CriarTarefaDialog } from "@/components/demandas/CriarTarefaDialog";
import {
  KANBAN_STATUS,
  PRIORIDADE_OPTS,
  STATUS_LABEL,
  STATUS_OPTS,
  describePrazo,
  type DemandaStatus,
} from "@/components/demandas/lib/demanda-utils";

export const Route = createFileRoute("/demandas")({
  component: DemandasRoute,
});

function DemandasRoute() {
  return (
    <AppLayout>
      <Demandas />
    </AppLayout>
  );
}

type ViewMode = "kanban" | "lista";
type PrazoFilter = "todos" | "atrasadas" | "hoje" | "semana" | "sem_prazo";

const VIEW_KEY = "demandas-view";

function Demandas() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [view, setView] = React.useState<ViewMode>(() => {
    if (typeof window === "undefined") return "kanban";
    return ((localStorage.getItem(VIEW_KEY) as ViewMode) ?? "kanban") satisfies ViewMode;
  });
  React.useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  const [search, setSearch] = React.useState("");
  const [prioFilter, setPrioFilter] = React.useState<string>("todas");
  const [respFilter, setRespFilter] = React.useState<string>("todos");
  const [prazoFilter, setPrazoFilter] = React.useState<PrazoFilter>("todos");
  const [statusFilter, setStatusFilter] = React.useState<string>("todos");

  const [openCreate, setOpenCreate] = React.useState(false);
  const [editing, setEditing] = React.useState<any>(null);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [tarefaTarget, setTarefaTarget] = React.useState<any>(null);

  const { data: colabs = [] } = useQuery({
    queryKey: ["dem-colabs"],
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

  const { data: demandas = [], isLoading } = useQuery({
    queryKey: ["demandas-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demanda")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Tarefa counts per demanda
  const { data: tarefaCounts = {} } = useQuery({
    queryKey: ["demandas-tarefa-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("todo")
        .select("demanda_id")
        .not("demanda_id", "is", null);
      if (error) throw error;
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        if (r.demanda_id) map[r.demanda_id] = (map[r.demanda_id] ?? 0) + 1;
      });
      return map;
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["demandas-all"] });
    qc.invalidateQueries({ queryKey: ["demandas-tarefa-counts"] });
    qc.invalidateQueries({ queryKey: ["demanda-tarefas"] });
    qc.invalidateQueries({ queryKey: ["dash-demandas"] });
    qc.invalidateQueries({ queryKey: ["dash-atribuicoes"] });
  };

  // Filtragem
  const filtered = React.useMemo(() => {
    const s = search.trim().toLowerCase();
    return demandas.filter((d: any) => {
      if (s) {
        const haystack = `${d.titulo} ${d.descricao ?? ""} ${d.solicitante ?? ""} ${(d.tags ?? []).join(" ")}`.toLowerCase();
        if (!haystack.includes(s)) return false;
      }
      if (prioFilter !== "todas" && d.prioridade !== prioFilter) return false;
      if (statusFilter !== "todos" && d.status !== statusFilter) return false;
      if (respFilter !== "todos") {
        if (respFilter === "__equipe__") {
          if (!d.equipe_toda) return false;
        } else if (respFilter === "__sem__") {
          if (d.equipe_toda || (d.responsaveis_ids ?? []).length > 0) return false;
        } else {
          if (!(d.responsaveis_ids ?? []).includes(respFilter)) return false;
        }
      }
      if (prazoFilter !== "todos") {
        const info = describePrazo(d.prazo, d.status);
        if (prazoFilter === "sem_prazo") {
          if (d.prazo) return false;
        } else if (prazoFilter === "atrasadas") {
          if (!info?.isAtrasada) return false;
        } else if (prazoFilter === "hoje") {
          if (!info?.isHoje) return false;
        } else if (prazoFilter === "semana") {
          if (!d.prazo) return false;
          const days = (new Date(d.prazo + "T00:00:00").getTime() - Date.now()) / 86400000;
          if (days < 0 || days > 7) return false;
        }
      }
      return true;
    });
  }, [demandas, search, prioFilter, statusFilter, respFilter, prazoFilter]);

  // KPIs (sobre todas, não filtradas)
  const kpis = React.useMemo(() => {
    const ativas = demandas.filter(
      (d: any) => d.status !== "concluida" && d.status !== "cancelada",
    );
    const novas = demandas.filter((d: any) => d.status === "aberta");
    const atrasadas = ativas.filter((d: any) => describePrazo(d.prazo, d.status)?.isAtrasada);
    const criticas = ativas.filter((d: any) => d.prioridade === "critica");
    const now = new Date();
    const concluidasMes = demandas.filter((d: any) => {
      if (d.status !== "concluida") return false;
      const u = new Date(d.updated_at);
      return u.getFullYear() === now.getFullYear() && u.getMonth() === now.getMonth();
    });
    return {
      ativas: ativas.length,
      novas: novas.length,
      atrasadas: atrasadas.length,
      criticas: criticas.length,
      concluidasMes: concluidasMes.length,
    };
  }, [demandas]);

  // Drag & drop kanban
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [overCol, setOverCol] = React.useState<string | null>(null);

  const onDropTo = async (status: DemandaStatus) => {
    const id = draggingId;
    setDraggingId(null);
    setOverCol(null);
    if (!id) return;
    const current = demandas.find((d: any) => d.id === id);
    if (!current || current.status === status) return;
    const { error } = await supabase.from("demanda").update({ status }).eq("id", id);
    if (error) toast.error("Erro ao mover", { description: error.message });
    else {
      toast.success(`Movida para ${STATUS_LABEL[status]}`);
      refresh();
    }
  };

  const detail = React.useMemo(
    () => filtered.find((d: any) => d.id === detailId) ?? demandas.find((d: any) => d.id === detailId) ?? null,
    [detailId, filtered, demandas],
  );

  return (
    <div>
      <PageHeader
        title="Demandas"
        description="Solicitações recebidas pela equipe — internas, clientes e automações."
        actions={
          <Button onClick={() => { setEditing(null); setOpenCreate(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Nova demanda
          </Button>
        }
      />

      {/* KPIs */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-5">
        <KpiTile
          icon={Inbox}
          label="Ativas"
          value={kpis.ativas}
          tone="info"
          loading={isLoading}
          hint="Não concluídas/canceladas"
        />
        <KpiTile
          icon={Clock}
          label="Novas (a iniciar)"
          value={kpis.novas}
          tone="primary"
          loading={isLoading}
          hint="Status: aberta"
        />
        <KpiTile
          icon={AlertCircle}
          label="Atrasadas"
          value={kpis.atrasadas}
          tone={kpis.atrasadas > 0 ? "destructive" : "primary"}
          loading={isLoading}
          hint={kpis.atrasadas > 0 ? "Requer atenção" : "Tudo no prazo"}
        />
        <KpiTile
          icon={TrendingUp}
          label="Críticas"
          value={kpis.criticas}
          tone={kpis.criticas > 0 ? "warning" : "primary"}
          loading={isLoading}
        />
        <KpiTile
          icon={CheckCircle2}
          label="Concluídas (mês)"
          value={kpis.concluidasMes}
          tone="success"
          loading={isLoading}
          className="col-span-2 md:col-span-1"
        />
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-auto sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar título, descrição, tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={prioFilter} onValueChange={setPrioFilter}>
          <SelectTrigger className="w-[140px] sm:w-36"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas prioridades</SelectItem>
            {PRIORIDADE_OPTS.map((p) => (
              <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={respFilter} onValueChange={setRespFilter}>
          <SelectTrigger className="w-[160px] sm:w-44"><SelectValue placeholder="Responsável" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos responsáveis</SelectItem>
            <SelectItem value="__equipe__">Equipe toda</SelectItem>
            <SelectItem value="__sem__">Sem responsável</SelectItem>
            {colabs.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Tabs value={prazoFilter} onValueChange={(v) => setPrazoFilter(v as PrazoFilter)} className="w-full sm:w-auto">
          <TabsList className="h-9 w-full overflow-x-auto sm:w-auto">
            <TabsTrigger value="todos" className="text-xs">Todos</TabsTrigger>
            <TabsTrigger value="atrasadas" className="text-xs">Atrasadas</TabsTrigger>
            <TabsTrigger value="hoje" className="text-xs">Hoje</TabsTrigger>
            <TabsTrigger value="semana" className="text-xs">7 dias</TabsTrigger>
            <TabsTrigger value="sem_prazo" className="text-xs">Sem prazo</TabsTrigger>
          </TabsList>
        </Tabs>
        {view === "lista" && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {STATUS_OPTS.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="ml-auto">
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as ViewMode)}>
            <ToggleGroupItem value="kanban" aria-label="Kanban" className="h-9">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="lista" aria-label="Lista" className="h-9">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <div className="flex h-60 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : demandas.length === 0 ? (
        <EmptyState title="Nenhuma demanda ainda" description="Clique em 'Nova demanda' para registrar a primeira." />
      ) : view === "kanban" ? (
        <KanbanView
          demandas={filtered}
          colabs={colabs}
          tarefaCounts={tarefaCounts}
          onCardClick={(id) => setDetailId(id)}
          onDragStart={(id) => setDraggingId(id)}
          overCol={overCol}
          setOverCol={setOverCol}
          onDropTo={onDropTo}
        />
      ) : (
        <ListaView
          demandas={filtered}
          colabs={colabs}
          tarefaCounts={tarefaCounts}
          onCardClick={(id) => setDetailId(id)}
        />
      )}

      {/* Diálogos */}
      <DemandaDialog
        open={openCreate}
        onOpenChange={(v) => { setOpenCreate(v); if (!v) setEditing(null); }}
        initial={editing}
        colabs={colabs}
        userId={user?.id}
        onSaved={refresh}
      />
      <DemandaDetailDrawer
        open={!!detailId}
        onOpenChange={(v) => !v && setDetailId(null)}
        demanda={detail}
        colabs={colabs}
        onEdit={() => {
          if (!detail) return;
          setEditing(detail);
          setDetailId(null);
          setOpenCreate(true);
        }}
        onCreateTarefa={() => detail && setTarefaTarget(detail)}
        onChanged={refresh}
      />
      <CriarTarefaDialog
        open={!!tarefaTarget}
        onOpenChange={(v) => !v && setTarefaTarget(null)}
        demanda={tarefaTarget}
        colabs={colabs}
        userId={user?.id}
        onCreated={refresh}
      />
    </div>
  );
}

function KanbanView({
  demandas,
  colabs,
  tarefaCounts,
  onCardClick,
  onDragStart,
  overCol,
  setOverCol,
  onDropTo,
}: {
  demandas: any[];
  colabs: any[];
  tarefaCounts: Record<string, number>;
  onCardClick: (id: string) => void;
  onDragStart: (id: string) => void;
  overCol: string | null;
  setOverCol: (v: string | null) => void;
  onDropTo: (status: DemandaStatus) => void;
}) {
  const grouped = React.useMemo(() => {
    const map: Record<string, any[]> = {};
    KANBAN_STATUS.forEach((s) => (map[s] = []));
    demandas.forEach((d) => {
      if (map[d.status]) map[d.status].push(d);
    });
    return map;
  }, [demandas]);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {KANBAN_STATUS.map((status) => {
        const items = grouped[status] ?? [];
        const isOver = overCol === status;
        return (
          <div
            key={status}
            onDragOver={(e) => {
              e.preventDefault();
              setOverCol(status);
            }}
            onDragLeave={() => setOverCol(null)}
            onDrop={() => onDropTo(status)}
            className={cn(
              "flex flex-col rounded-lg border bg-muted/30 p-2 transition-colors",
              isOver && "border-primary bg-primary/5",
            )}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {STATUS_LABEL[status]}
              </h3>
              <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {items.length}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-2 min-h-[80px]">
              {items.length === 0 ? (
                <p className="px-1 py-4 text-center text-[11px] text-muted-foreground/70">
                  Solte aqui
                </p>
              ) : (
                items.map((d) => (
                  <DemandaCard
                    key={d.id}
                    demanda={d}
                    options={colabs}
                    todoCount={tarefaCounts[d.id]}
                    onClick={() => onCardClick(d.id)}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      onDragStart(d.id);
                    }}
                    compact
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListaView({
  demandas,
  colabs,
  tarefaCounts,
  onCardClick,
}: {
  demandas: any[];
  colabs: any[];
  tarefaCounts: Record<string, number>;
  onCardClick: (id: string) => void;
}) {
  if (demandas.length === 0) {
    return (
      <EmptyState
        title="Nada encontrado"
        description="Ajuste os filtros para ver mais demandas."
      />
    );
  }
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
      {demandas.map((d) => (
        <DemandaCard
          key={d.id}
          demanda={d}
          options={colabs}
          todoCount={tarefaCounts[d.id]}
          onClick={() => onCardClick(d.id)}
        />
      ))}
    </div>
  );
}
