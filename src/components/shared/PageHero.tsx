import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatPill, type StatPillProps, type StatTone } from "./StatPill";

const toneBg: Record<
  StatTone,
  { wash: string; glow1: string; glow2: string; iconBg: string; iconText: string; ring: string }
> = {
  primary: {
    wash: "from-primary/10",
    glow1: "bg-primary/15",
    glow2: "bg-violet-500/10",
    iconBg: "bg-primary/15",
    iconText: "text-primary",
    ring: "ring-primary/20",
  },
  sky: {
    wash: "from-sky-500/10",
    glow1: "bg-sky-500/20",
    glow2: "bg-cyan-500/10",
    iconBg: "bg-sky-500/15",
    iconText: "text-sky-600 dark:text-sky-400",
    ring: "ring-sky-500/25",
  },
  emerald: {
    wash: "from-emerald-500/10",
    glow1: "bg-emerald-500/20",
    glow2: "bg-teal-500/10",
    iconBg: "bg-emerald-500/15",
    iconText: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/25",
  },
  violet: {
    wash: "from-violet-500/10",
    glow1: "bg-violet-500/20",
    glow2: "bg-fuchsia-500/10",
    iconBg: "bg-violet-500/15",
    iconText: "text-violet-600 dark:text-violet-400",
    ring: "ring-violet-500/25",
  },
  amber: {
    wash: "from-amber-500/10",
    glow1: "bg-amber-500/20",
    glow2: "bg-orange-500/10",
    iconBg: "bg-amber-500/15",
    iconText: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/25",
  },
  rose: {
    wash: "from-rose-500/10",
    glow1: "bg-rose-500/20",
    glow2: "bg-pink-500/10",
    iconBg: "bg-rose-500/15",
    iconText: "text-rose-600 dark:text-rose-400",
    ring: "ring-rose-500/25",
  },
  indigo: {
    wash: "from-indigo-500/10",
    glow1: "bg-indigo-500/20",
    glow2: "bg-violet-500/10",
    iconBg: "bg-indigo-500/15",
    iconText: "text-indigo-600 dark:text-indigo-400",
    ring: "ring-indigo-500/25",
  },
  cyan: {
    wash: "from-cyan-500/10",
    glow1: "bg-cyan-500/20",
    glow2: "bg-sky-500/10",
    iconBg: "bg-cyan-500/15",
    iconText: "text-cyan-600 dark:text-cyan-400",
    ring: "ring-cyan-500/25",
  },
  destructive: {
    wash: "from-destructive/10",
    glow1: "bg-destructive/20",
    glow2: "bg-rose-500/10",
    iconBg: "bg-destructive/15",
    iconText: "text-destructive",
    ring: "ring-destructive/25",
  },
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
  /** Repassado aos indicadores: mostra marcador de carregamento em vez de "0". */
  loading?: boolean;
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
  loading,
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
    // Visual "Grafite e menta" (23/10/2026): o cabeçalho deixa de ser um cartão com degradê e
    // brilhos; fica um título com presença sobre o fundo, e os indicadores logo abaixo.
    <div className="relative">
      <div className="relative px-1 pb-1 pt-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className={cn("rounded-xl p-2.5", t.iconBg, t.iconText)}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              {eyebrow && <p className="text-xs font-medium text-muted-foreground">{eyebrow}</p>}
              <h1 className="mt-0.5 text-2xl font-semibold tracking-[-0.025em] text-foreground sm:text-[28px] sm:leading-9">
                {title}
              </h1>
              {description && (
                <p className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-sm">
                  {description}
                </p>
              )}
              <p className="mt-0.5 text-[11px] text-muted-foreground/80 first-letter:uppercase">
                {hoje}
              </p>
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>

        {stats && stats.length > 0 && (
          // M12 da auditoria visual: no celular, os indicadores viram uma faixa que rola para o
          // lado, em vez de ocupar a tela inteira antes do conteúdo. Do tablet em diante, grade.
          <div
            data-cascata
            className={cn(
              "-mx-5 mt-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1 sm:mx-0 sm:mt-6 sm:grid sm:overflow-visible sm:px-0 sm:pb-0",
              statsGridClassName ?? "sm:grid-cols-3 lg:grid-cols-6",
            )}
          >
            {stats.map((s, i) => (
              <div key={i} className="min-w-[9.5rem] shrink-0 snap-start sm:min-w-0">
                <StatPill loading={loading} {...s} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
