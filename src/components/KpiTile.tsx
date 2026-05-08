import * as React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Info, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type KpiTone = "primary" | "success" | "warning" | "destructive" | "info";

interface KpiTileProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint?: string;
  tone?: KpiTone;
  to?: string;
  onClick?: () => void;
  loading?: boolean;
  trend?: { value: number; label?: string };
  className?: string;
  ariaLabel?: string;
}

const iconClass: Record<KpiTone, string> = {
  primary: "",
  success: "kpi-icon-success",
  warning: "kpi-icon-warning",
  destructive: "kpi-icon-destructive",
  info: "kpi-icon-info",
};

function KpiTileImpl({
  icon: Icon,
  label,
  value,
  hint,
  tone = "primary",
  to,
  onClick,
  loading,
  trend,
  className,
  ariaLabel,
}: KpiTileProps) {
  const isInteractive = !!to || !!onClick;
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className={cn("kpi-icon", iconClass[tone])} aria-hidden>
          <Icon className="h-5 w-5" />
        </div>
        {isInteractive && (
          <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
        )}
      </div>
      <div className="space-y-1">
        <p className="kpi-label">{label}</p>
        <div className="flex items-baseline gap-2">
          {loading ? (
            <span className="kpi-value-skeleton" aria-hidden />
          ) : (
            <span className="kpi-value">{value}</span>
          )}
          {trend && !loading && (
            <span
              className={cn(
                "flex items-center gap-0.5 text-xs font-medium",
                trend.value > 0
                  ? "kpi-trend-up"
                  : trend.value < 0
                    ? "kpi-trend-down"
                    : "kpi-trend-flat",
              )}
            >
              {trend.value > 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : trend.value < 0 ? (
                <TrendingDown className="h-3 w-3" />
              ) : (
                <Minus className="h-3 w-3" />
              )}
              {Math.abs(trend.value)}%
            </span>
          )}
        </div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </>
  );

  const a11yLabel = ariaLabel ?? `${label}: ${value}${hint ? `. ${hint}` : ""}`;

  if (to) {
    return (
      <Link
        to={to}
        aria-label={a11yLabel}
        className={cn("kpi-tile kpi-tile-link group block", className)}
      >
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={a11yLabel}
        className={cn(
          "kpi-tile kpi-tile-link group block w-full text-left",
          className,
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={cn("kpi-tile", className)} aria-label={a11yLabel}>
      {content}
    </div>
  );
}

export const KpiTile = React.memo(KpiTileImpl);

export function Panel({
  title,
  hint,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title: React.ReactNode;
  hint?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={cn("panel", className)}>
      <div className="panel-header">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="panel-title truncate">{title}</h3>
          {hint && <InfoHint text={hint} />}
        </div>
        {actions}
      </div>
      <div className={cn("panel-body", bodyClassName)}>{children}</div>
    </div>
  );
}

export function InfoHint({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Mais informações sobre este indicador"
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
