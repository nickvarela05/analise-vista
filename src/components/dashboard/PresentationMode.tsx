import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X, Pause, Play, ChevronLeft, ChevronRight, Presentation } from "lucide-react";
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
} from "./analytics/AnalyticsCards";
import type { PreviewItem } from "@/components/PreviewDialog";

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
};

type PanelDef = {
  key: string;
  title: string;
  subtitle: string;
  render: () => React.ReactNode;
};

export function PresentationMode(props: PresentationProps) {
  const { open, onClose } = props;
  const qc = useQueryClient();
  const [idx, setIdx] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [tick, setTick] = React.useState(0); // força re-render da barra
  const startedAtRef = React.useRef<number>(Date.now());

  const panels = React.useMemo<PanelDef[]>(() => buildPanels(props), [props]);

  // Reset ao abrir
  React.useEffect(() => {
    if (open) {
      setIdx(0);
      setPaused(false);
      startedAtRef.current = Date.now();
    }
  }, [open]);

  // Invalida queries do dashboard ao trocar de painel
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

  // Timer de rotação
  React.useEffect(() => {
    if (!open || paused) return;
    const rotate = setInterval(() => {
      setIdx((i) => (i + 1) % panels.length);
      startedAtRef.current = Date.now();
      refetchAll();
    }, ROTATION_MS);
    const progress = setInterval(() => setTick((t) => t + 1), 250);
    return () => {
      clearInterval(rotate);
      clearInterval(progress);
    };
  }, [open, paused, panels.length, refetchAll]);

  // Atalhos
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
  const current = panels[idx];
  const hoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  const hora = new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background animate-fade-in">
      {/* Top bar */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border/60 bg-card/60 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Presentation className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">
              Modo apresentação
            </div>
            <div className="text-xs text-muted-foreground capitalize">
              {hoje} · {hora}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Dots */}
          <div className="flex items-center gap-1.5">
            {panels.map((p, i) => (
              <button
                key={p.key}
                onClick={() => go(i)}
                aria-label={`Ir para ${p.title}`}
                className={cn(
                  "h-2 rounded-full transition-all",
                  i === idx ? "w-8 bg-primary" : "w-2 bg-muted hover:bg-muted-foreground/40",
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => go(idx - 1)} aria-label="Anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? "Retomar" : "Pausar"}
            >
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => go(idx + 1)} aria-label="Próximo">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Sair (Esc)">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="h-1 w-full bg-muted/50">
        <div
          className="h-full bg-primary transition-[width] duration-200 ease-linear"
          style={{ width: `${paused ? pct : pct}%` }}
        />
      </div>

      {/* Content */}
      <main className="flex-1 overflow-hidden px-6 py-4">
        <div className="mx-auto flex h-full max-w-[1800px] flex-col">
          <div className="mb-3 flex items-baseline justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{current.title}</h2>
              <p className="text-sm text-muted-foreground">{current.subtitle}</p>
            </div>
            <div className="text-xs text-muted-foreground">
              Painel {idx + 1} de {panels.length}
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

function buildPanels(p: PresentationProps): PanelDef[] {
  return [
    {
      key: "pulse",
      title: `Olá${p.nome ? `, ${p.nome.split(" ")[0]}` : ""} 👋`,
      subtitle: "Indicadores em tempo real e avisos ativos.",
      render: () => (
        <div className="flex h-full flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {p.pulse.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="rounded-2xl border border-border/60 bg-card/80 p-6 shadow-sm backdrop-blur"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="text-sm font-medium text-muted-foreground">
                      {item.label}
                    </div>
                  </div>
                  <div className="mt-4 text-5xl font-bold tabular-nums tracking-tight">
                    {item.value}
                  </div>
                  {item.hint && (
                    <div className="mt-1 text-xs text-muted-foreground">{item.hint}</div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <AvisosBanner avisos={p.avisos} onPreview={p.onPreview} />
          </div>
        </div>
      ),
    },
    {
      key: "relatorios",
      title: "Relatórios (canal externo)",
      subtitle: "Funil de solicitações e principais solicitantes.",
      render: () => (
        <div className="grid h-full grid-cols-1 gap-4 overflow-auto lg:grid-cols-2">
          <FunilRelatoriosCard solicitacoes={p.solicitacoes} inativosIds={p.inativosIds} />
          <TopSolicitantesCard solicitacoes={p.solicitacoes} />
        </div>
      ),
    },
    {
      key: "agenda",
      title: "Agenda & pessoas",
      subtitle: "Compromissos da semana, férias e horários da equipe.",
      render: () => (
        <div className="grid h-full grid-cols-1 gap-4 overflow-auto xl:grid-cols-3">
          <div className="xl:col-span-2">
            <AtividadesSemanaPanel
              atividades={p.atividades}
              weekStart={p.weekStart}
              weekEnd={p.weekEnd}
              onPreview={p.onPreview}
              colaboradores={p.colaboradores}
              defaultColabId={p.meuColabId}
            />
          </div>
          <div className="flex flex-col gap-4">
            <EquipeAtivaPanel
              totalColaboradores={p.totalColaboradores}
              feriasAtivas={p.feriasAtivas}
              proximasFerias={p.proximasFerias}
            />
            <HorariosPanel horarios={p.horarios} />
          </div>
        </div>
      ),
    },
    {
      key: "distribuicao",
      title: "Distribuição da equipe",
      subtitle: "Quem está envolvido em quê agora.",
      render: () => (
        <div className="grid h-full grid-cols-1 gap-4 overflow-auto lg:grid-cols-2">
          <AtribuicoesChart data={p.atribuicoes} />
          <StatusTarefasPie data={p.pieTarefas} />
        </div>
      ),
    },
  ];
}
