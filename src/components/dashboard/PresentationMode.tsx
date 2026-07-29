import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  X,
  Pause,
  Play,
  ChevronLeft,
  ChevronRight,
  Presentation,
  Activity,
  Gauge,
  Inbox,
  CalendarClock,
  Users,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { qk } from "@/lib/queries/keys";
import type { PulseItem } from "./DashboardHero";
import { AvisosBanner } from "./AvisosBanner";
import { AtribuicoesChart, StatusTarefasPie } from "./DashboardCharts";
import { AtividadesSemanaPanel, type Atividade } from "./AtividadesSemanaPanel";
import { EquipeAtivaPanel } from "./EquipeAtivaPanel";
import { HorariosPanel, type HorarioItem } from "./HorariosPanel";
import {
  FunilRelatoriosCard,
  TopSolicitantesCard,
  VelocitySemanalCard,
  LeadTimeCard,
  ThroughputCard,
  AgingBacklogCard,
  HeatmapPrazosCard,
  WipColaboradorCard,
  TaxaReprovacaoCard,
  TempoPorEtapaCard,
  CategoriaOrigemCard,
  SlaUrgenciaCard,
} from "./analytics/AnalyticsCards";
import { ProcessosCalendarioListaCard } from "./ProcessosCalendarioListaCard";
import { HomologacaoPanel } from "./HomologacaoPanel";

import type { PreviewItem } from "@/components/PreviewDialog";
import type { TarefaRow, DemandaRow, ReuniaoRow } from "@/lib/db-types";

const ROTATION_MS = 75_000;

export type PresentationProps = {
  open: boolean;
  onClose: () => void;
  nome?: string | null;
  pulse: PulseItem[];
  avisos: any[];
  solicitacoes: any[];
  inativosIds: Set<string>;
  atribuicoes: any[];
  pieTarefas: any[];
  atividades: Atividade[];
  weekStart: Date;
  weekEnd: Date;
  colaboradores: { id: string; nome: string }[];
  meuColabId: string | null;
  horarios: HorarioItem[];
  totalColaboradores: number;
  feriasAtivas: number;
  proximasFerias: any[];
  onPreview: (item: PreviewItem) => void;
  tarefas: TarefaRow[];
  demandas: DemandaRow[];
  reunioes: ReuniaoRow[];
};

type PanelDef = {
  key: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  render: () => React.ReactNode;
};

