import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DialogSectionProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  variant?: "default" | "tinted" | "ai";
  className?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function DialogSection({
  title,
  description,
  icon: Icon,
  variant = "default",
  className,
  children,
  actions,
}: DialogSectionProps) {
  return (
    <section
      className={cn(
        "rounded-xl border p-4",
        variant === "default" && "bg-card/40",
        variant === "tinted" && "bg-muted/40",
        variant === "ai" &&
          "border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-fuchsia-500/5 to-transparent",
        className,
      )}
    >
      {(title || actions) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {title}
              </h3>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground/80">{description}</p>
            )}
          </div>
          {actions}
        </header>
      )}
      <div className="space-y-3">{children}</div>
    </section>
  );
}
