import * as React from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarRange, ArrowUpRight, CircleDot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type ProcessoLite = {
  id: string;
  nome: string;
  cor: string;
  previsto_inicio: string | null;
  previsto_fim: string | null;
  real_inicio: string | null;
  real_fim: string | null;
  status: "planejado" | "em_andamento" | "concluido" | "atrasado";
};

const COR_BG: Record<string, string> = {
  indigo: "bg-indigo-500",
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  cyan: "bg-cyan-500",
  primary: "bg-primary",
};

const STATUS_LABEL: Record<ProcessoLite["status"], string> = {
  planejado: "Planejado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  atrasado: "Atrasado",
};

const STATUS_TONE: Record<ProcessoLite["status"], string> = {
  planejado: "bg-muted text-muted-foreground",
  em_andamento: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  concluido: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  atrasado: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
};

function toDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

function fmtBR(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart <= bEnd && bStart <= aEnd;
}

export function ProcessosPreviewCard() {
  const { data: processos = [] } = useQuery({
    queryKey: ["dash-processos-preview"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processo_anual" as never)
        .select("id, nome, cor, previsto_inicio, previsto_fim, real_inicio, real_fim, status");
      if (error) throw error;
      return (data ?? []) as unknown as ProcessoLite[];
    },
  });

  const today = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const janelaIni = React.useMemo(() => {
    const d = new Date(today);
    d.setMonth(d.getMonth() - 2);
    d.setDate(1);
    return d;
  }, [today]);

  const janelaFim = React.useMemo(() => {
    const d = new Date(today);
    d.setMonth(d.getMonth() + 3);
    d.setDate(0);
    return d;
  }, [today]);

  const filtrados = React.useMemo(() => {
    return processos
      .map((p) => {
        const pIni = toDate(p.previsto_inicio);
        const pFim = toDate(p.previsto_fim) ?? pIni;
        const rIni = toDate(p.real_inicio);
        const rFim = toDate(p.real_fim) ?? rIni;
        const ini = pIni ?? rIni;
        const fim = pFim ?? rFim ?? ini;
        if (!ini || !fim) return null;
        if (!overlaps(ini, fim, janelaIni, janelaFim)) return null;
        return { p, ini, fim, pIni, pFim, rIni, rFim };
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => a.ini.getTime() - b.ini.getTime());
  }, [processos, janelaIni, janelaFim]);

  const totalDias = Math.max(
    1,
    Math.round((janelaFim.getTime() - janelaIni.getTime()) / 86_400_000) + 1,
  );

  const posPct = (d: Date) => {
    const clamped = d < janelaIni ? janelaIni : d > janelaFim ? janelaFim : d;
    const dias = Math.round((clamped.getTime() - janelaIni.getTime()) / 86_400_000);
    return (dias / totalDias) * 100;
  };

  const larguraPct = (a: Date, b: Date) =>
    Math.max(1.5, posPct(b) - posPct(a) + 100 / totalDias);

  const todayPct = posPct(today);

  // Marcações de mês para régua
  const meses: { pct: number; label: string }[] = [];
  const cursor = new Date(janelaIni);
  while (cursor <= janelaFim) {
    meses.push({
      pct: posPct(cursor),
      label: cursor.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
    });
    cursor.setMonth(cursor.getMonth() + 1);
    cursor.setDate(1);
  }

  return (
    <div
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-2xl border-2 border-primary/40 p-5",
        "bg-gradient-to-br from-primary/10 via-card to-card shadow-lg shadow-primary/10 backdrop-blur",
      )}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/20 opacity-40 blur-3xl"
        aria-hidden
      />

      <div className="relative mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
            <CalendarRange className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <div className="text-base font-bold leading-tight">Processos anuais</div>
              <Badge className="bg-primary/15 text-[10px] font-semibold uppercase text-primary hover:bg-primary/15">
                {filtrados.length} ativos
              </Badge>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {fmtBR(janelaIni)} — {fmtBR(janelaFim)} · janela de ±2 meses
            </div>
          </div>
        </div>
        <Link
          to="/processos"
          className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20"
        >
          Abrir <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {filtrados.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
          Nenhum processo nesta janela.
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {/* Régua de meses */}
          <div className="relative h-4 border-b border-border/60">
            {meses.map((m, i) => (
              <div
                key={i}
                className="absolute top-0 -translate-x-1/2 text-[10px] font-medium uppercase text-muted-foreground"
                style={{ left: `${m.pct}%` }}
              >
                {m.label}
              </div>
            ))}
            {/* Linha de hoje */}
            <div
              className="absolute -top-0.5 h-5 w-px bg-primary"
              style={{ left: `${todayPct}%` }}
              aria-hidden
            />
          </div>

          {/* Timeline */}
          <div className="min-h-0 flex-1 space-y-1.5 overflow-auto pr-1">
            {filtrados.map(({ p, pIni, pFim, rIni, rFim }) => {
              const corClass = COR_BG[p.cor] ?? "bg-primary";
              return (
                <div key={p.id} className="rounded-lg border border-border/50 bg-background/40 p-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", corClass)} />
                      <span className="truncate text-xs font-semibold">{p.nome}</span>
                    </div>
                    <Badge className={cn("shrink-0 text-[9px] uppercase", STATUS_TONE[p.status])}>
                      {STATUS_LABEL[p.status]}
                    </Badge>
                  </div>

                  <div className="relative h-5">
                    <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border/60" />
                    {/* Previsto */}
                    {pIni && pFim && (
                      <div
                        className={cn(
                          "absolute top-0.5 h-2 rounded-sm border border-dashed opacity-80",
                          corClass,
                          "bg-opacity-30",
                        )}
                        style={{
                          left: `${posPct(pIni)}%`,
                          width: `${larguraPct(pIni, pFim)}%`,
                        }}
                        title={`Previsto: ${fmtBR(pIni)} — ${fmtBR(pFim)}`}
                      />
                    )}
                    {/* Real */}
                    {rIni && rFim && (
                      <div
                        className={cn("absolute bottom-0 h-2 rounded-sm", corClass)}
                        style={{
                          left: `${posPct(rIni)}%`,
                          width: `${larguraPct(rIni, rFim)}%`,
                        }}
                        title={`Real: ${fmtBR(rIni)} — ${fmtBR(rFim)}`}
                      />
                    )}
                  </div>

                  <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                    {pIni && pFim && (
                      <span className="inline-flex items-center gap-1">
                        <CircleDot className="h-2.5 w-2.5" />
                        Previsto {fmtBR(pIni)}–{fmtBR(pFim)}
                      </span>
                    )}
                    {rIni && (
                      <span className="inline-flex items-center gap-1">
                        <span className={cn("h-2 w-2 rounded-sm", corClass)} />
                        Real {fmtBR(rIni)}
                        {rFim && rFim.getTime() !== rIni.getTime() ? `–${fmtBR(rFim)}` : ""}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
