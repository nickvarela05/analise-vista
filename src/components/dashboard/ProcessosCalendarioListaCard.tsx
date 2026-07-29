import * as React from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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

const STATUS_TONE: Record<ProcessoLite["status"], string> = {
  planejado: "bg-muted text-muted-foreground",
  em_andamento: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  concluido: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  atrasado: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
};

const STATUS_LABEL: Record<ProcessoLite["status"], string> = {
  planejado: "Planejado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  atrasado: "Atrasado",
};

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function toDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

function fmtBR(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
}

function MiniMesCompacto({
  ano,
  mes,
  indice,
  hojeISO,
}: {
  ano: number;
  mes: number;
  indice: Map<string, string[]>;
  hojeISO: string;
}) {
  const primeiro = new Date(ano, mes, 1);
  const offset = primeiro.getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const totalCells = Math.ceil((offset + diasNoMes) / 7) * 7;
  const cells: Array<{ n: number; inMonth: boolean; iso: string }> = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - offset + 1;
    const date = new Date(ano, mes, dayNum);
    cells.push({
      n: date.getDate(),
      inMonth: dayNum >= 1 && dayNum <= diasNoMes,
      iso: toISO(date),
    });
  }
  const nomeMes = primeiro.toLocaleDateString("pt-BR", { month: "long" });

  return (
    <div className="rounded-xl border bg-card/60 p-2">
      <div className="mb-1 text-center text-[11px] font-semibold capitalize text-foreground">
        {nomeMes}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="text-[8px] font-semibold uppercase text-muted-foreground/60">
            {w}
          </div>
        ))}
        {cells.map((c, i) => {
          const cores = indice.get(c.iso) ?? [];
          const isHoje = c.iso === hojeISO;
          return (
            <div
              key={i}
              className={cn(
                "relative mx-auto flex h-5 w-5 items-center justify-center rounded text-[10px] leading-none",
                !c.inMonth && "text-muted-foreground/25",
                c.inMonth && "text-foreground/80",
                cores.length > 0 && c.inMonth && "font-semibold",
                isHoje && "bg-primary font-bold text-primary-foreground",
              )}
            >
              <span>{c.n}</span>
              {c.inMonth && cores.length > 0 && !isHoje && (
                <span className="absolute -bottom-0.5 flex gap-[1px]">
                  {cores.slice(0, 3).map((cor, idx) => (
                    <span key={idx} className={cn("h-1 w-1 rounded-full", COR_BG[cor])} />
                  ))}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ProcessosCalendarioListaCard() {
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
  const hojeISO = toISO(today);

  // Janela: mês anterior, atual e próximo
  const meses = React.useMemo(
    () =>
      [-1, 0, 1].map((off) => {
        const d = new Date(today.getFullYear(), today.getMonth() + off, 1);
        return { ano: d.getFullYear(), mes: d.getMonth() };
      }),
    [today],
  );

  const janelaIni = new Date(meses[0].ano, meses[0].mes, 1);
  const janelaFim = new Date(meses[2].ano, meses[2].mes + 1, 0);

  const itens = React.useMemo(() => {
    return processos
      .map((p) => {
        const pIni = toDate(p.previsto_inicio);
        const pFim = toDate(p.previsto_fim) ?? pIni;
        const rIni = toDate(p.real_inicio);
        const rFim = toDate(p.real_fim) ?? rIni;
        const ini = pIni ?? rIni;
        const fim = pFim ?? rFim ?? ini;
        if (!ini || !fim) return null;
        if (!(ini <= janelaFim && janelaIni <= fim)) return null;
        return { p, ini, fim };
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => a.ini.getTime() - b.ini.getTime());
  }, [processos, janelaIni.getTime(), janelaFim.getTime()]);

  const indice = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const { p, ini, fim } of itens) {
      const cursor = new Date(Math.max(ini.getTime(), janelaIni.getTime()));
      const end = new Date(Math.min(fim.getTime(), janelaFim.getTime()));
      while (cursor <= end) {
        const iso = toISO(cursor);
        const arr = map.get(iso) ?? [];
        if (!arr.includes(p.cor)) arr.push(p.cor);
        map.set(iso, arr);
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return map;
  }, [itens, janelaIni.getTime(), janelaFim.getTime()]);

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border bg-card/70 p-3 backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/25">
            <CalendarDays className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-bold leading-tight">Calendário de processos</div>
            <div className="text-[10px] text-muted-foreground">
              {fmtBR(janelaIni)} — {fmtBR(janelaFim)} · {itens.length} processos
            </div>
          </div>
        </div>
        <Link
          to="/processos"
          className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/20"
        >
          Abrir <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-5">
        {/* Calendário */}
        <div className="grid min-h-0 grid-cols-3 gap-2 lg:col-span-3">
          {meses.map((m) => (
            <MiniMesCompacto
              key={`${m.ano}-${m.mes}`}
              ano={m.ano}
              mes={m.mes}
              indice={indice}
              hojeISO={hojeISO}
            />
          ))}
        </div>

        {/* Lista */}
        <div className="min-h-0 space-y-1.5 overflow-auto pr-1 lg:col-span-2">
          {itens.length === 0 ? (
            <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
              Nenhum processo nesta janela.
            </div>
          ) : (
            itens.map(({ p, ini, fim }) => (
              <div
                key={p.id}
                className="flex items-start gap-2 rounded-lg border bg-background/50 px-2 py-1.5"
              >
                <span className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-sm", COR_BG[p.cor])} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-semibold leading-tight">{p.nome}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {fmtBR(ini)} → {fmtBR(fim)}
                  </div>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                    STATUS_TONE[p.status],
                  )}
                >
                  {STATUS_LABEL[p.status]}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
