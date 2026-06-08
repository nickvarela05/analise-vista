import { createFileRoute } from "@tanstack/react-router";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Loader2, LayoutGrid, List as ListIcon,
  Activity, Archive, FlaskConical, CheckCircle2, Rocket,
  CheckSquare, ChevronDown, FlaskRound,
} from "lucide-react";
import { toast } from "sonner";
import { isPast, isToday, isWithinInterval, addDays, startOfDay } from "date-fns";
import { AppLayout } from "@/components/AppLayout";
import { PageHero } from "@/components/shared/PageHero";
import { EmptyState } from "@/components/EmptyState";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { qk } from "@/lib/queries/keys";
import { TarefaKanban } from "@/components/tarefas/TarefaKanban";
import { TarefaDrawer } from "@/components/tarefas/TarefaDrawer";
import { TarefaFilters, initialFilters, type TarefaFiltersState } from "@/components/tarefas/TarefaFilters";
import { normalizeStatus, WORKFLOW, STATUS_LABEL } from "@/components/tarefas/lib/workflow";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTarefasData } from "@/components/tarefas/useTarefasData";
import { NovaTarefaDialog } from "@/components/tarefas/NovaTarefaDialog";
import { ImportarTarefasDialog } from "@/components/tarefas/ImportarTarefasDialog";
import { ExportarTarefasDialog } from "@/components/tarefas/ExportarTarefasDialog";
import { TarefasBulkBar } from "@/components/tarefas/TarefasBulkBar";
import { TarefasLista } from "@/components/tarefas/TarefasLista";
import type { TarefaRow } from "@/lib/db-types";

export const Route = createFileRoute("/tarefas")({
  errorComponent: RouteErrorBoundary,
  component: TarefasRoute,
});

function TarefasRoute() {
  return (
    <AppLayout>
      <Tarefas />
    </AppLayout>
  );
}

