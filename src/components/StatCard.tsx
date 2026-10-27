import * as React from "react";
import { cn } from "@/lib/utils";

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
