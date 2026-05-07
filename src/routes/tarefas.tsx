import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Trash2, LayoutGrid, List as ListIcon, X, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { differenceInCalendarDays, isPast, isToday, isWithinInterval, addDays, startOfDay } from "date-fns";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { qk } from "@/lib/queries/keys";
import { AssigneeCombobox } from "@/components/AssigneeCombobox";
import { TarefaKanban } from "@/components/tarefas/TarefaKanban";
import { TarefaDrawer } from "@/components/tarefas/TarefaDrawer";
import { TarefaFilters, initialFilters, type TarefaFiltersState } from "@/components/tarefas/TarefaFilters";
import { WORKFLOW, STATUS_LABEL, PRIO, normalizeStatus } from "@/components/tarefas/lib/workflow";

export const Route = createFileRoute("/tarefas")({
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
  const [open, setOpen] = React.useState(false);
  const [drawerTarefa, setDrawerTarefa] = React.useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const [form, setForm] = React.useState({
    titulo: "",
    descricao: "",
    prioridade: "media" as (typeof PRIO)[number],
    status: "aberta" as string,
    data_prevista: "",
    responsaveis_ids: [] as string[],
    equipe_toda: false,
    demanda_id: null as string | null,
  });

  const { data: colabs = [] } = useQuery({
    queryKey: qk.tarefas.colabs(),
    staleTime: 5 * 60_000,
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

  const { data: demandas = [] } = useQuery({
    queryKey: qk.tarefas.demandasMini(),
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("demanda").select("id, titulo").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: tarefas = [], isLoading } = useQuery({
    queryKey: qk.tarefas.all(),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("todo").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Contadores agregados (comentários, checklist, anexos) por tarefa
  const { data: countsRaw = { coments: [], checks: [], anexos: [] } } = useQuery({
    queryKey: qk.tarefas.counts(),
    staleTime: 30_000,
    queryFn: async () => {
      const [coments, checks, anexos] = await Promise.all([
        supabase.from("todo_comentario").select("todo_id"),
        supabase.from("todo_checklist").select("todo_id, concluido"),
        supabase.from("todo_anexo").select("todo_id"),
      ]);
      return {
        coments: coments.data ?? [],
        checks: checks.data ?? [],
        anexos: anexos.data ?? [],
      };
    },
  });

  const countsMap = React.useMemo(() => {
    const m: Record<string, { comentarios: number; checklistTotal: number; checklistDone: number; anexos: number }> = {};
    countsRaw.coments.forEach((c: any) => {
      m[c.todo_id] = m[c.todo_id] ?? { comentarios: 0, checklistTotal: 0, checklistDone: 0, anexos: 0 };
      m[c.todo_id].comentarios++;
    });
    countsRaw.checks.forEach((c: any) => {
      m[c.todo_id] = m[c.todo_id] ?? { comentarios: 0, checklistTotal: 0, checklistDone: 0, anexos: 0 };
      m[c.todo_id].checklistTotal++;
      if (c.concluido) m[c.todo_id].checklistDone++;
    });
    countsRaw.anexos.forEach((a: any) => {
      m[a.todo_id] = m[a.todo_id] ?? { comentarios: 0, checklistTotal: 0, checklistDone: 0, anexos: 0 };
      m[a.todo_id].anexos++;
    });
    return m;
  }, [countsRaw]);

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
    const today = startOfDay(new Date());
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

  const adicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim()) return;
    const { error } = await supabase.from("todo").insert({
      titulo: form.titulo,
      descricao: form.descricao || null,
      prioridade: form.prioridade,
      status: form.status as any,
      responsaveis_ids: form.responsaveis_ids,
      equipe_toda: form.equipe_toda,
      data_prevista: form.data_prevista || null,
      demanda_id: form.demanda_id,
      criado_por: user?.id,
    });
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    toast.success("Tarefa criada");
    setOpen(false);
    setForm({
      titulo: "",
      descricao: "",
      prioridade: "media",
      status: "aberta",
      data_prevista: "",
      responsaveis_ids: [],
      equipe_toda: false,
      demanda_id: null,
    });
    qc.invalidateQueries({ queryKey: ["tarefas"] });
  };

  const onDropStatus = async (id: string, status: string) => {
    const tarefa = tarefas.find((t) => t.id === id);
    if (!tarefa) return;
    const updates: any = { status: status as any };
    if (status === "producao") updates.concluida_em = new Date().toISOString();
    else updates.concluida_em = null;
    const { error } = await supabase.from("todo").update(updates).eq("id", id);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    // Log histórico
    if (user) {
      await supabase.from("todo_historico").insert({
        todo_id: id,
        autor_id: user.id,
        campo: "status",
        valor_antigo: tarefa.status,
        valor_novo: status,
      });
    }
    qc.invalidateQueries({ queryKey: ["tarefas"] });
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
    const updates: any = { status };
    if (status === "producao") updates.concluida_em = new Date().toISOString();
    const { error } = await supabase.from("todo").update(updates).in("id", ids);
    if (error) toast.error("Erro", { description: error.message });
    else {
      toast.success(`${ids.length} tarefa(s) atualizada(s)`);
      clearSelection();
      qc.invalidateQueries({ queryKey: ["tarefas"] });
    }
  };

  const bulkUpdatePriority = async (prio: string) => {
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from("todo").update({ prioridade: prio as any }).in("id", ids);
    if (error) toast.error("Erro", { description: error.message });
    else {
      toast.success(`${ids.length} tarefa(s) atualizada(s)`);
      clearSelection();
      qc.invalidateQueries({ queryKey: ["tarefas"] });
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
      qc.invalidateQueries({ queryKey: ["tarefas"] });
    }
  };

  return (
    <div>
      <PageHeader
        title="Tarefas"
        description="Fluxo: Aberta → Em andamento → Homologação → Aprovado / Ressalvas / Reprovado → Produção"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Nova tarefa
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Nova tarefa</DialogTitle>
              </DialogHeader>
              <form onSubmit={adicionar} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Título</Label>
                  <Input
                    value={form.titulo}
                    onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Descrição</Label>
                  <Textarea
                    rows={3}
                    value={form.descricao}
                    onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WORKFLOW.map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Prioridade</Label>
                    <Select
                      value={form.prioridade}
                      onValueChange={(v) => setForm({ ...form, prioridade: v as typeof form.prioridade })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIO.map((p) => (
                          <SelectItem key={p} value={p} className="capitalize">
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Prazo</Label>
                    <Input
                      type="date"
                      value={form.data_prevista}
                      onChange={(e) => setForm({ ...form, data_prevista: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Demanda vinculada</Label>
                    <Select
                      value={form.demanda_id ?? "none"}
                      onValueChange={(v) => setForm({ ...form, demanda_id: v === "none" ? null : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Nenhuma" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {demandas.map((d: any) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.titulo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
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
                <DialogFooter>
                  <Button type="submit">Criar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-6">
        <StatCard
          title="Visão geral"
          size="sm"
          items={[
            { value: counts.ativas, label: "Ativas", tone: "primary" },
            { value: counts.atrasadas, label: "Atrasadas", tone: "destructive" },
            { value: counts.hoje, label: "Vencendo hoje", tone: "warning" },
            { value: counts.hml, label: "Homologação", tone: "info" },
            { value: counts.aprovado, label: "Aprovadas", tone: "success" },
            { value: counts.producao, label: "Em produção", tone: "success" },
          ]}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <TarefaFilters value={filters} onChange={setFilters} colabs={colabs} />

        <Tabs value={view} onValueChange={(v) => setView(v as "kanban" | "lista")} className="ml-auto">
          <TabsList className="h-9">
            <TabsTrigger value="kanban" className="text-xs">
              <LayoutGrid className="mr-1.5 h-3.5 w-3.5" /> <span className="hidden sm:inline">Kanban</span>
            </TabsTrigger>
            <TabsTrigger value="lista" className="text-xs">
              <ListIcon className="mr-1.5 h-3.5 w-3.5" /> <span className="hidden sm:inline">Lista</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <Card className="mb-3 flex flex-wrap items-center gap-2 border-primary/40 bg-primary/5 p-2">
          <span className="ml-2 text-sm font-medium">{selectedIds.size} selecionada(s)</span>
          <div className="flex flex-wrap gap-1.5 sm:ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  Mudar status <ChevronDown className="ml-1 h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Definir status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {WORKFLOW.map((s) => (
                  <DropdownMenuItem key={s} onClick={() => bulkUpdateStatus(s)}>
                    {STATUS_LABEL[s]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  Prioridade <ChevronDown className="ml-1 h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {PRIO.map((p) => (
                  <DropdownMenuItem key={p} onClick={() => bulkUpdatePriority(p)} className="capitalize">
                    {p}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="outline" onClick={bulkDelete} className="text-destructive">
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelection}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </Card>
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
        <ListaSimples
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

// Visualização em lista compacta (alternativa ao kanban)
function ListaSimples({
  tarefas,
  colabs,
  selectedIds,
  onToggleSelect,
  onOpen,
  countsMap,
}: {
  tarefas: any[];
  colabs: { id: string; nome: string }[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string, checked: boolean) => void;
  onOpen: (t: any) => void;
  countsMap: Record<string, { comentarios: number; checklistTotal: number; checklistDone: number; anexos: number }>;
}) {
  return (
    <Card className="divide-y">
      {tarefas.map((t) => {
        const responsaveis = t.equipe_toda
          ? colabs
          : colabs.filter((c) => (t.responsaveis_ids ?? []).includes(c.id));
        const prazo = t.data_prevista ? new Date(t.data_prevista) : null;
        const atrasada = prazo && isPast(prazo) && !isToday(prazo) && !["producao", "aprovado"].includes(t.status);
        const c = countsMap[t.id] ?? { comentarios: 0, checklistTotal: 0, checklistDone: 0, anexos: 0 };
        return (
          <div
            key={t.id}
            onClick={() => onOpen(t)}
            className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/40"
          >
            <input
              type="checkbox"
              checked={selectedIds.has(t.id)}
              onChange={(e) => onToggleSelect(t.id, e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{t.titulo}</span>
                {atrasada && (
                  <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                    Atrasada
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="capitalize">{STATUS_LABEL[t.status] ?? t.status}</span>
                <span>·</span>
                <span className="capitalize">{t.prioridade}</span>
                {prazo && (
                  <>
                    <span>·</span>
                    <span>{prazo.toLocaleDateString("pt-BR")}</span>
                  </>
                )}
                {c.comentarios > 0 && (
                  <>
                    <span>·</span>
                    <span>{c.comentarios} coments</span>
                  </>
                )}
                {c.checklistTotal > 0 && (
                  <>
                    <span>·</span>
                    <span>
                      {c.checklistDone}/{c.checklistTotal} itens
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex -space-x-1.5">
              {responsaveis.slice(0, 3).map((r) => (
                <div
                  key={r.id}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-background bg-primary/15 text-[10px] font-medium text-primary"
                  title={r.nome}
                >
                  {r.nome
                    .split(" ")
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </Card>
  );
}
