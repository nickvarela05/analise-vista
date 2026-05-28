import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StatTone } from "./StatPill";

const toneBg: Record<StatTone, { wash: string; glow1: string; glow2: string; iconBg: string; iconText: string; ring: string }> = {
  primary:     { wash: "from-primary/10",     glow1: "bg-primary/15",     glow2: "bg-violet-500/10",  iconBg: "bg-primary/15",     iconText: "text-primary",                          ring: "ring-primary/20" },
  sky:         { wash: "from-sky-500/10",     glow1: "bg-sky-500/20",     glow2: "bg-cyan-500/10",    iconBg: "bg-sky-500/15",     iconText: "text-sky-600 dark:text-sky-400",        ring: "ring-sky-500/25" },
  emerald:     { wash: "from-emerald-500/10", glow1: "bg-emerald-500/20", glow2: "bg-teal-500/10",    iconBg: "bg-emerald-500/15", iconText: "text-emerald-600 dark:text-emerald-400",ring: "ring-emerald-500/25" },
  violet:      { wash: "from-violet-500/10",  glow1: "bg-violet-500/20",  glow2: "bg-fuchsia-500/10", iconBg: "bg-violet-500/15",  iconText: "text-violet-600 dark:text-violet-400",  ring: "ring-violet-500/25" },
  amber:       { wash: "from-amber-500/10",   glow1: "bg-amber-500/20",   glow2: "bg-orange-500/10",  iconBg: "bg-amber-500/15",   iconText: "text-amber-600 dark:text-amber-400",    ring: "ring-amber-500/25" },
  rose:        { wash: "from-rose-500/10",    glow1: "bg-rose-500/20",    glow2: "bg-pink-500/10",    iconBg: "bg-rose-500/15",    iconText: "text-rose-600 dark:text-rose-400",      ring: "ring-rose-500/25" },
  indigo:      { wash: "from-indigo-500/10",  glow1: "bg-indigo-500/20",  glow2: "bg-violet-500/10",  iconBg: "bg-indigo-500/15",  iconText: "text-indigo-600 dark:text-indigo-400",  ring: "ring-indigo-500/25" },
  cyan:        { wash: "from-cyan-500/10",    glow1: "bg-cyan-500/20",    glow2: "bg-sky-500/10",     iconBg: "bg-cyan-500/15",    iconText: "text-cyan-600 dark:text-cyan-400",      ring: "ring-cyan-500/25" },
  destructive: { wash: "from-destructive/10", glow1: "bg-destructive/20", glow2: "bg-rose-500/10",    iconBg: "bg-destructive/15", iconText: "text-destructive",                      ring: "ring-destructive/25" },
};

export interface DialogHeroProps {
  icon: LucideIcon;
  tone?: StatTone;
  eyebrow?: string;
  title: string;
  description?: string;
  chips?: React.ReactNode;
  /** Marca como gerado por IA (mostra um chip "IA" ao lado do título) */
  ai?: boolean;
  className?: string;
}

export function DialogHero({
  icon: Icon,
  tone = "primary",
  eyebrow,
  title,
  description,
  chips,
  ai,
  className,
}: DialogHeroProps) {
  const t = toneBg[tone];
  return (
    <div
      className={cn(
        "relative -mx-6 -mt-6 mb-2 overflow-hidden rounded-t-lg border-b bg-gradient-to-br via-background to-background px-6 py-5",
        t.wash,
        className,
      )}
    >
      <div className={cn("pointer-events-none absolute -top-16 -right-12 h-44 w-44 rounded-full blur-3xl", t.glow1)} />
      <div className={cn("pointer-events-none absolute -bottom-20 -left-12 h-44 w-44 rounded-full blur-3xl", t.glow2)} />
      <div className="relative flex items-start gap-3">
        <div className={cn("rounded-xl p-2.5 ring-1", t.iconBg, t.iconText, t.ring)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {eyebrow}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="bg-gradient-to-r from-foreground via-foreground to-foreground/60 bg-clip-text text-lg font-semibold tracking-tight text-transparent sm:text-xl">
              {title}
            </h2>
            {ai && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-600 ring-1 ring-violet-500/25 dark:text-violet-300">
                <Sparkles className="h-3 w-3" /> IA
              </span>
            )}
          </div>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{description}</p>
          )}
          {chips && <div className="mt-2 flex flex-wrap items-center gap-1.5">{chips}</div>}
        </div>
      </div>
    </div>
  );
}
