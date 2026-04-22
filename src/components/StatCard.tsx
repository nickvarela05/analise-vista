import * as React from "react";
import { cn } from "@/lib/utils";

type CircleTone = "neutral" | "primary" | "success" | "warning" | "destructive" | "info";

interface StatItem {
  value: number | string;
  label: string;
  tone?: CircleTone;
}

interface StatCardProps {
  title: string;
  items: StatItem[];
  className?: string;
  size?: "md" | "sm";
}

const toneClass: Record<CircleTone, string> = {
  neutral: "",
  primary: "stat-circle-primary",
  success: "stat-circle-success",
  warning: "stat-circle-warning",
  destructive: "stat-circle-destructive",
  info: "stat-circle-info",
};

export function StatCard({ title, items, className, size = "md" }: StatCardProps) {
  return (
    <div className={cn("stat-card p-5 pt-7", className)}>
      <span className="stat-card-title">{title}</span>
      <div className="flex flex-wrap items-end justify-around gap-4">
        {items.map((item, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div
              className={cn(
                "stat-circle",
                size === "sm" && "stat-circle-sm",
                toneClass[item.tone ?? "neutral"],
              )}
            >
              {item.value}
            </div>
            <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PanelCard({
  title,
  children,
  className,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className={cn("stat-card p-5 pt-6", className)}>
      <span className="stat-card-title">{title}</span>
      {actions && <div className="absolute right-4 top-3">{actions}</div>}
      <div className="mt-2">{children}</div>
    </div>
  );
}