function Tarefas() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = React.useState<"kanban" | "lista">("kanban");
  const [filters, setFilters] = React.useState<TarefaFiltersState>(initialFilters);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [drawerTarefa, setDrawerTarefa] = React.useState<TarefaRow | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const { colabs, demandas, tarefas, lotes, isLoading, countsMap } = useTarefasData();

  // Aplica filtros
  const filtered = React.useMemo(() => {
    const today = startOfDay(new Date());
    const week = addDays(today, 7);
    return tarefas.filter((t) => {
      if (filters.search && !t.titulo.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.prioridades.length && !filters.prioridades.includes(t.prioridade)) return false;
      if (filters.responsaveis.length) {
        const ids = (t.responsaveis_ids ?? []) as string[];
        if (!filters.responsaveis.some((r) => ids.includes(r)) && !t.equipe_toda) return false;
      }
      if (filters.comDemanda === "sim" && !t.demanda_id) return false;
      if (filters.comDemanda === "nao" && t.demanda_id) return false;
      if (filters.emTeste && !t.em_teste) return false;
      if (filters.origem === "homologacao" && t.origem_importacao !== "homologacao") return false;
      if (filters.origem === "manual" && t.origem_importacao) return false;
      if (filters.lotes.length && (!t.lote_importacao_id || !filters.lotes.includes(t.lote_importacao_id))) return false;
      if (filters.prazo !== "todos") {
        const prazo = t.data_prevista ? new Date(t.data_prevista) : null;
        if (filters.prazo === "sem_prazo" && prazo) return false;
        if (filters.prazo !== "sem_prazo" && !prazo) return false;
        if (prazo) {
          const finalizada = ["producao", "aprovado"].includes(t.status);
          if (filters.prazo === "atrasadas" && (!isPast(prazo) || isToday(prazo) || finalizada)) return false;
          if (filters.prazo === "hoje" && !isToday(prazo)) return false;
          if (filters.prazo === "semana" && !isWithinInterval(prazo, { start: today, end: week })) return false;
        }
      }
      return true;
    });
  }, [tarefas, filters]);

  // Sincroniza tarefa do drawer
  React.useEffect(() => {
    if (drawerTarefa) {
      const fresh = tarefas.find((t) => t.id === drawerTarefa.id);
      if (fresh) setDrawerTarefa(fresh);
    }
  }, [tarefas]); // eslint-disable-line

  // KPIs com base no NOVO workflow
  const counts = React.useMemo(() => {
    const norm = filtered.map((t) => ({ ...t, _s: normalizeStatus(t.status) }));
    return {
      ativas: norm.filter((t) => !["producao", "reprovado"].includes(t._s)).length,
      atrasadas: norm.filter(
        (t) =>
          t.data_prevista &&
          isPast(new Date(t.data_prevista)) &&
          !isToday(new Date(t.data_prevista)) &&
          !["producao", "aprovado", "reprovado"].includes(t._s),
      ).length,
      hoje: norm.filter((t) => t.data_prevista && isToday(new Date(t.data_prevista))).length,
      hml: norm.filter((t) => t._s === "homologacao").length,
      aprovado: norm.filter((t) => t._s === "aprovado" || t._s === "aprovado_ressalvas").length,
      producao: norm.filter((t) => t._s === "producao").length,
    };
  }, [filtered]);

  const onDropStatus = async (id: string, status: string) => {
    const tarefa = tarefas.find((t) => t.id === id);
    if (!tarefa) return;
    const updates = {
      status: status as TarefaRow["status"],
      concluida_em: status === "producao" ? new Date().toISOString() : null,
    };
    const { error } = await supabase.from("todo").update(updates).eq("id", id);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    if (user) {
      await supabase.from("todo_historico").insert({
        todo_id: id,
        autor_id: user.id,
        campo: "status",
        valor_antigo: tarefa.status,
        valor_novo: status,
      });
    }
    qc.invalidateQueries({ queryKey: qk.tarefas.all() });
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const bulkUpdateStatus = async (status: string) => {
    const ids = Array.from(selectedIds);
    const updates = {
      status: status as TarefaRow["status"],
      ...(status === "producao" ? { concluida_em: new Date().toISOString() } : {}),
    };
    const { error } = await supabase.from("todo").update(updates).in("id", ids);
    if (error) toast.error("Erro", { description: error.message });
    else {
      toast.success(`${ids.length} tarefa(s) atualizada(s)`);
      clearSelection();
      qc.invalidateQueries({ queryKey: qk.tarefas.all() });
    }
  };

  const bulkUpdatePriority = async (prio: string) => {
    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from("todo")
      .update({ prioridade: prio as never })
      .in("id", ids);
    if (error) toast.error("Erro", { description: error.message });
    else {
      toast.success(`${ids.length} tarefa(s) atualizada(s)`);
      clearSelection();
      qc.invalidateQueries({ queryKey: qk.tarefas.all() });
    }
  };

  const bulkUpdateEmTeste = async (value: boolean) => {
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from("todo").update({ em_teste: value }).in("id", ids);
    if (error) toast.error("Erro", { description: error.message });
    else {
      toast.success(`${ids.length} tarefa(s) ${value ? "marcadas" : "desmarcadas"} como em teste`);
      clearSelection();
      qc.invalidateQueries({ queryKey: qk.tarefas.all() });
    }
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!confirm(`Excluir ${ids.length} tarefa(s)?`)) return;
    const { error } = await supabase.from("todo").delete().in("id", ids);
    if (error) toast.error("Erro", { description: error.message });
    else {
      toast.success(`${ids.length} tarefa(s) removida(s)`);
      clearSelection();
      qc.invalidateQueries({ queryKey: qk.tarefas.all() });
    }
  };

  const selectAll = () => setSelectedIds(new Set(filtered.map((t) => t.id)));
  const selectByStatus = (status: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filtered.forEach((t) => {
        if (normalizeStatus(t.status) === status) next.add(t.id);
      });
      return next;
    });
  };

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Fluxo de trabalho"
        title="Tarefas"
        description="Acompanhe o andamento da equipe — da abertura à produção, com visão por status e prioridade."
        icon={CheckSquare}
        tone="emerald"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ImportarTarefasDialog />
            <ExportarTarefasDialog
              todasTarefas={tarefas}
              tarefasFiltradas={filtered}
              colabs={colabs}
              demandas={demandas}
              lotes={lotes}
            />
            <NovaTarefaDialog colabs={colabs} demandas={demandas} />
          </div>
        }
        stats={[
          { icon: Activity,       label: "Ativas",        value: counts.ativas,    tone: "primary",     hint: "Em curso" },
          { icon: AlertTriangle,  label: "Atrasadas",     value: counts.atrasadas, tone: "destructive", pulse: counts.atrasadas > 0, hint: "Prazo vencido" },
          { icon: Clock,          label: "Vencem hoje",   value: counts.hoje,      tone: "amber",       hint: "Foco do dia" },
          { icon: FlaskConical,   label: "Homologação",   value: counts.hml,       tone: "sky",         hint: "Em validação" },
          { icon: CheckCircle2,   label: "Aprovadas",     value: counts.aprovado,  tone: "emerald",     hint: "Prontas p/ subir" },
          { icon: Rocket,         label: "Em produção",   value: counts.producao,  tone: "violet",      hint: "Entregues" },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card/60 p-2 backdrop-blur">
        <TarefaFilters value={filters} onChange={setFilters} colabs={colabs} lotes={lotes} />

        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-9">
                <CheckSquare className="mr-1.5 h-3.5 w-3.5" /> Selecionar <ChevronDown className="ml-1 h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={selectAll}>Selecionar todas ({filtered.length})</DropdownMenuItem>
              <DropdownMenuItem onClick={clearSelection}>Limpar seleção</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Por status</DropdownMenuLabel>
              {WORKFLOW.map((s) => {
                const n = filtered.filter((t) => normalizeStatus(t.status) === s).length;
                return (
                  <DropdownMenuItem key={s} onClick={() => selectByStatus(s)} disabled={n === 0}>
                    {STATUS_LABEL[s]} ({n})
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <Tabs value={view} onValueChange={(v) => setView(v as "kanban" | "lista")}>
            <TabsList className="h-9 bg-muted/60">
              <TabsTrigger value="kanban" className="text-xs data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-300">
                <LayoutGrid className="mr-1.5 h-3.5 w-3.5" /> <span className="hidden sm:inline">Kanban</span>
              </TabsTrigger>
              <TabsTrigger value="lista" className="text-xs data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-300">
                <ListIcon className="mr-1.5 h-3.5 w-3.5" /> <span className="hidden sm:inline">Lista</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <TarefasBulkBar
          count={selectedIds.size}
          onBulkStatus={bulkUpdateStatus}
          onBulkPriority={bulkUpdatePriority}
          onBulkEmTeste={bulkUpdateEmTeste}
          onBulkDelete={bulkDelete}
          onClear={clearSelection}
        />
      )}

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title="Nenhuma tarefa encontrada" description="Ajuste os filtros ou crie uma nova tarefa." />
      ) : view === "kanban" ? (
        <TarefaKanban
          tarefas={filtered}
          colabs={colabs}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onOpen={(t) => {
            setDrawerTarefa(t);
            setDrawerOpen(true);
          }}
          onDropStatus={onDropStatus}
          countsMap={countsMap}
        />
      ) : (
        <TarefasLista
          tarefas={filtered}
          colabs={colabs}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onOpen={(t) => {
            setDrawerTarefa(t);
            setDrawerOpen(true);
          }}
          countsMap={countsMap}
        />
      )}

      <TarefaDrawer
        tarefa={drawerTarefa}
        open={drawerOpen}
        onOpenChange={(v) => {
          setDrawerOpen(v);
          if (!v) setDrawerTarefa(null);
        }}
        colabs={colabs}
      />
    </div>
  );
}
