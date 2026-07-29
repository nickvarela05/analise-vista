import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Hammer,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TarefaRow } from "@/lib/db-types";

type Metric = {
  key: string;
  label: string;
  hint: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  bar: string;
};

/**
 * Pipeline de qualidade: quantas tarefas estão em teste (HML),
 * aprovadas, aprovadas com ressalvas, reprovadas e em pré-build.
 */
export function QaPipelineCard({ tarefas }: { tarefas: TarefaRow[] }) {
  const metrics = React.useMemo<Metric[]>(() => {
    const count = (fn: (t: TarefaRow) => boolean) => tarefas.filter(fn).length;
    return [
      {
        key: "teste_hml",
        label: "Em teste (HML)",
        hint: "Sinalizadas em teste e em homologação",
        value: count((t) => !!t.em_teste && t.status === "homologacao"),
        icon: FlaskConical,
        tone: "text-info",
        bar: "bg-info",
      },
      {
        key: "aprovado",
        label: "Aprovadas",
        hint: "Liberadas sem pendências",
        value: count((t) => t.status === "aprovado"),
        icon: CheckCircle2,
        tone: "text-success",
        bar: "bg-success",
      },
      {
        key: "ressalvas",
        label: "Aprov. c/ ressalvas",
        hint: "Liberadas com pendências",
        value: count((t) => t.status === "aprovado_ressalvas"),
        icon: AlertTriangle,
        tone: "text-warning",
        bar: "bg-warning",
      },
      {
        key: "reprovado",
        label: "Reprovadas",
        hint: "Necessitam ajustes",
        value: count((t) => t.status === "reprovado"),
        icon: XCircle,
        tone: "text-destructive",
        bar: "bg-destructive",
      },
      {
        key: "pre_build",
        label: "Pré-build",
        hint: "Preparação para build",
        value: count((t) => t.status === "pre_build"),
        icon: Hammer,
        tone: "text-primary",
        bar: "bg-primary",
      },
    ];
  }, [tarefas]);

  const total = metrics.reduce((s, m) => s + m.value, 0);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border bg-card/70 p-3 backdrop-blur sm:p-4">
      <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/25">
            <FlaskConical className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold leading-tight">Pipeline de qualidade</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {total} tarefas nas etapas de validação
            </div>
          </div>
        </div>
        <Link
          to="/tarefas"
          className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20"
        >
          Abrir <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
        {metrics.map((m) => {
          const Icon = m.icon;
          const pct = total > 0 ? (m.value / total) * 100 : 0;
          return (
            <div
              key={m.key}
              className="flex min-w-0 flex-col justify-between rounded-xl border border-border/60 bg-background/50 p-2.5 sm:p-3"
            >
              <div className="flex items-center gap-1.5">
                <Icon className={cn("h-3.5 w-3.5 shrink-0", m.tone)} />
                <span className="truncate text-[11px] font-semibold text-muted-foreground">
                  {m.label}
                </span>
              </div>
              <div
                className={cn(
                  "mt-1 text-2xl font-bold leading-none tabular-nums sm:text-3xl xl:text-4xl",
                  m.tone,
                )}
              >
                {m.value}
              </div>
              <div className="mt-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", m.bar)} style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-1 truncate text-[10px] text-muted-foreground">{m.hint}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
