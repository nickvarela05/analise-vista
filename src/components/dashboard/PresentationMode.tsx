import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  X,
  Pause,
  Play,
  ChevronLeft,
  ChevronRight,
  Presentation,
  Gauge,
  Users,
  CalendarClock,
  Sparkles,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { QaPipelineCard } from "./QaPipelineCard";
import { ProcessosCalendarioListaCard } from "./ProcessosCalendarioListaCard";
import { isAtribuidoA, isTarefaAtiva } from "@/lib/domain/atividades";
import type { PreviewItem } from "@/components/PreviewDialog";
import type { TarefaRow, DemandaRow, ReuniaoRow } from "@/lib/db-types";

const ROTATION_MS = 75_000;
const ESCOPO_EQUIPE = "__equipe__";

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

type Scoped = PresentationProps & {
  colabId: string | null;
  colabNome: string | null;
};

type PanelDef = {
  key: string;
  title: string;
  shortTitle?: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  render: () => React.ReactNode;
};

export function PresentationMode(props: PresentationProps) {
  const { open, onClose } = props;
  const qc = useQueryClient();
  const [idx, setIdx] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [, setTick] = React.useState(0);
  const [now, setNow] = React.useState(() => new Date());
  const [escopo, setEscopo] = React.useState<string>(ESCOPO_EQUIPE);
  const startedAtRef = React.useRef<number>(Date.now());

  const colabId = escopo === ESCOPO_EQUIPE ? null : escopo;
  const colabNome = colabId
    ? (props.colaboradores.find((c) => c.id === colabId)?.nome ?? null)
    : null;

  /** Dados já recortados pelo filtro global (pessoa ou equipe toda). */
  const scoped = React.useMemo<Scoped>(() => {
    if (!colabId) return { ...props, colabId: null, colabNome: null };
    const keep = <T extends { equipe_toda?: boolean | null; responsaveis_ids?: string[] | null; responsavel_id?: string | null }>(
      rows: T[],
    ) => rows.filter((r) => isAtribuidoA(r, colabId));
    return {
      ...props,
      colabId,
      colabNome,
      tarefas: keep(props.tarefas),
      demandas: keep(props.demandas),
      reunioes: keep(props.reunioes),
      atividades: props.atividades.filter(
        (a) => a._equipeToda || a._envolvidosIds.includes(colabId),
      ),
      atribuicoes: props.atribuicoes.filter((a: any) => a.nome === colabNome),
      colaboradores: props.colaboradores.filter((c) => c.id === colabId),
    };
  }, [props, colabId, colabNome]);

  const panels = React.useMemo<PanelDef[]>(() => buildPanels(scoped), [scoped]);

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
  const current = panels[Math.min(idx, panels.length - 1)];
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
      <header className="relative flex shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-card/70 px-3 py-2 backdrop-blur-md sm:gap-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/20 sm:h-9 sm:w-9">
            <Presentation className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold leading-tight sm:text-sm">
              Modo apresentação
            </div>
            <div className="hidden truncate text-[10px] capitalize text-muted-foreground tabular-nums lg:block">
              {hoje} · {hora}
            </div>
          </div>
        </div>

        {/* Segmented tabs */}
        <nav className="hidden items-center gap-1 rounded-full border border-border/60 bg-muted/40 p-1 lg:flex">
          {panels.map((p, i) => {
            const Icon = p.icon;
            const active = i === idx;
            return (
              <button
                key={p.key}
                onClick={() => go(i)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-all xl:text-xs",
                  active
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden xl:inline">{p.shortTitle ?? p.title}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {/* Filtro global */}
          <div className="flex items-center gap-1.5">
            <Filter className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
            <Select value={escopo} onValueChange={setEscopo}>
              <SelectTrigger className="h-8 w-[128px] text-xs sm:w-[180px]">
                <SelectValue placeholder="Escopo" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={ESCOPO_EQUIPE}>Equipe toda</SelectItem>
                {props.meuColabId && (
                  <SelectItem value={props.meuColabId}>Somente eu</SelectItem>
                )}
                {props.colaboradores.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dots (fallback) */}
          <div className="flex items-center gap-1.5 lg:hidden">
            {panels.map((p, i) => (
              <button
                key={p.key}
                onClick={() => go(i)}
                aria-label={`Ir para ${p.title}`}
                className={cn(
                  "h-2 rounded-full transition-all",
                  i === idx ? "w-6 bg-primary" : "w-2 bg-muted hover:bg-muted-foreground/40",
                )}
              />
            ))}
          </div>

          <div
            className={cn(
              "hidden h-8 min-w-14 items-center justify-center rounded-full border px-2 text-[11px] font-semibold tabular-nums md:flex",
              paused
                ? "border-warning/40 bg-warning/10 text-warning"
                : "border-primary/30 bg-primary/10 text-primary",
            )}
          >
            {paused ? "PAUSA" : `${secondsLeft}s`}
          </div>

          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => go(idx - 1)} aria-label="Anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? "Retomar" : "Pausar"}
            >
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => go(idx + 1)} aria-label="Próximo">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Sair (Esc)">
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
      <main className="min-h-0 flex-1 overflow-hidden px-3 py-3 sm:px-5 sm:py-4">
        <div className="mx-auto flex h-full max-w-[1800px] flex-col">
          <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:mb-3">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20 sm:h-10 sm:w-10">
                <CurrentIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold leading-tight tracking-tight sm:text-xl xl:text-2xl">
                  {current.title}
                </h2>
                <p className="truncate text-[11px] text-muted-foreground sm:text-sm">
                  {current.subtitle}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
              <span
                className={cn(
                  "hidden max-w-[220px] truncate rounded-full border px-2.5 py-1 text-[11px] font-semibold sm:inline",
                  colabId
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border/60 bg-card/60",
                )}
              >
                {colabId ? colabNome : "Equipe toda"}
              </span>
              <span className="rounded-full border border-border/60 bg-card/60 px-2.5 py-1 tabular-nums">
                {String(idx + 1).padStart(2, "0")} <span className="opacity-50">/</span>{" "}
                {String(panels.length).padStart(2, "0")}
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
/* Painéis (4, sem redundância)                                               */
/* -------------------------------------------------------------------------- */

function buildPanels(p: Scoped): PanelDef[] {
  return [
    {
      key: "pulso",
      shortTitle: "Pulso",
      title: p.colabNome
        ? `Pulso · ${p.colabNome.split(" ")[0]}`
        : `Pulso da operação${p.nome ? ` · olá, ${p.nome.split(" ")[0]}` : ""}`,
      subtitle: "Indicadores do dia, pipeline de qualidade e avisos ativos.",
      icon: Sparkles,
      render: () => <PulsoPanel p={p} />,
    },
    {
      key: "entrega",
      shortTitle: "Entrega",
      title: "Entrega & qualidade",
      subtitle: "Velocidade, lead time, reprovações, envelhecimento e carga atual.",
      icon: Gauge,
      render: () => (
        <div className="grid h-full min-h-0 auto-rows-fr grid-cols-1 gap-3 overflow-auto md:grid-cols-2 xl:grid-cols-4">
          <div className="min-h-0 xl:col-span-2">
            <VelocitySemanalCard tarefas={p.tarefas} />
          </div>
          <div className="min-h-0">
            <LeadTimeCard tarefas={p.tarefas} />
          </div>
          <div className="min-h-0">
            <TaxaReprovacaoCard tarefas={p.tarefas} />
          </div>
          <div className="min-h-0 xl:col-span-2">
            <TempoPorEtapaCard tarefas={p.tarefas} />
          </div>
          <div className="min-h-0">
            <AgingBacklogCard tarefas={p.tarefas} />
          </div>
          <div className="min-h-0">
            <ThroughputCard tarefas={p.tarefas} colaboradores={p.colaboradores} />
          </div>
        </div>
      ),
    },
    {
      key: "agenda",
      shortTitle: "Agenda",
      title: "Agenda, processos & pessoas",
      subtitle: "Semana em curso, calendário anual de processos, férias e horários.",
      icon: CalendarClock,
      render: () => (
        <div className="grid h-full min-h-0 grid-cols-1 grid-rows-[minmax(0,0.7fr)_minmax(0,1.3fr)] gap-3 xl:grid-cols-12">
          <div className="min-h-0 overflow-hidden xl:col-span-8">
            <AtividadesSemanaPanel
              atividades={p.atividades}
              weekStart={p.weekStart}
              weekEnd={p.weekEnd}
              onPreview={p.onPreview}
              colaboradores={p.colaboradores}
              defaultColabId={p.colabId ?? p.meuColabId}
            />
          </div>

          {/* Horários ocupa a coluna lateral inteira */}
          <div className="min-h-0 overflow-hidden xl:col-span-4 xl:row-span-2">
            <HorariosPanel horarios={p.horarios} />
          </div>

          {/* Faixa horizontal: processos (calendários + lista) · calor · equipe */}
          <div className="grid min-h-0 grid-cols-1 gap-3 xl:col-span-8 xl:grid-cols-12">
            <div className="min-h-0 overflow-hidden xl:col-span-7">
              <ProcessosCalendarioListaCard />
            </div>
            <div className="grid min-h-0 grid-rows-2 gap-3 xl:col-span-5">
              <div className="min-h-0 overflow-hidden">
                <HeatmapPrazosCard tarefas={p.tarefas} demandas={p.demandas} reunioes={p.reunioes} />
              </div>
              <div className="min-h-0 overflow-hidden">
                <EquipeAtivaPanel
                  totalColaboradores={p.totalColaboradores}
                  feriasAtivas={p.feriasAtivas}
                  proximasFerias={p.proximasFerias}
                />
              </div>
            </div>
          </div>
        </div>


      ),
    },
    {
      key: "fluxo",
      shortTitle: "Fluxo",
      title: "Fluxo externo & distribuição",
      subtitle: "Relatórios solicitados, SLA, origem das demandas e carga por pessoa.",
      icon: Users,
      render: () => (
        <div className="grid h-full min-h-0 auto-rows-fr grid-cols-1 gap-3 overflow-auto md:grid-cols-2 xl:grid-cols-3">
          <div className="min-h-0">
            <FunilRelatoriosCard solicitacoes={p.solicitacoes} inativosIds={p.inativosIds} />
          </div>
          <div className="min-h-0">
            <SlaUrgenciaCard solicitacoes={p.solicitacoes} />
          </div>
          <div className="min-h-0">
            <TopSolicitantesCard solicitacoes={p.solicitacoes} />
          </div>
          <div className="min-h-0 xl:col-span-2">
            <WipColaboradorCard tarefas={p.tarefas} colaboradores={p.colaboradores} />
          </div>
          <div className="min-h-0">
            <CategoriaOrigemCard demandas={p.demandas} />
          </div>
        </div>
      ),
    },
  ];
}

/* -------------------------------------------------------------------------- */
/* Painel 1 — Pulso                                                           */
/* -------------------------------------------------------------------------- */

function PulsoPanel({ p }: { p: Scoped }) {
  const stats = React.useMemo(() => {
    const ativas = p.tarefas.filter(isTarefaAtiva).length;
    const hml = p.tarefas.filter((t) => t.status === "homologacao").length;
    const emTeste = p.tarefas.filter((t) => !!t.em_teste).length;
    const avisosCriticos = p.avisos.filter((a: any) => a.tipo === "critico").length;
    return [
      { label: "Tarefas ativas", value: ativas, tone: "primary" as const, hint: "Fora de produção/encerradas" },
      { label: "Em homologação", value: hml, tone: "info" as const, hint: "Aguardando validação" },
      { label: "Sinalizadas em teste", value: emTeste, tone: "warning" as const, hint: "Flag de teste ativa" },
      { label: "Demandas", value: p.demandas.length, tone: "info" as const, hint: "Total no escopo" },
      { label: "Reuniões", value: p.reunioes.length, tone: "success" as const, hint: "Registradas" },
      { label: "Avisos críticos", value: avisosCriticos, tone: "danger" as const, hint: `${p.avisos.length} ativos` },
    ];
  }, [p.tarefas, p.demandas, p.reunioes, p.avisos]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-6">
        {stats.map((s) => (
          <BigStat key={s.label} {...s} />
        ))}
      </div>

      <div className="min-h-0 flex-[1.15]">
        <QaPipelineCard tarefas={p.tarefas} />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <AvisosBanner avisos={p.avisos} onPreview={p.onPreview} />
      </div>
    </div>
  );
}

const TONES = {
  primary: "text-primary border-primary/25 from-primary/10",
  info: "text-info border-info/25 from-info/10",
  success: "text-success border-success/25 from-success/10",
  warning: "text-warning border-warning/25 from-warning/10",
  danger: "text-destructive border-destructive/25 from-destructive/10",
} as const;

function BigStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  tone: keyof typeof TONES;
}) {
  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-2xl border bg-gradient-to-br via-card to-card p-2.5 backdrop-blur sm:p-3",
        TONES[tone],
      )}
    >
      <div className="truncate text-[11px] font-semibold text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-0.5 text-2xl font-bold leading-none tabular-nums sm:text-3xl xl:text-4xl",
          TONES[tone].split(" ")[0],
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1 truncate text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
