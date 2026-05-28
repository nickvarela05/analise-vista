import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatPill, type StatPillProps, type StatTone } from "./StatPill";

const toneBg: Record<StatTone, { wash: string; glow1: string; glow2: string; iconBg: string; iconText: string; ring: string }> = {
  primary:     { wash: "from-primary/10",     glow1: "bg-primary/15",     glow2: "bg-violet-500/10",  iconBg: "bg-primary/15",     iconText: "text-primary",                       ring: "ring-primary/20" },
  sky:         { wash: "from-sky-500/10",     glow1: "bg-sky-500/20",     glow2: "bg-cyan-500/10",    iconBg: "bg-sky-500/15",     iconText: "text-sky-600 dark:text-sky-400",     ring: "ring-sky-500/25" },
  emerald:     { wash: "from-emerald-500/10", glow1: "bg-emerald-500/20", glow2: "bg-teal-500/10",    iconBg: "bg-emerald-500/15", iconText: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/25" },
  violet:      { wash: "from-violet-500/10",  glow1: "bg-violet-500/20",  glow2: "bg-fuchsia-500/10", iconBg: "bg-violet-500/15",  iconText: "text-violet-600 dark:text-violet-400", ring: "ring-violet-500/25" },
  amber:       { wash: "from-amber-500/10",   glow1: "bg-amber-500/20",   glow2: "bg-orange-500/10",  iconBg: "bg-amber-500/15",   iconText: "text-amber-600 dark:text-amber-400", ring: "ring-amber-500/25" },
  rose:        { wash: "from-rose-500/10",    glow1: "bg-rose-500/20",    glow2: "bg-pink-500/10",    iconBg: "bg-rose-500/15",    iconText: "text-rose-600 dark:text-rose-400",   ring: "ring-rose-500/25" },
  indigo:      { wash: "from-indigo-500/10",  glow1: "bg-indigo-500/20",  glow2: "bg-violet-500/10",  iconBg: "bg-indigo-500/15",  iconText: "text-indigo-600 dark:text-indigo-400", ring: "ring-indigo-500/25" },
  cyan:        { wash: "from-cyan-500/10",    glow1: "bg-cyan-500/20",    glow2: "bg-sky-500/10",     iconBg: "bg-cyan-500/15",    iconText: "text-cyan-600 dark:text-cyan-400",   ring: "ring-cyan-500/25" },
  destructive: { wash: "from-destructive/10", glow1: "bg-destructive/20", glow2: "bg-rose-500/10",    iconBg: "bg-destructive/15", iconText: "text-destructive",                   ring: "ring-destructive/25" },
};

export type PageHeroProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  tone?: StatTone;
  actions?: React.ReactNode;
  stats?: StatPillProps[];
  /** Tailwind grid-cols utility for stats area; defaults to responsive 2/3/6 */
  statsGridClassName?: string;
};

export function PageHero({
  eyebrow,
  title,
  description,
  icon: Icon,
  tone = "primary",
  actions,
  stats,
  statsGridClassName,
}: PageHeroProps) {
  const t = toneBg[tone];
  const hoje = React.useMemo(
    () =>
      new Date().toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    [],
  );

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border bg-gradient-to-br via-background to-background shadow-sm", t.wash)}>
      {/* glows */}
      <div className={cn("pointer-events-none absolute -top-24 -right-20 h-64 w-64 rounded-full blur-3xl", t.glow1)} />
      <div className={cn("pointer-events-none absolute -bottom-24 -left-20 h-64 w-64 rounded-full blur-3xl", t.glow2)} />

      <div className="relative p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className={cn("rounded-2xl p-3 ring-1", t.iconBg, t.iconText, t.ring)}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              {eyebrow && (
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {eyebrow}
                </p>
              )}
              <h1 className="mt-1 bg-gradient-to-r from-foreground via-foreground to-foreground/60 bg-clip-text text-xl font-semibold tracking-tight text-transparent sm:text-2xl">
                {title}
              </h1>
              {description && (
                <p className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-sm">{description}</p>
              )}
              <p className="mt-0.5 text-[11px] capitalize text-muted-foreground/80">{hoje}</p>
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>

        {stats && stats.length > 0 && (
          <div
            className={cn(
              "mt-6 grid gap-3",
              statsGridClassName ?? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
            )}
          >
            {stats.map((s, i) => (
              <StatPill key={i} {...s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
