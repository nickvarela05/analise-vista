import * as React from "react";
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  Sparkles, ArrowUpRight, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

type PulseTone = "sky" | "emerald" | "violet" | "amber" | "rose" | "indigo" | "cyan";

const pulseTone: Record<PulseTone, { text: string; ring: string }> = {
  sky:     { text: "text-sky-600 dark:text-sky-400",         ring: "from-sky-500/25 to-transparent" },
  emerald: { text: "text-emerald-600 dark:text-emerald-400", ring: "from-emerald-500/25 to-transparent" },
  violet:  { text: "text-violet-600 dark:text-violet-400",   ring: "from-violet-500/25 to-transparent" },
  amber:   { text: "text-amber-600 dark:text-amber-400",     ring: "from-amber-500/25 to-transparent" },
  rose:    { text: "text-rose-600 dark:text-rose-400",       ring: "from-rose-500/25 to-transparent" },
  indigo:  { text: "text-indigo-600 dark:text-indigo-400",   ring: "from-indigo-500/25 to-transparent" },
  cyan:    { text: "text-cyan-600 dark:text-cyan-400",       ring: "from-cyan-500/25 to-transparent" },
};

export type PulseItem = {
  icon: LucideIcon;
  label: string;
  value: number | string;
  tone: PulseTone;
  hint?: string;
  to?: string;
  trend?: number; // -100..100 (percent vs anterior)
};

function saudacao(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function DashboardHero({
  nome,
  subtitle,
  pulse,
  actions,
}: {
  nome?: string | null;
  subtitle?: string;
  pulse: PulseItem[];
  actions?: React.ReactNode;
}) {
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
  const primeiroNome = nome?.split(" ")[0];

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background shadow-sm">
      {/* glow */}
      <div className="pointer-events-none absolute -top-24 -right-20 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />

      <div className="relative p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="rounded-2xl bg-primary/15 p-3 text-primary ring-1 ring-primary/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Painel gerencial
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {saudacao()}{primeiroNome ? `, ${primeiroNome}` : ""}.
              </h1>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                {subtitle ?? "Sua equipe de Análise de Requisitos em tempo real."}
              </p>
              <p className="mt-0.5 text-[11px] capitalize text-muted-foreground/80">{hoje}</p>
            </div>
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>

        {pulse.length > 0 && (
          <div className="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {pulse.map((p, i) => (
              <PulseTile key={i} item={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PulseTile({ item }: { item: PulseItem }) {
  const Icon = item.icon;
  const t = pulseTone[item.tone];
  const inner = (
    <div className="group relative overflow-hidden rounded-xl border bg-card/70 p-3.5 backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-70", t.ring)} />
      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <Icon className={cn("h-4 w-4", t.text)} />
          {item.to && (
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
          )}
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-2xl font-bold tabular-nums text-foreground">{item.value}</span>
          {typeof item.trend === "number" && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-[10px] font-medium",
                item.trend > 0 ? "text-emerald-600 dark:text-emerald-400"
                  : item.trend < 0 ? "text-rose-600 dark:text-rose-400"
                  : "text-muted-foreground",
              )}
            >
              {item.trend > 0 ? <TrendingUp className="h-3 w-3" /> :
                item.trend < 0 ? <TrendingDown className="h-3 w-3" /> :
                <Minus className="h-3 w-3" />}
              {Math.abs(item.trend)}%
            </span>
          )}
        </div>
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {item.label}
        </div>
        {item.hint && (
          <div className="mt-1 text-[10.5px] text-muted-foreground/80">{item.hint}</div>
        )}
      </div>
    </div>
  );
  return item.to ? <Link to={item.to} className="block">{inner}</Link> : inner;
}
