import * as React from "react";
import { ArrowUpRight, CheckSquare, Inbox, Calendar, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  tarefas: number;
  demandas: number;
  reunioes: number;
  total: number;
  loading?: boolean;
  onClick?: () => void;
}

function MetricSlot({
  icon: Icon,
  value,
  label,
  loading,
  toneClass,
}: {
  icon: typeof CheckSquare;
  value: number;
  label: string;
  loading?: boolean;
  toneClass: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 px-1 py-1">
      <Icon className={cn("h-3.5 w-3.5", toneClass)} aria-hidden />
      {loading ? (
        <span className="kpi-value-skeleton h-6 w-8" aria-hidden />
      ) : (
        <span className="text-2xl font-semibold leading-none tabular-nums text-foreground">
          {value}
        </span>
      )}
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function MinhasAtribuicoesKpiImpl({
  tarefas,
  demandas,
  reunioes,
  total,
  loading,
  onClick,
}: Props) {
  const isInteractive = !!onClick;
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="kpi-icon kpi-icon-info" aria-hidden>
          <ListChecks className="h-5 w-5" />
        </div>
        {isInteractive && (
          <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
        )}
      </div>
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="kpi-label">Minhas atribuições</p>
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {loading ? "—" : `${total} no total`}
          </span>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border/60 rounded-md border border-border/60 bg-muted/30">
          <MetricSlot
            icon={CheckSquare}
            value={tarefas}
            label="Tarefas"
            loading={loading}
            toneClass="text-primary"
          />
          <MetricSlot
            icon={Inbox}
            value={demandas}
            label="Demandas"
            loading={loading}
            toneClass="text-warning"
          />
          <MetricSlot
            icon={Calendar}
            value={reunioes}
            label="Reuniões"
            loading={loading}
            toneClass="text-info"
          />
        </div>
      </div>
    </>
  );

  const a11y = `Minhas atribuições: ${total} itens (${tarefas} tarefas, ${demandas} demandas, ${reunioes} reuniões)`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={a11y}
        className="kpi-tile kpi-tile-link group block w-full text-left"
      >
        {inner}
      </button>
    );
  }
  return (
    <div className="kpi-tile" aria-label={a11y}>
      {inner}
    </div>
  );
}

export const MinhasAtribuicoesKpi = React.memo(MinhasAtribuicoesKpiImpl);
