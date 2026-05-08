import * as React from "react";
import { cn } from "@/lib/utils";

export function SectionHeader({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("mt-2 flex items-end justify-between gap-3 border-b border-border/60 pb-2", className)}>
      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground/80">{description}</p>
        )}
      </div>
    </div>
  );
}
