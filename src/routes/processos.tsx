import { createFileRoute } from "@tanstack/react-router";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Link2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Filter,
  X as XIcon,
} from "lucide-react";
import { z } from "zod";

import { AppLayout } from "@/components/AppLayout";
import { PageHero } from "@/components/shared/PageHero";
import { DialogHero } from "@/components/shared/DialogHero";
import { DialogSection } from "@/components/shared/DialogSection";
import { EmptyState } from "@/components/EmptyState";
import {
  AssigneeCombobox,
  AssigneeBadges,
  type AssigneeOption,
} from "@/components/AssigneeCombobox";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

// ---------- Types ----------

type ProcessoStatus = "planejado" | "em_andamento" | "concluido" | "atrasado";
type CorProcesso =
  | "indigo"
  | "sky"
  | "emerald"
  | "violet"
  | "amber"
  | "rose"
  | "cyan"
  | "primary";

type Processo = {
  id: string;
  ano: number;
  nome: string;
  descricao: string | null;
  cor: CorProcesso;
  previsto_inicio: string | null;
  previsto_fim: string | null;
  real_inicio: string | null;
  real_fim: string | null;
  responsaveis_ids: string[];
  equipe_toda: boolean;
  status: ProcessoStatus;
  alerta_dias_antes: number;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

type ProcessoVinculo = {
  id: string;
  processo_id: string;
  tipo: "tarefa" | "demanda";
  ref_id: string;
};

// ---------- Constants ----------

const STATUS_LABEL: Record<ProcessoStatus, string> = {
  planejado: "Planejado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  atrasado: "Atrasado",
};

const STATUS_TONE: Record<
  ProcessoStatus,
  { bg: string; text: string; ring: string }
> = {
  planejado: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    ring: "ring-border",
  },
  em_andamento: {
    bg: "bg-sky-500/15",
    text: "text-sky-600 dark:text-sky-400",
    ring: "ring-sky-500/30",
  },
  concluido: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/30",
  },
  atrasado: {
    bg: "bg-rose-500/15",
    text: "text-rose-600 dark:text-rose-400",
    ring: "ring-rose-500/30",
  },
};

const COR_OPTIONS: { value: CorProcesso; label: string; swatch: string }[] = [
  { value: "indigo", label: "Índigo", swatch: "bg-indigo-500" },
  { value: "sky", label: "Azul", swatch: "bg-sky-500" },
  { value: "emerald", label: "Verde", swatch: "bg-emerald-500" },
  { value: "violet", label: "Violeta", swatch: "bg-violet-500" },
  { value: "amber", label: "Âmbar", swatch: "bg-amber-500" },
  { value: "rose", label: "Rosa", swatch: "bg-rose-500" },
  { value: "cyan", label: "Ciano", swatch: "bg-cyan-500" },
  { value: "primary", label: "Primário", swatch: "bg-primary" },
];

const COR_BG: Record<CorProcesso, string> = {
  indigo: "bg-indigo-500",
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  cyan: "bg-cyan-500",
  primary: "bg-primary",
};

const COR_BG_SOFT: Record<CorProcesso, string> = {
  indigo: "bg-indigo-500/25 border-indigo-500/60",
  sky: "bg-sky-500/25 border-sky-500/60",
  emerald: "bg-emerald-500/25 border-emerald-500/60",
  violet: "bg-violet-500/25 border-violet-500/60",
  amber: "bg-amber-500/25 border-amber-500/60",
  rose: "bg-rose-500/25 border-rose-500/60",
  cyan: "bg-cyan-500/25 border-cyan-500/60",
  primary: "bg-primary/25 border-primary/60",
};

const MESES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

// ---------- Route ----------

