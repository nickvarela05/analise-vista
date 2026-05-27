import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "primary" | "sky" | "emerald" | "violet" | "amber" | "rose" | "indigo";

const toneMap: Record<Tone, { text: string; bg: string; ring: string; bar: string }> = {
  primary:  { text: "text-primary",                       bg: "bg-primary/10",                  ring: "ring-primary/20",          bar: "from-primary/60 via-primary/30 to-transparent" },
  sky:      { text: "text-sky-600 dark:text-sky-400",     bg: "bg-sky-500/10",                  ring: "ring-sky-500/20",          bar: "from-sky-500/60 via-sky-500/30 to-transparent" },
  emerald:  { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10",          ring: "ring-emerald-500/20",      bar: "from-emerald-500/60 via-emerald-500/30 to-transparent" },
  violet:   { text: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/10",             ring: "ring-violet-500/20",       bar: "from-violet-500/60 via-violet-500/30 to-transparent" },
  amber:    { text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10",                ring: "ring-amber-500/20",        bar: "from-amber-500/60 via-amber-500/30 to-transparent" },
  rose:     { text: "text-rose-600 dark:text-rose-400",   bg: "bg-rose-500/10",                 ring: "ring-rose-500/20",         bar: "from-rose-500/60 via-rose-500/30 to-transparent" },
  indigo:   { text: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/10",             ring: "ring-indigo-500/20",       bar: "from-indigo-500/60 via-indigo-500/30 to-transparent" },
};

export function SectionHeader({
  title,
  description,
  icon: Icon,
  tone = "primary",
  actions,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  tone?: Tone;
  actions?: React.ReactNode;
  className?: string;
}) {
  const t = toneMap[tone];
  return (
    <div className={cn("mt-2 space-y-2", className)}>
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1", t.bg, t.ring)}>
              <Icon className={cn("h-4.5 w-4.5", t.text)} />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      <div className={cn("h-px w-full bg-gradient-to-r", t.bar)} />
    </div>
  );
}
