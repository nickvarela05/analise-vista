import * as React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type KpiTone = "primary" | "success" | "warning" | "destructive" | "info";

interface KpiTileProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint?: string;
  tone?: KpiTone;
  to?: string;
  trend?: { value: number; label?: string };
  className?: string;
}

const iconClass: Record<KpiTone, string> = {
  primary: "",
  success: "kpi-icon-success",
  warning: "kpi-icon-warning",
  destructive: "kpi-icon-destructive",
  info: "kpi-icon-info",
};

export function KpiTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = "primary",
  to,
  trend,
  className,
}: KpiTileProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className={cn("kpi-icon", iconClass[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        {to && (
          <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
        )}
      </div>
      <div className="space-y-1">
        <p className="kpi-label">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="kpi-value">{value}</span>
          {trend && (
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

  if (to) {
    return (
      <Link
        to={to}
        className={cn("kpi-tile kpi-tile-link group block", className)}
      >
        {content}
      </Link>
    );
  }

  return <div className={cn("kpi-tile", className)}>{content}</div>;
}

export function Panel({
  title,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={cn("panel", className)}>
      <div className="panel-header">
        <h3 className="panel-title">{title}</h3>
        {actions}
      </div>
      <div className={cn("panel-body", bodyClassName)}>{children}</div>
    </div>
  );
}