export const Route = createFileRoute("/processos")({
  errorComponent: RouteErrorBoundary,
  component: ProcessosRoute,
  head: () => ({
    meta: [
      { title: "Processos Anuais · NexusGestão" },
      {
        name: "description",
        content:
          "Calendário anual de processos: acompanhe períodos previstos e reais e organize a equipe.",
      },
      { property: "og:title", content: "Processos Anuais · NexusGestão" },
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

// ---------- Helpers ----------

const HOJE = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

function parseISODate(s: string | null): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function fmtBR(s: string | null): string {
  const d = parseISODate(s);
  if (!d) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function fmtBRData(s: string | null): string {
  const d = parseISODate(s);
  if (!d) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
  });
}

function diasEntre(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function duracaoDias(inicio: string | null, fim: string | null): number | null {
  const a = parseISODate(inicio);
  const b = parseISODate(fim);
  if (!a || !b) return null;
  return diasEntre(a, b) + 1; // inclui o dia inicial
}

function desvioReal(
  prevInicio: string | null,
  prevFim: string | null,
  realInicio: string | null,
  realFim: string | null,
): { tipo: "atraso" | "adiantado" | "igual"; dias: number | null } {
  const pi = parseISODate(prevInicio);
  const ri = parseISODate(realInicio);
  if (!pi || !ri) return { tipo: "igual", dias: null };
  const d = diasEntre(pi, ri);
  if (d > 0) return { tipo: "atraso", dias: d };
  if (d < 0) return { tipo: "adiantado", dias: -d };
  return { tipo: "igual", dias: 0 };
}

function computarStatusDinamico(p: Processo): ProcessoStatus {
  // status persistido tem prioridade se concluido
  if (p.status === "concluido") return "concluido";
  const hoje = HOJE();
  const pi = parseISODate(p.previsto_inicio);
  const pf = parseISODate(p.previsto_fim);
  const ri = parseISODate(p.real_inicio);
  const rf = parseISODate(p.real_fim);
  if (rf && rf < hoje) return "concluido";
  if (ri && !rf) return "em_andamento";
  if (pf && !rf && pf < hoje) return "atrasado";
  if (pi && !ri && pi <= hoje) return "em_andamento";
  return "planejado";
}

function diasParaInicio(p: Processo): number | null {
  const pi = parseISODate(p.previsto_inicio);
  if (!pi) return null;
  return diasEntre(HOJE(), pi);
}

// ---------- Main component ----------

function Processos() {
  const { role, user } = useAuth();
  const isGestor = role === "gestor";
  const qc = useQueryClient();

  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = React.useState<number>(anoAtual);
  const anosDisponiveis = React.useMemo(
    () => [anoAtual - 1, anoAtual, anoAtual + 1, anoAtual + 2],
    [anoAtual],
  );

  const [tab, setTab] = React.useState<"calendario" | "lista">("calendario");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Processo | null>(null);
  const [confirmDel, setConfirmDel] = React.useState<Processo | null>(null);
  const [filtroResp, setFiltroResp] = React.useState<string | null>(null);
  const [copiando, setCopiando] = React.useState(false);

  // ---------- Queries ----------
  const { data: processos = [], isLoading } = useQuery({
    queryKey: ["processos", ano],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processo_anual" as never)
        .select("*")
        .eq("ano", ano)
        .order("previsto_inicio", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as Processo[];
    },
  });

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
      toast.success(`${rows.length} processo${rows.length === 1 ? "" : "s"} copiado${rows.length === 1 ? "" : "s"} de ${anoOrigem}.`);
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
            {isGestor && processos.length === 0 && ano !== anoAtual - 1 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={copiarDoAnoAnterior}
                disabled={copiando}
                title={`Duplicar processos de ${ano - 1} para ${ano}`}
              >
                {copiando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                Copiar de {ano - 1}
              </Button>
            )}
            {isGestor && (
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
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : processos.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nenhum processo cadastrado"
          description={
            isGestor
              ? "Comece adicionando o primeiro processo do ano."
              : "Nenhum processo cadastrado para este ano ainda."
          }
          action={
            isGestor ? (
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
            ? processos.filter((p) =>
                p.equipe_toda || (p.responsaveis_ids ?? []).includes(filtroResp),
              )
            : processos;
          const respAtivo = filtroResp
            ? colabs.find((c) => c.id === filtroResp)
            : null;
          return (
            <div className="space-y-4">
              <FaixaAgora processos={processosFiltrados} ano={ano} />

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
                  <TabsTrigger value="calendario">Calendário anual</TabsTrigger>
                  <TabsTrigger value="lista">Lista</TabsTrigger>
                </TabsList>

                <TabsContent value="calendario" className="mt-4">
                  <CalendarioAnual
                    processos={processosFiltrados}
                    ano={ano}
                    onEdit={isGestor ? abrirEdicao : undefined}
                  />
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
                      onEdit={isGestor ? () => abrirEdicao(p) : undefined}
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
        vinculosDoProcesso={
          editing ? (vincPorProcesso.get(editing.id) ?? []) : []
        }
        onSaved={invalidar}
      />

      <AlertDialog
        open={!!confirmDel}
        onOpenChange={(o) => !o && setConfirmDel(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir processo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O processo{" "}
              <strong>{confirmDel?.nome}</strong> e seus vínculos serão
              removidos.
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

// ---------- Calendário anual (Gantt leve) ----------

// ---------- Faixa "Agora" (sticky) ----------
function FaixaAgora({ processos, ano }: { processos: Processo[]; ano: number }) {
  const hoje = HOJE();
  const emAndamento = React.useMemo(() => {
    return processos
      .map((p) => {
        const s = computarStatusDinamico(p);
        const inicio = parseISODate(p.real_inicio ?? p.previsto_inicio);
        const fim = parseISODate(p.real_fim ?? p.previsto_fim);
        if (!inicio || !fim || fim < inicio) return null;
        if (hoje < inicio || hoje > fim) return null;
        const total = Math.max(1, diasEntre(inicio, fim) + 1);
        const passados = Math.max(0, diasEntre(inicio, hoje) + 1);
        const pct = Math.min(100, Math.round((passados / total) * 100));
        const restante = Math.max(0, diasEntre(hoje, fim));
        return { p, s, pct, restante, total };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.restante - b.restante);
  }, [processos, hoje]);

  if (hoje.getFullYear() !== ano) return null;
  if (emAndamento.length === 0) return null;

  return (
    <div className="rounded-xl border bg-gradient-to-r from-primary/5 via-background to-background p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Acontecendo agora
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {emAndamento.slice(0, 6).map(({ p, pct, restante }) => (
          <div key={p.id} className="rounded-lg border bg-card/60 p-2.5">
            <div className="mb-1.5 flex items-center gap-2">
              <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", COR_BG[p.cor])} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.nome}</span>
              <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                {restante === 0 ? "termina hoje" : `${restante}d restantes`}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full transition-all", COR_BG[p.cor])}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-1 text-[10px] tabular-nums text-muted-foreground">
              {pct}% concluído
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Bento "Foco do mês" ----------
const MES_NOME_LONGO = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function BentoDoMes({
  processos,
  ano,
  onEdit,
}: {
  processos: Processo[];
  ano: number;
  onEdit?: (p: Processo) => void;
}) {
  const hoje = HOJE();
  const anoEhAtual = hoje.getFullYear() === ano;
  const [mes, setMes] = React.useState<number>(anoEhAtual ? hoje.getMonth() : 0);

  // Corrige quando o usuário troca o ano
  React.useEffect(() => {
    if (anoEhAtual) setMes(hoje.getMonth());
    else setMes(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano]);

  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const inicioMes = new Date(ano, mes, 1);
  const fimMes = new Date(ano, mes, diasNoMes);

  // Barras que aparecem no mês (previsto OU real cruza o mês)
  const barras = React.useMemo(() => {
    return processos
      .map((p) => {
        const pi = parseISODate(p.previsto_inicio);
        const pf = parseISODate(p.previsto_fim);
        const ri = parseISODate(p.real_inicio);
        const rf = parseISODate(p.real_fim);
        const clamp = (d: Date | null, isFim: boolean): number | null => {
          if (!d) return null;
          if (d > fimMes) return isFim ? diasNoMes : null;
          if (d < inicioMes) return isFim ? null : 1;
          return d.getDate();
        };
        const previsto =
          pi && pf && !(pf < inicioMes || pi > fimMes)
            ? { start: clamp(pi, false)!, end: clamp(pf, true)! }
            : null;
        const real =
          ri && (rf ?? hoje) && !((rf ?? hoje) < inicioMes || ri > fimMes)
            ? { start: clamp(ri, false)!, end: clamp(rf ?? hoje, true)! }
            : null;
        if (!previsto && !real) return null;
        return { p, previsto, real };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [processos, ano, mes, diasNoMes, hoje]);

  // Próximos 30 dias (a partir de hoje)
  const proximos = React.useMemo(() => {
    if (!anoEhAtual) return [];
    const limite = new Date(hoje);
    limite.setDate(limite.getDate() + 30);
    return processos
      .map((p) => {
        const pi = parseISODate(p.previsto_inicio);
        if (!pi) return null;
        if (pi < hoje || pi > limite) return null;
        const s = computarStatusDinamico(p);
        if (s === "concluido" || s === "em_andamento") return null;
        return { p, dias: diasEntre(hoje, pi) };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.dias - b.dias)
      .slice(0, 6);
  }, [processos, hoje, anoEhAtual]);

  // Acontecendo agora (só ano atual)
  const agora = React.useMemo(() => {
    if (!anoEhAtual) return [];
    return processos
      .map((p) => {
        const inicio = parseISODate(p.real_inicio ?? p.previsto_inicio);
        const fim = parseISODate(p.real_fim ?? p.previsto_fim);
        if (!inicio || !fim || fim < inicio) return null;
        if (hoje < inicio || hoje > fim) return null;
        const total = Math.max(1, diasEntre(inicio, fim) + 1);
        const passados = Math.max(0, diasEntre(inicio, hoje) + 1);
        const pct = Math.min(100, Math.round((passados / total) * 100));
        const restante = Math.max(0, diasEntre(hoje, fim));
        return { p, pct, restante };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.restante - b.restante)
      .slice(0, 4);
  }, [processos, hoje, anoEhAtual]);

  const hojePctNoMes =
    anoEhAtual && hoje.getMonth() === mes
      ? ((hoje.getDate() - 1) / (diasNoMes - 1)) * 100
      : null;

  // Marcadores de semana (7,14,21,28)
  const semanas = [7, 14, 21, 28].filter((d) => d < diasNoMes);

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {/* Cell A - Timeline do mês (2/3) */}
      <Card className="lg:col-span-2 overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Foco do mês
              </div>
              <div className="text-base font-semibold leading-tight">
                {MES_NOME_LONGO[mes]} <span className="text-muted-foreground">/ {ano}</span>
              </div>
            </div>
            <div className="ml-auto flex items-center rounded-md border bg-background/60">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-r-none"
                onClick={() => setMes((m) => (m + 11) % 12)}
                aria-label="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                <SelectTrigger className="h-7 w-[110px] rounded-none border-0 bg-transparent text-xs focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MES_NOME_LONGO.map((n, i) => (
                    <SelectItem key={n} value={String(i)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-l-none"
                onClick={() => setMes((m) => (m + 1) % 12)}
                aria-label="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Escala de dias */}
          <div className="relative">
            <div className="mb-1 grid grid-cols-[160px_1fr] gap-3">
              <div />
              <div className="relative h-4">
                {[1, 5, 10, 15, 20, 25, diasNoMes].map((d) => (
                  <span
                    key={d}
                    className="absolute -translate-x-1/2 text-[10px] tabular-nums text-muted-foreground"
                    style={{ left: `${((d - 1) / (diasNoMes - 1)) * 100}%` }}
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>

            {barras.length === 0 ? (
              <div className="rounded-md border border-dashed py-8 text-center text-xs text-muted-foreground">
                Nenhum processo previsto para {MES_NOME_LONGO[mes]}.
              </div>
            ) : (
              <TooltipProvider delayDuration={100}>
                <div className="space-y-1.5">
                  {barras.map(({ p, previsto, real }) => {
                    const s = computarStatusDinamico(p);
                    return (
                      <div
                        key={p.id}
                        className="grid grid-cols-[160px_1fr] items-center gap-3"
                      >
                        <button
                          type="button"
                          onClick={onEdit ? () => onEdit(p) : undefined}
                          className={cn(
                            "flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs",
                            onEdit && "hover:bg-muted",
                          )}
                        >
                          <span
                            className={cn("h-2 w-2 shrink-0 rounded-full", COR_BG[p.cor])}
                          />
                          <span className="min-w-0 flex-1 truncate font-medium">{p.nome}</span>
                        </button>
                        <div className="relative h-7 rounded-md bg-muted/40">
                          {/* Grades das semanas */}
                          {semanas.map((d) => (
                            <span
                              key={d}
                              className="absolute top-0 h-full w-px bg-border/60"
                              style={{ left: `${((d - 1) / (diasNoMes - 1)) * 100}%` }}
                            />
                          ))}
                          {/* Hoje */}
                          {hojePctNoMes !== null && (
                            <span
                              className="absolute top-0 h-full w-[2px] bg-rose-500"
                              style={{ left: `${hojePctNoMes}%` }}
                            />
                          )}
                          {/* Previsto (contorno tracejado) */}
                          {previsto && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  className={cn(
                                    "absolute top-1 h-5 rounded border-2 border-dashed",
                                    COR_BG_SOFT[p.cor],
                                  )}
                                  style={{
                                    left: `${((previsto.start - 1) / (diasNoMes - 1)) * 100}%`,
                                    width: `${((previsto.end - previsto.start) / (diasNoMes - 1)) * 100}%`,
                                    minWidth: 6,
                                  }}
                                />
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                Previsto: dia {previsto.start} → {previsto.end}
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {/* Real (barra sólida sobreposta) */}
                          {real && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  className={cn(
                                    "absolute top-2 h-3 rounded-sm shadow-sm",
                                    COR_BG[p.cor],
                                  )}
                                  style={{
                                    left: `${((real.start - 1) / (diasNoMes - 1)) * 100}%`,
                                    width: `${((real.end - real.start) / (diasNoMes - 1)) * 100}%`,
                                    minWidth: 4,
                                  }}
                                />
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                Real: dia {real.start} → {real.end}
                                {s === "em_andamento" && " (em andamento)"}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TooltipProvider>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Coluna direita: Agora + Próximos */}
      <div className="grid gap-3">
        {/* Agora */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Acontecendo agora
              </span>
              <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
                {agora.length}
              </span>
            </div>
            {agora.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
                Nada rodando hoje.
              </div>
            ) : (
              <div className="space-y-2">
                {agora.map(({ p, pct, restante }) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={onEdit ? () => onEdit(p) : undefined}
                    className={cn(
                      "block w-full rounded-md border bg-card/40 p-2 text-left",
                      onEdit && "hover:bg-muted/60",
                    )}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", COR_BG[p.cor])} />
                      <span className="min-w-0 flex-1 truncate text-xs font-medium">
                        {p.nome}
                      </span>
                      <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">
                        {restante === 0 ? "hoje" : `${restante}d`}
                      </span>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", COR_BG[p.cor])}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Próximos 30 dias */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Próximos 30 dias
              </span>
              <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
                {proximos.length}
              </span>
            </div>
            {proximos.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
                Nada previsto para começar.
              </div>
            ) : (
              <div className="space-y-1.5">
                {proximos.map(({ p, dias }) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={onEdit ? () => onEdit(p) : undefined}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left",
                      onEdit && "hover:bg-muted",
                    )}
                  >
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", COR_BG[p.cor])} />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">
                      {p.nome}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 tabular-nums text-[10px]",
                        dias <= 3 && "border-amber-500/60 text-amber-600 dark:text-amber-400",
                        dias <= 0 && "border-rose-500/60 text-rose-600 dark:text-rose-400",
                      )}
                    >
                      {dias === 0 ? "hoje" : dias === 1 ? "amanhã" : `em ${dias}d`}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------- Calendário anual (single-row overlay) ----------
function CalendarioAnual({
  processos,
  ano,
  onEdit,
}: {
  processos: Processo[];
  ano: number;
  onEdit?: (p: Processo) => void;
}) {
  // Faixa fracional (0..12) da data considerando dia do mês
  const toFrac = (s: string | null): number | null => {
    const d = parseISODate(s);
    if (!d) return null;
    if (d.getFullYear() < ano) return 0;
    if (d.getFullYear() > ano) return 12;
    const diasNoMes = new Date(ano, d.getMonth() + 1, 0).getDate();
    return d.getMonth() + (d.getDate() - 1) / diasNoMes;
  };

  const hojeMarker = React.useMemo(() => {
    const hoje = HOJE();
    if (hoje.getFullYear() !== ano) return null;
    const diasNoMes = new Date(ano, hoje.getMonth() + 1, 0).getDate();
    return (hoje.getMonth() + (hoje.getDate() - 1) / diasNoMes) / 12;
  }, [ano]);

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        {/* Legenda */}
        <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-6 rounded-sm border-2 border-dashed border-muted-foreground/50" />
            Previsto (cronograma)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-6 rounded-sm bg-indigo-500" />
            Real (executado)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-[2px] rounded-sm bg-rose-500" />
            Hoje
          </span>
        </div>

        <TooltipProvider delayDuration={100}>
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              {/* Header meses */}
              <div className="mb-2 grid grid-cols-[240px_1fr] gap-3">
                <div />
                <div className="grid grid-cols-12 gap-0 border-b">
                  {MESES.map((m) => (
                    <div
                      key={m}
                      className="border-l px-1 py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground first:border-l-0"
                    >
                      {m}
                    </div>
                  ))}
                </div>
              </div>

              {/* Linhas */}
              <div className="space-y-1.5">
                {processos.map((p) => {
                  const pStart = toFrac(p.previsto_inicio);
                  const pEnd = toFrac(p.previsto_fim);
                  const rStart = toFrac(p.real_inicio);
                  const rEnd = toFrac(p.real_fim);
                  const s = computarStatusDinamico(p);
                  const durPrev = duracaoDias(p.previsto_inicio, p.previsto_fim);
                  const durReal = duracaoDias(p.real_inicio, p.real_fim);
                  const dev = desvioReal(
                    p.previsto_inicio,
                    p.previsto_fim,
                    p.real_inicio,
                    p.real_fim,
                  );
                  const corPrev = p.cor;
                  return (
                    <div
                      key={p.id}
                      className="grid grid-cols-[240px_1fr] items-stretch gap-3"
                    >
                      {/* Coluna esquerda: nome + meta */}
                      <button
                        type="button"
                        onClick={onEdit ? () => onEdit(p) : undefined}
                        className={cn(
                          "group flex min-w-0 flex-col justify-center gap-0.5 rounded-md px-2 py-1.5 text-left",
                          onEdit && "hover:bg-muted",
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", COR_BG[p.cor])} />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {p.nome}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 pl-4.5">
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ring-1",
                              STATUS_TONE[s].bg,
                              STATUS_TONE[s].text,
                              STATUS_TONE[s].ring,
                            )}
                          >
                            {STATUS_LABEL[s]}
                          </span>
                          {durPrev !== null && (
                            <span className="text-[10px] tabular-nums text-muted-foreground">
                              prev {durPrev}d
                            </span>
                          )}
                          {durReal !== null && (
                            <span className="text-[10px] tabular-nums text-foreground/80">
                              · real {durReal}d
                            </span>
                          )}
                          {dev.dias !== null && dev.dias > 0 && (
                            <span
                              className={cn(
                                "text-[10px] tabular-nums",
                                dev.tipo === "atraso"
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-emerald-600 dark:text-emerald-400",
                              )}
                            >
                              {dev.tipo === "atraso" ? "+" : "−"}
                              {dev.dias}d
                            </span>
                          )}
                        </div>
                      </button>

                      {/* Coluna direita: timeline com previsto e real sobrepostos */}
                      <div className="relative h-11 rounded-md border bg-muted/20">
                        {/* Grid meses */}
                        <div className="pointer-events-none absolute inset-0 grid grid-cols-12">
                          {Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} className="border-l first:border-l-0" />
                          ))}
                        </div>

                        {/* Barra previsto — contorno tracejado, altura total */}
                        {pStart !== null && pEnd !== null && pEnd >= pStart && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="absolute inset-y-1.5 rounded-md border-2 border-dashed"
                                style={{
                                  left: `${(pStart / 12) * 100}%`,
                                  width: `${Math.max(1, ((pEnd - pStart) / 12) * 100)}%`,
                                  borderColor: `color-mix(in oklab, var(--${corPrev}) 65%, transparent)`,
                                  backgroundColor: `color-mix(in oklab, var(--${corPrev}) 8%, transparent)`,
                                }}
                              />
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p className="font-medium">Previsto</p>
                              <p className="text-xs">
                                {fmtBR(p.previsto_inicio)} → {fmtBR(p.previsto_fim)}
                                {durPrev !== null ? ` · ${durPrev} dias` : ""}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}

                        {/* Barra real — preenchida, sobreposta em cima */}
                        {rStart !== null && rEnd !== null && rEnd >= rStart && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  "absolute inset-y-[10px] flex items-center justify-center overflow-hidden rounded-sm shadow-sm",
                                  COR_BG[p.cor],
                                )}
                                style={{
                                  left: `${(rStart / 12) * 100}%`,
                                  width: `${Math.max(1, ((rEnd - rStart) / 12) * 100)}%`,
                                }}
                              >
                                <span className="pointer-events-none truncate px-1 text-[9px] font-semibold tabular-nums text-primary-foreground">
                                  {durReal !== null ? `${durReal}d` : ""}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              <p className="font-medium">Real</p>
                              <p className="text-xs">
                                {fmtBR(p.real_inicio)} → {fmtBR(p.real_fim)}
                                {durReal !== null ? ` · ${durReal} dias` : ""}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}

                        {/* Marker hoje */}
                        {hojeMarker !== null && (
                          <div
                            className="pointer-events-none absolute inset-y-0 z-10 w-[2px] bg-rose-500/80"
                            style={{ left: `${hojeMarker * 100}%` }}
                            aria-label="Hoje"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Rodapé com marca "Hoje" para orientação */}
              {hojeMarker !== null && (
                <div className="mt-2 grid grid-cols-[240px_1fr] gap-3">
                  <div />
                  <div className="relative h-4">
                    <div
                      className="absolute -translate-x-1/2 text-[9px] font-semibold text-rose-500"
                      style={{ left: `${hojeMarker * 100}%` }}
                    >
                      Hoje
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}

// ---------- Card lista ----------



function ProcessoCard({
  processo: p,
  colabs,
  vinculos,
  tarefasMini,
  demandasMini,
  onEdit,
  onDelete,
}: {
  processo: Processo;
  colabs: AssigneeOption[];
  vinculos: ProcessoVinculo[];
  tarefasMini: { id: string; titulo: string }[];
  demandasMini: { id: string; titulo: string }[];
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const s = computarStatusDinamico(p);
  const dias = diasParaInicio(p);
  const proximo =
    dias !== null && dias >= 0 && dias <= p.alerta_dias_antes && s !== "concluido";
  const durPrev = duracaoDias(p.previsto_inicio, p.previsto_fim);
  const durReal = duracaoDias(p.real_inicio, p.real_fim);
  const dev = desvioReal(p.previsto_inicio, p.previsto_fim, p.real_inicio, p.real_fim);

  const tarefaMap = new Map(tarefasMini.map((t) => [t.id, t.titulo]));
  const demandaMap = new Map(demandasMini.map((d) => [d.id, d.titulo]));

  const toFracAno = (s: string | null): number | null => {
    const d = parseISODate(s);
    if (!d) return null;
    const ano = p.ano;
    if (d.getFullYear() < ano) return 0;
    if (d.getFullYear() > ano) return 12;
    const diasNoMes = new Date(ano, d.getMonth() + 1, 0).getDate();
    return d.getMonth() + (d.getDate() - 1) / diasNoMes;
  };
  const pStart = toFracAno(p.previsto_inicio);
  const pEnd = toFracAno(p.previsto_fim);
  const rStart = toFracAno(p.real_inicio);
  const rEnd = toFracAno(p.real_fim);

  return (
    <Card className={cn("overflow-hidden", proximo && "ring-1 ring-amber-500/40")}>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={cn(
                "mt-1 h-4 w-4 shrink-0 rounded-full",
                COR_BG[p.cor],
              )}
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold">{p.nome}</h3>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px]",
                    STATUS_TONE[s].text,
                    STATUS_TONE[s].ring,
                  )}
                >
                  {STATUS_LABEL[s]}
                </Badge>
                {proximo && (
                  <Badge className="gap-1 bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/30 hover:bg-amber-500/20 dark:text-amber-400">
                    <AlertTriangle className="h-3 w-3" />
                    {dias === 0 ? "Começa hoje" : `Em ${dias} dia${dias === 1 ? "" : "s"}`}
                  </Badge>
                )}
              </div>
              {p.descricao && (
                <p className="mt-1 text-sm text-muted-foreground">{p.descricao}</p>
              )}
            </div>
          </div>

          {(onEdit || onDelete) && (
            <div className="flex gap-1">
              {onEdit && (
                <Button size="icon" variant="ghost" onClick={onEdit}>
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {onDelete && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onDelete}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Mini timeline comparativa */}
        <div className="mt-3 rounded-lg border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">Visualização anual</span>
            {dev.dias !== null && dev.dias > 0 && (
              <span className={cn(
                "font-medium",
                dev.tipo === "atraso" ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400",
              )}>
                {dev.tipo === "atraso" ? "Início com atraso" : "Início adiantado"} de {dev.dias} dia{dev.dias === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <div className="relative h-10">
            <div className="pointer-events-none absolute inset-0 grid grid-cols-12">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="border-l first:border-l-0" />
              ))}
            </div>
            {pStart !== null && pEnd !== null && pEnd >= pStart && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="absolute top-1 flex h-3 items-center rounded-sm border-2 border-dashed"
                    style={{
                      left: `${(pStart / 12) * 100}%`,
                      width: `${Math.max(1, ((pEnd - pStart) / 12) * 100)}%`,
                      borderColor: `color-mix(in oklab, var(--${p.cor}) 60%, transparent)`,
                      backgroundColor: `color-mix(in oklab, var(--${p.cor}) 12%, transparent)`,
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent side="top">
                  Previsto: {fmtBR(p.previsto_inicio)} → {fmtBR(p.previsto_fim)}
                  {durPrev !== null ? ` · ${durPrev} dias` : ""}
                </TooltipContent>
              </Tooltip>
            )}
            {rStart !== null && rEnd !== null && rEnd >= rStart && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn("absolute bottom-1 flex h-3 items-center rounded-sm", COR_BG[p.cor])}
                    style={{
                      left: `${(rStart / 12) * 100}%`,
                      width: `${Math.max(1, ((rEnd - rStart) / 12) * 100)}%`,
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Real: {fmtBR(p.real_inicio)} → {fmtBR(p.real_fim)}
                  {durReal !== null ? ` · ${durReal} dias` : ""}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className={cn("inline-block h-2 w-4 rounded-sm border border-dashed", COR_BG_SOFT[p.cor])} />
              Previsto{durPrev !== null ? ` · ${durPrev}d` : ""}
            </span>
            <span className="flex items-center gap-1.5">
              <span className={cn("inline-block h-2 w-4 rounded-sm", COR_BG[p.cor])} />
              Real{durReal !== null ? ` · ${durReal}d` : " — ainda não definido"}
            </span>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <InfoBloco
            titulo="Previsto"
            inicio={p.previsto_inicio}
            fim={p.previsto_fim}
          />
          <InfoBloco
            titulo="Real"
            inicio={p.real_inicio}
            fim={p.real_fim}
          />
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Responsáveis
            </p>
            <AssigneeBadges
              selectedIds={p.responsaveis_ids}
              equipeToda={p.equipe_toda}
              options={colabs}
            />
          </div>
        </div>

        {vinculos.length > 0 && (
          <div className="mt-3 border-t pt-3">
            <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Link2 className="h-3 w-3" /> Vínculos
            </p>
            <div className="flex flex-wrap gap-1">
              {vinculos.map((v) => {
                const label =
                  v.tipo === "tarefa"
                    ? tarefaMap.get(v.ref_id)
                    : demandaMap.get(v.ref_id);
                return (
                  <Badge key={v.id} variant="secondary" className="text-[10px]">
                    {v.tipo === "tarefa" ? "Tarefa" : "Demanda"}:{" "}
                    {label ?? "(removido)"}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {p.observacoes && (
          <div className="mt-3 border-t pt-3 text-sm text-muted-foreground">
            {p.observacoes}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InfoBloco({
  titulo,
  inicio,
  fim,
}: {
  titulo: string;
  inicio: string | null;
  fim: string | null;
}) {
  const dur = duracaoDias(inicio, fim);
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {titulo}
      </p>
      <p className="text-sm font-medium">
        {fmtBRData(inicio)} <span className="text-muted-foreground">→</span>{" "}
        {fmtBRData(fim)}
      </p>
      {dur !== null && (
        <p className="text-xs text-muted-foreground">{dur} dia{dur === 1 ? "" : "s"}</p>
      )}
    </div>
  );
}

// ---------- Dialog ----------

const processoSchema = z
  .object({
    nome: z.string().trim().min(1, "Informe um nome").max(200),
    descricao: z.string().max(2000).nullable(),
    cor: z.enum([
      "indigo",
      "sky",
      "emerald",
      "violet",
      "amber",
      "rose",
      "cyan",
      "primary",
    ]),
    previsto_inicio: z.string().nullable(),
    previsto_fim: z.string().nullable(),
    real_inicio: z.string().nullable(),
    real_fim: z.string().nullable(),
    responsaveis_ids: z.array(z.string().uuid()),
    equipe_toda: z.boolean(),
    status: z.enum(["planejado", "em_andamento", "concluido", "atrasado"]),
    alerta_dias_antes: z.number().int().min(0).max(365),
    observacoes: z.string().max(3000).nullable(),
  })
  .refine(
    (v) =>
      !v.previsto_inicio ||
      !v.previsto_fim ||
      v.previsto_fim >= v.previsto_inicio,
    { message: "Fim previsto não pode ser antes do início", path: ["previsto_fim"] },
  )
  .refine(
    (v) => !v.real_inicio || !v.real_fim || v.real_fim >= v.real_inicio,
    { message: "Fim real não pode ser antes do início", path: ["real_fim"] },
  );

type ProcessoForm = z.infer<typeof processoSchema>;

function makeInitial(editing: Processo | null): ProcessoForm {
  return {
    nome: editing?.nome ?? "",
    descricao: editing?.descricao ?? null,
    cor: editing?.cor ?? "indigo",
    previsto_inicio: editing?.previsto_inicio ?? null,
    previsto_fim: editing?.previsto_fim ?? null,
    real_inicio: editing?.real_inicio ?? null,
    real_fim: editing?.real_fim ?? null,
    responsaveis_ids: editing?.responsaveis_ids ?? [],
    equipe_toda: editing?.equipe_toda ?? false,
    status: editing?.status ?? "planejado",
    alerta_dias_antes: editing?.alerta_dias_antes ?? 14,
    observacoes: editing?.observacoes ?? null,
  };
}

function ProcessoDialog({
  open,
  onOpenChange,
  editing,
  ano,
  userId,
  assigneeOptions,
  tarefasMini,
  demandasMini,
  vinculosDoProcesso,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Processo | null;
  ano: number;
  userId: string | null;
  assigneeOptions: AssigneeOption[];
  tarefasMini: { id: string; titulo: string }[];
  demandasMini: { id: string; titulo: string }[];
  vinculosDoProcesso: ProcessoVinculo[];
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState<ProcessoForm>(() => makeInitial(editing));
  const [tarefaIds, setTarefaIds] = React.useState<string[]>([]);
  const [demandaIds, setDemandaIds] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);

  const vinculosRef = React.useRef(vinculosDoProcesso);
  vinculosRef.current = vinculosDoProcesso;
  React.useEffect(() => {
    if (open) {
      const v = vinculosRef.current;
      setForm(makeInitial(editing));
      setTarefaIds(v.filter((x) => x.tipo === "tarefa").map((x) => x.ref_id));
      setDemandaIds(v.filter((x) => x.tipo === "demanda").map((x) => x.ref_id));
    }
    // Only reinitialize when the dialog opens or the target row changes —
    // never when the parent re-renders with a new vinculos array reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  const setField = <K extends keyof ProcessoForm>(k: K, v: ProcessoForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const salvar = async () => {
    const parsed = processoSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...parsed.data,
        ano,
        criado_por: editing ? undefined : userId,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;

      let processoId: string;
      if (editing) {
        const { error } = await db
          .from("processo_anual")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        processoId = editing.id;
      } else {
        const { data, error } = await db
          .from("processo_anual")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        processoId = (data as { id: string }).id;
      }

      const { error: delErr } = await db
        .from("processo_anual_vinculo")
        .delete()
        .eq("processo_id", processoId);
      if (delErr) throw delErr;

      const novos = [
        ...tarefaIds.map((ref_id) => ({
          processo_id: processoId,
          tipo: "tarefa" as const,
          ref_id,
        })),
        ...demandaIds.map((ref_id) => ({
          processo_id: processoId,
          tipo: "demanda" as const,
          ref_id,
        })),
      ];
      if (novos.length > 0) {
        const { error: insErr } = await db
          .from("processo_anual_vinculo")
          .insert(novos);
        if (insErr) throw insErr;
      }

      toast.success(editing ? "Processo atualizado" : "Processo criado");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Erro ao salvar: " + msg);
    } finally {
      setSaving(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHero
          icon={CalendarDays}
          tone="indigo"
          title={editing ? "Editar processo" : "Novo processo"}
          description={`Ano ${ano} — defina os períodos previsto e real, responsáveis e vínculos.`}
        />

        <div className="space-y-5">
          <DialogSection title="Identificação">
            <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setField("nome", e.target.value)}
                  placeholder="Ex: Fechamento contábil, Auditoria..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cor</Label>
                <Select
                  value={form.cor}
                  onValueChange={(v) => setField("cor", v as CorProcesso)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COR_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        <span className="flex items-center gap-2">
                          <span
                            className={cn("h-3 w-3 rounded-full", c.swatch)}
                          />
                          {c.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                value={form.descricao ?? ""}
                onChange={(e) =>
                  setField("descricao", e.target.value || null)
                }
                rows={2}
                placeholder="Contexto ou detalhes do processo"
              />
            </div>
          </DialogSection>

          <DialogSection title="Períodos">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Previsto
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Início</Label>
                    <Input
                      type="date"
                      value={form.previsto_inicio ?? ""}
                      onChange={(e) =>
                        setField("previsto_inicio", e.target.value || null)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Fim</Label>
                    <Input
                      type="date"
                      value={form.previsto_fim ?? ""}
                      onChange={(e) =>
                        setField("previsto_fim", e.target.value || null)
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Real
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Início</Label>
                    <Input
                      type="date"
                      value={form.real_inicio ?? ""}
                      onChange={(e) =>
                        setField("real_inicio", e.target.value || null)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Fim</Label>
                    <Input
                      type="date"
                      value={form.real_fim ?? ""}
                      onChange={(e) =>
                        setField("real_fim", e.target.value || null)
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </DialogSection>

          <DialogSection title="Atribuição & alertas">
            <div className="grid gap-3 sm:grid-cols-[1fr_160px_160px]">
              <div className="space-y-1.5">
                <Label>Responsáveis</Label>
                <AssigneeCombobox
                  options={assigneeOptions}
                  selectedIds={form.responsaveis_ids}
                  equipeToda={form.equipe_toda}
                  onChange={({ selectedIds, equipeToda }) => {
                    setField("responsaveis_ids", selectedIds);
                    setField("equipe_toda", equipeToda);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setField("status", v as ProcessoStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.keys(STATUS_LABEL) as ProcessoStatus[]
                    ).map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Alerta (dias antes)</Label>
                <Input
                  type="number"
                  min={0}
                  max={365}
                  value={form.alerta_dias_antes}
                  onChange={(e) =>
                    setField(
                      "alerta_dias_antes",
                      Math.max(0, Number(e.target.value) || 0),
                    )
                  }
                />
              </div>
            </div>
          </DialogSection>

          <DialogSection title="Vínculos">
            <div className="grid gap-3 sm:grid-cols-2">
              <MultiSelectSimples
                label="Tarefas"
                options={tarefasMini}
                selected={tarefaIds}
                onChange={setTarefaIds}
              />
              <MultiSelectSimples
                label="Demandas"
                options={demandasMini}
                selected={demandaIds}
                onChange={setDemandaIds}
              />
            </div>
          </DialogSection>

          <DialogSection title="Observações">
            <Textarea
              value={form.observacoes ?? ""}
              onChange={(e) => setField("observacoes", e.target.value || null)}
              rows={3}
              placeholder="Notas internas, riscos, checklist..."
            />
          </DialogSection>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Multi-select simples (busca por texto) ----------

function MultiSelectSimples({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { id: string; titulo: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [busca, setBusca] = React.useState("");
  const selectedSet = new Set(selected);
  const filtrado = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = options.filter((o) => !selectedSet.has(o.id));
    if (!q) return base.slice(0, 30);
    return base.filter((o) => o.titulo.toLowerCase().includes(q)).slice(0, 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, options, selected]);

  const optionMap = new Map(options.map((o) => [o.id, o.titulo]));

  const toggle = (id: string) => {
    if (selectedSet.has(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  };

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        placeholder={`Buscar ${label.toLowerCase()}...`}
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((id) => (
            <Badge key={id} variant="secondary" className="gap-1 text-[10px]">
              {optionMap.get(id) ?? "(removido)"}
              <button
                type="button"
                onClick={() => toggle(id)}
                aria-label="Remover"
                className="ml-0.5 opacity-60 hover:opacity-100"
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
      )}
      {busca && (
        <div className="max-h-40 overflow-y-auto rounded-md border">
          {filtrado.length === 0 ? (
            <p className="p-2 text-xs text-muted-foreground">Nenhum resultado</p>
          ) : (
            filtrado.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => toggle(o.id)}
                className="block w-full truncate px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                {o.titulo}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
