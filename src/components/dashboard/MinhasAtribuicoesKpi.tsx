import * as React from "react";
import { ArrowUpRight, CheckSquare, Inbox, Calendar, ListChecks } from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
  slotClass,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
  loading?: boolean;
  slotClass: string;
}) {
  return (
    <div className={cn("kpi-metric-slot", slotClass)}>
      <div className="flex items-center gap-1.5">
        <span className="kpi-metric-icon" aria-hidden>
          <Icon className="h-3.5 w-3.5" />
        </span>
        {loading ? (
          <span className="kpi-value-skeleton h-6 w-6" aria-hidden />
        ) : (
          <span className="kpi-metric-value">{value}</span>
        )}
      </div>
      <span className="kpi-metric-label">{label}</span>
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
      <div className="space-y-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="kpi-label">Minhas atribuições</p>
          <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
            {loading ? "—" : `${total} total`}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-border/70 bg-muted/30 p-1">
          <MetricSlot
            icon={CheckSquare}
            value={tarefas}
            label="Tarefas"
            loading={loading}
            slotClass="kpi-slot-primary"
          />
          <MetricSlot
            icon={Inbox}
            value={demandas}
            label="Demandas"
            loading={loading}
            slotClass="kpi-slot-warning"
          />
          <MetricSlot
            icon={Calendar}
            value={reunioes}
            label="Reuniões"
            loading={loading}
            slotClass="kpi-slot-info"
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
        className="kpi-tile kpi-tile-link kpi-tone-info group block w-full text-left"
      >
        {inner}
      </button>
    );
  }
  return (
    <div className="kpi-tile kpi-tone-info" aria-label={a11y}>
      {inner}
    </div>
  );
}

export const MinhasAtribuicoesKpi = React.memo(MinhasAtribuicoesKpiImpl);
