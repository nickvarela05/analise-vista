import { createFileRoute } from "@tanstack/react-router";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarDays,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Filter,
  X as XIcon,
} from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { PageHero } from "@/components/shared/PageHero";
import { EmptyState } from "@/components/EmptyState";
import { type AssigneeOption } from "@/components/AssigneeCombobox";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CalendarioAnoGoogle, LegendaProcessos } from "@/components/processos/CalendarioProcessos";
import { ProcessoCard } from "@/components/processos/ProcessoCard";
import { ProcessoDialog } from "@/components/processos/ProcessoDialog";
import {
  computarStatusDinamico,
  diasParaInicio,
  type Processo,
  type ProcessoVinculo,
} from "@/components/processos/processos-lib";
import { processosDoAnoConsulta } from "@/lib/consultas-telas";
import { EsqueletoAno } from "@/components/shared/Esqueletos";

// ---------- Route ----------

export const Route = createFileRoute("/processos")({
  // Pré-carrega a lista ao passar o mouse no menu (só na pré-carga: na entrada direta a
  // sessão ainda pode não estar pronta, e a lista viria vazia por causa das regras de acesso).
  loader: ({ context, preload }) => {
    if (preload)
      void context.queryClient.prefetchQuery(processosDoAnoConsulta(new Date().getFullYear()));
  },
  errorComponent: RouteErrorBoundary,
  component: ProcessosRoute,
  head: () => ({
    meta: [
      { title: "Processos Anuais · Nexus" },
      {
        name: "description",
        content:
          "Calendário anual de processos: acompanhe períodos previstos e reais e organize a equipe.",
      },
      { property: "og:title", content: "Processos Anuais · Nexus" },
      {
        property: "og:description",
        content:
          "Visualize e acompanhe os períodos previstos e reais dos processos que ocorrem ao longo do ano.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ProcessosRoute() {
  return (
    <AppLayout>
      <Processos />
    </AppLayout>
  );
}

// ---------- Main component ----------

function Processos() {
  const { role, user } = useAuth();
  const isGestor = role === "gestor";
  // Desde 14/10/2026 a equipe toda cria e edita processos; excluir continua só com gestor.
  const podeEditar = role !== null;
  const qc = useQueryClient();

  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = React.useState<number>(anoAtual);
  const anosDisponiveis = React.useMemo(
    () => [anoAtual - 1, anoAtual, anoAtual + 1, anoAtual + 2],
    [anoAtual],
  );

  const [tab, setTab] = React.useState<"dividido" | "calendario" | "lista">("calendario");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Processo | null>(null);
  const [confirmDel, setConfirmDel] = React.useState<Processo | null>(null);
  const [filtroResp, setFiltroResp] = React.useState<string | null>(null);
  const [copiando, setCopiando] = React.useState(false);

  // ---------- Queries ----------
  const { data: processos = [], isLoading } = useQuery(processosDoAnoConsulta(ano));

  const { data: vinculos = [] } = useQuery({
    queryKey: ["processos-vinculos", ano],
    enabled: processos.length > 0,
    queryFn: async () => {
      const ids = processos.map((p) => p.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("processo_anual_vinculo" as never)
        .select("*")
        .in("processo_id", ids);
      if (error) throw error;
      return (data ?? []) as unknown as ProcessoVinculo[];
    },
  });

  const { data: colabs = [] } = useQuery({
    queryKey: ["proc-colabs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaborador")
        .select("id, nome, cargo, ativo")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string; cargo: string | null }[];
    },
  });

  const { data: tarefasMini = [] } = useQuery({
    queryKey: ["proc-tarefas-mini"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("todo")
        .select("id, titulo")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as { id: string; titulo: string }[];
    },
  });

  const { data: demandasMini = [] } = useQuery({
    queryKey: ["proc-demandas-mini"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demanda")
        .select("id, titulo")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as { id: string; titulo: string }[];
    },
  });

  const assigneeOptions: AssigneeOption[] = colabs;

  // ---------- Stats ----------
  const stats = React.useMemo(() => {
    const total = processos.length;
    let emAndamento = 0;
    let atrasados = 0;
    let proximos = 0;
    let concluidos = 0;
    for (const p of processos) {
      const s = computarStatusDinamico(p);
      if (s === "em_andamento") emAndamento++;
      else if (s === "atrasado") atrasados++;
      else if (s === "concluido") concluidos++;
      const dias = diasParaInicio(p);
      if (dias !== null && dias >= 0 && dias <= p.alerta_dias_antes && s !== "concluido") {
        proximos++;
      }
    }
    return { total, emAndamento, atrasados, proximos, concluidos };
  }, [processos]);

  // ---------- Actions ----------
  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["processos"] });
    qc.invalidateQueries({ queryKey: ["processos-vinculos"] });
  };

  const abrirNovo = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const abrirEdicao = (p: Processo) => {
    setEditing(p);
    setDialogOpen(true);
  };

  const excluir = async () => {
    if (!confirmDel) return;
    const { error } = await supabase
      .from("processo_anual" as never)
      .delete()
      .eq("id", confirmDel.id);
    if (error) toast.error("Erro ao excluir: " + error.message);
    else {
      toast.success("Processo excluído");
      invalidar();
    }
    setConfirmDel(null);
  };

  const copiarDoAnoAnterior = async () => {
    const anoOrigem = ano - 1;
    setCopiando(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data: origem, error: readErr } = await db
        .from("processo_anual")
        .select("*")
        .eq("ano", anoOrigem);
      if (readErr) throw readErr;
      const rows = (origem ?? []) as Processo[];
      if (rows.length === 0) {
        toast.info(`Nenhum processo em ${anoOrigem} para copiar.`);
        return;
      }
      const shift = (iso: string | null): string | null => {
        if (!iso) return null;
        const [y, m, d] = iso.split("-").map(Number);
        if (!y || !m || !d) return null;
        return `${ano}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      };
      const payload = rows.map((p) => ({
        ano,
        nome: p.nome,
        descricao: p.descricao,
        cor: p.cor,
        previsto_inicio: shift(p.previsto_inicio),
        previsto_fim: shift(p.previsto_fim),
        real_inicio: null,
        real_fim: null,
        responsaveis_ids: p.responsaveis_ids ?? [],
        equipe_toda: p.equipe_toda ?? false,
        status: "planejado" as const,
        alerta_dias_antes: p.alerta_dias_antes,
        observacoes: p.observacoes,
        criado_por: user?.id ?? null,
      }));
      const { error: insErr } = await db.from("processo_anual").insert(payload);
      if (insErr) throw insErr;
      toast.success(
        `${rows.length} processo${rows.length === 1 ? "" : "s"} copiado${rows.length === 1 ? "" : "s"} de ${anoOrigem}.`,
      );
      invalidar();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Erro ao copiar: " + msg);
    } finally {
      setCopiando(false);
    }
  };

  // Vinculos map: processo_id -> lista
  const vincPorProcesso = React.useMemo(() => {
    const map = new Map<string, ProcessoVinculo[]>();
    for (const v of vinculos) {
      const arr = map.get(v.processo_id) ?? [];
      arr.push(v);
      map.set(v.processo_id, arr);
    }
    return map;
  }, [vinculos]);

  // ---------- Render ----------
  return (
    <div className="space-y-6">
      <PageHero
        loading={isLoading}
        eyebrow="Organização anual"
        title="Processos Anuais"
        description="Cronograma dos processos recorrentes da equipe: acompanhe o período previsto x período real de cada um."
        icon={CalendarDays}
        tone="indigo"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-md border bg-background/60 backdrop-blur">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-r-none"
                onClick={() => setAno((a) => a - 1)}
                aria-label="Ano anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                <SelectTrigger className="h-8 w-[92px] rounded-none border-0 bg-transparent focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anosDisponiveis.map((a) => (
                    <SelectItem key={a} value={String(a)}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-l-none"
                onClick={() => setAno((a) => a + 1)}
                aria-label="Próximo ano"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {podeEditar && processos.length === 0 && ano !== anoAtual - 1 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={copiarDoAnoAnterior}
                disabled={copiando}
                title={`Duplicar processos de ${ano - 1} para ${ano}`}
              >
                {copiando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                Copiar de {ano - 1}
              </Button>
            )}
            {podeEditar && (
              <Button onClick={abrirNovo} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Novo processo
              </Button>
            )}
          </div>
        }
        stats={[
          { label: "Total", value: stats.total, tone: "indigo", icon: CalendarDays },
          { label: "Em andamento", value: stats.emAndamento, tone: "sky", icon: Clock },
          { label: "Próximos", value: stats.proximos, tone: "amber", icon: AlertTriangle },
          { label: "Atrasados", value: stats.atrasados, tone: "rose", icon: AlertTriangle },
          { label: "Concluídos", value: stats.concluidos, tone: "emerald", icon: CheckCircle2 },
        ]}
        statsGridClassName="grid-cols-2 sm:grid-cols-5"
      />

      {isLoading ? (
        <EsqueletoAno />
      ) : processos.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nenhum processo cadastrado"
          description={
            podeEditar
              ? "Comece adicionando o primeiro processo do ano."
              : "Nenhum processo cadastrado para este ano ainda."
          }
          action={
            podeEditar ? (
              <Button onClick={abrirNovo} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Novo processo
              </Button>
            ) : undefined
          }
        />
      ) : (
        (() => {
          const processosFiltrados = filtroResp
            ? processos.filter(
                (p) => p.equipe_toda || (p.responsaveis_ids ?? []).includes(filtroResp),
              )
            : processos;
          const respAtivo = filtroResp ? colabs.find((c) => c.id === filtroResp) : null;
          return (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Filter className="h-3.5 w-3.5" />
                  <span>Responsável:</span>
                </div>
                <Select
                  value={filtroResp ?? "__all"}
                  onValueChange={(v) => setFiltroResp(v === "__all" ? null : v)}
                >
                  <SelectTrigger className="h-8 w-[200px]">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">Todos</SelectItem>
                    {colabs.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {respAtivo && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={() => setFiltroResp(null)}
                  >
                    <XIcon className="h-3 w-3" />
                    Limpar
                  </Button>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {processosFiltrados.length} de {processos.length} processo
                  {processos.length === 1 ? "" : "s"}
                </span>
              </div>

              <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
                <TabsList>
                  <TabsTrigger value="dividido">Calendário + Lista</TabsTrigger>
                  <TabsTrigger value="calendario">Ano</TabsTrigger>
                  <TabsTrigger value="lista">Lista</TabsTrigger>
                </TabsList>

                <TabsContent value="dividido" className="mt-4">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)]">
                    <div className="space-y-4 min-w-0">
                      <CalendarioAnoGoogle
                        processos={processosFiltrados}
                        ano={ano}
                        onEdit={podeEditar ? abrirEdicao : undefined}
                      />
                      <LegendaProcessos processos={processosFiltrados} />
                    </div>
                    <div className="space-y-3 xl:max-h-[calc(100vh-16rem)] xl:overflow-y-auto xl:pr-1">
                      {processosFiltrados.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                          Nenhum processo para os filtros atuais.
                        </div>
                      ) : (
                        processosFiltrados.map((p) => (
                          <ProcessoCard
                            key={p.id}
                            processo={p}
                            colabs={colabs}
                            vinculos={vincPorProcesso.get(p.id) ?? []}
                            tarefasMini={tarefasMini}
                            demandasMini={demandasMini}
                            onEdit={podeEditar ? () => abrirEdicao(p) : undefined}
                            onDelete={isGestor ? () => setConfirmDel(p) : undefined}
                          />
                        ))
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="calendario" className="mt-4 space-y-4">
                  <CalendarioAnoGoogle
                    processos={processosFiltrados}
                    ano={ano}
                    onEdit={podeEditar ? abrirEdicao : undefined}
                  />
                  <LegendaProcessos processos={processosFiltrados} />
                </TabsContent>

                <TabsContent value="lista" className="mt-4 space-y-3">
                  {processosFiltrados.map((p) => (
                    <ProcessoCard
                      key={p.id}
                      processo={p}
                      colabs={colabs}
                      vinculos={vincPorProcesso.get(p.id) ?? []}
                      tarefasMini={tarefasMini}
                      demandasMini={demandasMini}
                      onEdit={podeEditar ? () => abrirEdicao(p) : undefined}
                      onDelete={isGestor ? () => setConfirmDel(p) : undefined}
                    />
                  ))}
                </TabsContent>
              </Tabs>
            </div>
          );
        })()
      )}

      <ProcessoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        ano={ano}
        userId={user?.id ?? null}
        assigneeOptions={assigneeOptions}
        tarefasMini={tarefasMini}
        demandasMini={demandasMini}
        vinculosDoProcesso={editing ? (vincPorProcesso.get(editing.id) ?? []) : []}
        onSaved={invalidar}
      />

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir processo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O processo <strong>{confirmDel?.nome}</strong> e seus
              vínculos serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={excluir}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