export function PresentationMode(props: PresentationProps) {
  const { open, onClose } = props;
  const qc = useQueryClient();
  const [idx, setIdx] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [tick, setTick] = React.useState(0);
  const [now, setNow] = React.useState(() => new Date());
  const startedAtRef = React.useRef<number>(Date.now());

  const panels = React.useMemo<PanelDef[]>(() => buildPanels(props), [props]);

  React.useEffect(() => {
    if (open) {
      setIdx(0);
      setPaused(false);
      startedAtRef.current = Date.now();
    }
  }, [open]);

  const refetchAll = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: qk.dash.chamados() });
    qc.invalidateQueries({ queryKey: qk.dash.tarefas() });
    qc.invalidateQueries({ queryKey: qk.dash.reunioes() });
    qc.invalidateQueries({ queryKey: qk.dash.avisos() });
    qc.invalidateQueries({ queryKey: qk.dash.demandas() });
    qc.invalidateQueries({ queryKey: qk.dash.solicitacoesRelatorios() });
    qc.invalidateQueries({ queryKey: qk.dash.ferias() });
    qc.invalidateQueries({ queryKey: qk.dash.colaboradores() });
  }, [qc]);

  const go = React.useCallback(
    (next: number) => {
      const n = ((next % panels.length) + panels.length) % panels.length;
      setIdx(n);
      startedAtRef.current = Date.now();
      refetchAll();
    },
    [panels.length, refetchAll],
  );

  React.useEffect(() => {
    if (!open || paused) return;
    const rotate = setInterval(() => {
      setIdx((i) => (i + 1) % panels.length);
      startedAtRef.current = Date.now();
      refetchAll();
    }, ROTATION_MS);
    const progress = setInterval(() => {
      setTick((t) => t + 1);
      setNow(new Date());
    }, 500);
    return () => {
      clearInterval(rotate);
      clearInterval(progress);
    };
  }, [open, paused, panels.length, refetchAll]);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(idx + 1);
      else if (e.key === "ArrowLeft") go(idx - 1);
      else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, idx, go, onClose]);

  if (!open) return null;

  const elapsed = Date.now() - startedAtRef.current;
  const pct = Math.min(100, (elapsed / ROTATION_MS) * 100);
  const secondsLeft = Math.max(0, Math.ceil((ROTATION_MS - elapsed) / 1000));
  const current = panels[idx];
  const CurrentIcon = current.icon;
  const hoje = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  const hora = now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-gradient-to-br from-background via-background to-muted/30 animate-fade-in">
      {/* Top bar */}
      <header className="relative flex shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-card/70 px-3 py-2 backdrop-blur-md sm:gap-4 sm:px-6 sm:py-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/20 sm:h-10 sm:w-10">
            <Presentation className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold leading-tight sm:text-sm">Modo apresentação</div>
            <div className="hidden truncate text-[10px] text-muted-foreground capitalize tabular-nums sm:block sm:text-xs">
              {hoje} · {hora}
            </div>
          </div>
        </div>

        {/* Segmented tabs */}
        <nav className="hidden items-center gap-1 rounded-full border border-border/60 bg-muted/40 p-1 xl:flex">
          {panels.map((p, i) => {
            const Icon = p.icon;
            const active = i === idx;
            return (
              <button
                key={p.key}
                onClick={() => go(i)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                  active
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{p.title}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {/* Dots (mobile fallback) */}
          <div className="flex items-center gap-1.5 xl:hidden">
            {panels.map((p, i) => (
              <button
                key={p.key}
                onClick={() => go(i)}
                aria-label={`Ir para ${p.title}`}
                className={cn(
                  "h-2 rounded-full transition-all",
                  i === idx ? "w-6 bg-primary sm:w-8" : "w-2 bg-muted hover:bg-muted-foreground/40",
                )}
              />
            ))}
          </div>

          <div className={cn(
            "hidden h-8 min-w-14 items-center justify-center rounded-full border px-2 text-[11px] font-semibold tabular-nums md:flex sm:min-w-16 sm:px-3",
            paused
              ? "border-warning/40 bg-warning/10 text-warning"
              : "border-primary/30 bg-primary/10 text-primary",
          )}>
            {paused ? "PAUSA" : `${secondsLeft}s`}
          </div>

          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => go(idx - 1)} aria-label="Anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 sm:h-9 sm:w-9"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? "Retomar" : "Pausar"}
            >
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => go(idx + 1)} aria-label="Próximo">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={onClose} aria-label="Sair (Esc)">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="h-0.5 w-full bg-muted/40">
        <div
          className="h-full bg-gradient-to-r from-primary via-primary to-primary/70 transition-[width] duration-200 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Content */}
      <main className="min-h-0 flex-1 overflow-hidden px-3 py-3 sm:px-6 sm:py-5">
        <div className="mx-auto flex h-full max-w-[1800px] flex-col">
          <div className="mb-2 flex items-end justify-between gap-2 sm:mb-4 sm:gap-4">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20 sm:h-11 sm:w-11">
                <CurrentIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold tracking-tight leading-tight sm:text-2xl">
                  {current.title}
                </h2>
                <p className="truncate text-xs text-muted-foreground sm:text-sm">{current.subtitle}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
              <span className="rounded-full border border-border/60 bg-card/60 px-2 py-0.5 tabular-nums sm:px-2.5 sm:py-1">
                {String(idx + 1).padStart(2, "0")} <span className="opacity-50">/</span> {String(panels.length).padStart(2, "0")}
              </span>
            </div>
          </div>
          <div key={current.key} className="min-h-0 flex-1 overflow-hidden animate-fade-in">
            {current.render()}
          </div>
        </div>
      </main>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Painéis                                                                    */
/* -------------------------------------------------------------------------- */

function buildPanels(p: PresentationProps): PanelDef[] {
  return [
    {
      key: "visao",
      title: `Olá${p.nome ? `, ${p.nome.split(" ")[0]}` : ""} 👋`,
      subtitle: "Indicadores em tempo real e avisos ativos.",
      icon: Sparkles,
      render: () => <VisaoGeralPanel p={p} />,
    },
    {
      key: "homologacao",
      title: "Homologação & qualidade",
      subtitle: "Em teste, pré-build, aprovadas, com ressalvas e reprovadas — por pessoa ou equipe.",
      icon: Gauge,
      render: () => (
        <div className="grid h-full min-h-0 grid-cols-12 grid-rows-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
          <div className="col-span-12 row-span-1 min-h-0 overflow-hidden">
            <HomologacaoPanel tarefas={p.tarefas} colaboradores={p.colaboradores} />
          </div>
          <div className="col-span-12 row-span-1 min-h-0 overflow-hidden md:col-span-4">
            <TaxaReprovacaoCard tarefas={p.tarefas} />
          </div>
          <div className="col-span-12 row-span-1 min-h-0 overflow-hidden md:col-span-8">
            <TempoPorEtapaCard tarefas={p.tarefas} />
          </div>
        </div>
      ),
    },
    {
      key: "produtividade",
      title: "Produtividade & carga",
      subtitle: "Velocidade, tempo de entrega, entregas por pessoa e trabalho em andamento.",
      icon: Activity,
      render: () => (
        <div className="grid h-full min-h-0 grid-cols-12 grid-rows-2 gap-3">
          <div className="col-span-12 min-h-0 overflow-hidden lg:col-span-5">
            <VelocitySemanalCard tarefas={p.tarefas} />
          </div>
          <div className="col-span-12 min-h-0 overflow-hidden sm:col-span-6 lg:col-span-3">
            <LeadTimeCard tarefas={p.tarefas} />
          </div>
          <div className="col-span-12 min-h-0 overflow-hidden sm:col-span-6 lg:col-span-4">
            <StatusTarefasPie data={p.pieTarefas} />
          </div>
          <div className="col-span-12 min-h-0 overflow-hidden lg:col-span-5">
            <ThroughputCard tarefas={p.tarefas} colaboradores={p.colaboradores} />
          </div>
          <div className="col-span-12 min-h-0 overflow-hidden sm:col-span-6 lg:col-span-4">
            <WipColaboradorCard tarefas={p.tarefas} colaboradores={p.colaboradores} />
          </div>
          <div className="col-span-12 min-h-0 overflow-hidden sm:col-span-6 lg:col-span-3">
            <AgingBacklogCard tarefas={p.tarefas} />
          </div>
        </div>
      ),
    },
    {
      key: "agenda",
      title: "Processos & agenda",
      subtitle: "Calendário de processos, compromissos da semana e disponibilidade da equipe.",
      icon: CalendarClock,
      render: () => (
        <div className="grid h-full min-h-0 grid-cols-12 grid-rows-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
          <div className="col-span-12 min-h-0 overflow-hidden xl:col-span-7">
            <ProcessosCalendarioListaCard />
          </div>
          <div className="col-span-12 min-h-0 overflow-hidden xl:col-span-5">
            <AtividadesSemanaPanel
              atividades={p.atividades}
              weekStart={p.weekStart}
              weekEnd={p.weekEnd}
              onPreview={p.onPreview}
              colaboradores={p.colaboradores}
              defaultColabId={p.meuColabId}
            />
          </div>
          <div className="col-span-12 min-h-0 overflow-hidden md:col-span-5">
            <HeatmapPrazosCard tarefas={p.tarefas} demandas={p.demandas} reunioes={p.reunioes} />
          </div>
          <div className="col-span-12 min-h-0 overflow-hidden md:col-span-4">
            <EquipeAtivaPanel
              totalColaboradores={p.totalColaboradores}
              feriasAtivas={p.feriasAtivas}
              proximasFerias={p.proximasFerias}
            />
          </div>
          <div className="col-span-12 min-h-0 overflow-hidden md:col-span-3">
            <HorariosPanel horarios={p.horarios} />
          </div>
        </div>
      ),
    },
    {
      key: "relatorios",
      title: "Relatórios & distribuição",
      subtitle: "Funil externo, SLA, solicitantes e como o trabalho está distribuído.",
      icon: Inbox,
      render: () => (
        <div className="grid h-full min-h-0 grid-cols-12 grid-rows-2 gap-3">
          <div className="col-span-12 min-h-0 overflow-hidden md:col-span-4">
            <FunilRelatoriosCard solicitacoes={p.solicitacoes} inativosIds={p.inativosIds} />
          </div>
          <div className="col-span-12 min-h-0 overflow-hidden md:col-span-4">
            <SlaUrgenciaCard solicitacoes={p.solicitacoes} />
          </div>
          <div className="col-span-12 min-h-0 overflow-hidden md:col-span-4">
            <TopSolicitantesCard solicitacoes={p.solicitacoes} />
          </div>
          <div className="col-span-12 min-h-0 overflow-hidden lg:col-span-7">
            <AtribuicoesChart data={p.atribuicoes} />
          </div>
          <div className="col-span-12 min-h-0 overflow-hidden lg:col-span-5">
            <CategoriaOrigemCard demandas={p.demandas} />
          </div>
        </div>
      ),
    },
  ];
}


/* -------------------------------------------------------------------------- */
/* Painel de Visão Geral (hero maior)                                          */
/* -------------------------------------------------------------------------- */

function VisaoGeralPanel({ p }: { p: PresentationProps }) {
  const totalTarefasAtivas = React.useMemo(
    () =>
      p.tarefas.filter(
        (t) => !["concluida", "producao", "reprovada", "cancelada"].includes(t.status),
      ).length,
    [p.tarefas],
  );
  const totalDemandas = p.demandas.length;
  const totalReunioes = p.reunioes.length;

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto sm:gap-4">
      {/* Pulse hero */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-5 lg:gap-4">
        {p.pulse.map((item, i) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className={cn(
                "group relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/30 p-3 shadow-sm backdrop-blur sm:p-4 lg:p-6",
                "transition-all hover:border-primary/40 hover:shadow-md",
              )}
            >
              <div
                className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-20 blur-2xl"
                style={{ background: `var(--chart-${(i % 5) + 1})` }}
                aria-hidden
              />
              <div className="relative flex items-center gap-2 sm:gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15 sm:h-11 sm:w-11">
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0 truncate text-xs font-medium text-muted-foreground sm:text-sm">{item.label}</div>
              </div>
              <div className="relative mt-2 flex items-baseline gap-2 sm:mt-4">
                <span className="text-2xl font-bold tabular-nums tracking-tight sm:text-3xl lg:text-4xl xl:text-5xl">
                  {item.value}
                </span>
              </div>
              {item.hint && (
                <div className="relative mt-1 truncate text-[10px] text-muted-foreground sm:text-xs">{item.hint}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Faixa lateral: totais gerais */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <MiniStat label="Tarefas ativas" value={totalTarefasAtivas} tone="primary" />
        <MiniStat label="Demandas totais" value={totalDemandas} tone="info" />
        <MiniStat label="Reuniões registradas" value={totalReunioes} tone="success" />
      </div>

      {/* Avisos */}
      <div className="min-h-0 flex-1">
        <AvisosBanner avisos={p.avisos} onPreview={p.onPreview} />
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "info" | "success";
}) {
  const toneMap = {
    primary: "text-primary border-primary/30 bg-primary/5",
    info: "text-info border-info/30 bg-info/5",
    success: "text-success border-success/30 bg-success/5",
  } as const;
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-2 rounded-xl border px-3 py-2 sm:px-4 sm:py-3",
        toneMap[tone],
      )}
    >
      <span className="min-w-0 truncate text-[10px] font-medium uppercase tracking-wider opacity-80 sm:text-xs">
        {label}
      </span>
      <span className="text-lg font-bold tabular-nums sm:text-2xl">{value}</span>
    </div>
  );
}
