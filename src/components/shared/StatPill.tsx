import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatTone =
  | "primary" | "sky" | "emerald" | "violet" | "amber" | "rose"
  | "indigo" | "cyan" | "destructive";

const tones: Record<StatTone, { icon: string; glow: string; ring: string; bar: string }> = {
  primary:     { icon: "text-primary",                        glow: "from-primary/20 to-transparent",         ring: "ring-primary/20",     bar: "bg-primary" },
  sky:         { icon: "text-sky-600 dark:text-sky-400",      glow: "from-sky-500/20 to-transparent",         ring: "ring-sky-500/20",     bar: "bg-sky-500" },
  emerald:     { icon: "text-emerald-600 dark:text-emerald-400", glow: "from-emerald-500/20 to-transparent",  ring: "ring-emerald-500/20", bar: "bg-emerald-500" },
  violet:      { icon: "text-violet-600 dark:text-violet-400",glow: "from-violet-500/20 to-transparent",      ring: "ring-violet-500/20",  bar: "bg-violet-500" },
  amber:       { icon: "text-amber-600 dark:text-amber-400",  glow: "from-amber-500/25 to-transparent",       ring: "ring-amber-500/20",   bar: "bg-amber-500" },
  rose:        { icon: "text-rose-600 dark:text-rose-400",    glow: "from-rose-500/20 to-transparent",        ring: "ring-rose-500/20",    bar: "bg-rose-500" },
  indigo:      { icon: "text-indigo-600 dark:text-indigo-400",glow: "from-indigo-500/20 to-transparent",      ring: "ring-indigo-500/20",  bar: "bg-indigo-500" },
  cyan:        { icon: "text-cyan-600 dark:text-cyan-400",    glow: "from-cyan-500/20 to-transparent",        ring: "ring-cyan-500/20",    bar: "bg-cyan-500" },
  destructive: { icon: "text-destructive",                    glow: "from-destructive/20 to-transparent",     ring: "ring-destructive/25", bar: "bg-destructive" },
};

export type StatPillProps = {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint?: string;
  tone?: StatTone;
  pulse?: boolean;
};

export function StatPill({ icon: Icon, label, value, hint, tone = "primary", pulse }: StatPillProps) {
  const t = tones[tone];
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card/70 p-3.5 backdrop-blur transition-all",
        "hover:-translate-y-0.5 hover:shadow-md ring-1",
        t.ring,
      )}
    >
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80", t.glow)} />
      <div className={cn("pointer-events-none absolute left-0 top-0 h-full w-[3px]", t.bar, "opacity-70")} />
      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <Icon className={cn("h-4 w-4", t.icon)} />
          {pulse && (
            <span className={cn("inline-flex h-1.5 w-1.5 rounded-full animate-pulse", t.bar)} aria-hidden />
          )}
        </div>
        <div className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-foreground">{value}</div>
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </div>
        {hint && <div className="mt-0.5 text-[10.5px] text-muted-foreground/80">{hint}</div>}
      </div>
    </div>
  );
}
