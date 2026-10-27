import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { cn } from "@/lib/utils";
import {
  COR_BG,
  HOJE,
  fmtBR,
  parseISODate,
  type CorProcesso,
  type Processo,
} from "@/components/processos/processos-lib";

// ---------- Calendário anual estilo Google Agenda ----------

const COR_TEXT: Record<CorProcesso, string> = {
  indigo: "text-indigo-600 dark:text-indigo-400",
  sky: "text-sky-600 dark:text-sky-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  violet: "text-violet-600 dark:text-violet-400",
  amber: "text-amber-600 dark:text-amber-400",
  rose: "text-rose-600 dark:text-rose-400",
  cyan: "text-cyan-600 dark:text-cyan-400",
  primary: "text-primary",
};

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type DiaInfo = {
  processos: { p: Processo; tipo: "previsto" | "real" | "ambos" }[];
};

function buildIndiceAno(processos: Processo[], ano: number): Map<string, DiaInfo> {
  const map = new Map<string, DiaInfo>();
  const start = new Date(ano, 0, 1);
  const end = new Date(ano, 11, 31);
  for (const p of processos) {
    const prevIni = parseISODate(p.previsto_inicio);
    const prevFim = parseISODate(p.previsto_fim);
    const realIni = parseISODate(p.real_inicio);
    const realFim = parseISODate(p.real_fim);
    const stamp = (from: Date | null, to: Date | null, tipo: "previsto" | "real") => {
      if (!from || !to) return;
      const a = from < start ? new Date(start) : new Date(from);
      const b = to > end ? new Date(end) : new Date(to);
      for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
        const key = toISO(d);
        const info = map.get(key) ?? { processos: [] };
        const existing = info.processos.find((x) => x.p.id === p.id);
        if (existing) existing.tipo = "ambos";
        else info.processos.push({ p, tipo });
        map.set(key, info);
      }
    };
    stamp(prevIni, prevFim, "previsto");
    stamp(realIni, realFim, "real");
  }
  return map;
}

function MiniMes({
  ano,
  mes,
  indice,
  onEdit,
  hojeISO,
}: {
  ano: number;
  mes: number;
  indice: Map<string, DiaInfo>;
  onEdit?: (p: Processo) => void;
  hojeISO: string;
}) {
  const primeiro = new Date(ano, mes, 1);
  const offset = primeiro.getDay(); // domingo = 0
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const totalCells = Math.ceil((offset + diasNoMes) / 7) * 7;
  const cells: Array<{ date: Date; inMonth: boolean; iso: string }> = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - offset + 1;
    const date = new Date(ano, mes, dayNum);
    cells.push({
      date,
      inMonth: dayNum >= 1 && dayNum <= diasNoMes,
      iso: toISO(date),
    });
  }

  const nomeMes = new Date(ano, mes, 1).toLocaleDateString("pt-BR", { month: "long" });

  return (
    <div className="rounded-2xl border bg-card/60 p-5 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-base font-semibold capitalize text-foreground">{nomeMes}</h3>
        <span className="text-xs text-muted-foreground">{ano}</span>
      </div>
      <div className="grid grid-cols-7 gap-y-1.5 text-center">
        {WEEKDAYS.map((w, i) => (
          <div
            key={i}
            className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70"
          >
            {w}
          </div>
        ))}

        {cells.map(({ date, inMonth, iso }, i) => {
          const info = indice.get(iso);
          const isHoje = iso === hojeISO;
          const cores = info
            ? Array.from(new Set(info.processos.map((x) => x.p.cor))).slice(0, 3)
            : [];
          const hasProc = cores.length > 0;
          const cell = (
            <button
              type="button"
              disabled={!hasProc && !inMonth}
              className={cn(
                "relative mx-auto flex h-10 w-10 flex-col items-center justify-center rounded-lg text-sm leading-none transition-colors",
                !inMonth && "text-muted-foreground/30",
                inMonth && !isHoje && "text-foreground/80 hover:bg-muted",
                isHoje && "bg-primary font-semibold text-primary-foreground ring-2 ring-primary/40",
                hasProc && !isHoje && "font-semibold text-foreground",
              )}
            >
              <span>{date.getDate()}</span>
              {hasProc && (
                <span className="absolute bottom-1 flex gap-[3px]">
                  {cores.map((c, idx) => (
                    <span key={idx} className={cn("h-1.5 w-1.5 rounded-full", COR_BG[c])} />
                  ))}
                </span>
              )}
            </button>
          );

          if (!hasProc) return <div key={i}>{cell}</div>;

          return (
            <Popover key={i}>
              <PopoverTrigger asChild>{cell}</PopoverTrigger>
              <PopoverContent className="w-72 p-3" align="center">
                <div className="mb-2 text-xs font-semibold text-muted-foreground">
                  {date.toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                  })}
                </div>
                <div className="space-y-2">
                  {info!.processos.map(({ p, tipo }) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onEdit?.(p)}
                      disabled={!onEdit}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-md border p-2 text-left transition-colors",
                        onEdit && "hover:bg-muted",
                        !onEdit && "cursor-default",
                      )}
                    >
                      <span className={cn("mt-0.5 h-3 w-3 shrink-0 rounded-sm", COR_BG[p.cor])} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">{p.nome}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Badge
                            variant="outline"
                            className={cn("h-4 px-1.5 text-[9px]", COR_TEXT[p.cor])}
                          >
                            {tipo === "ambos"
                              ? "Previsto + Real"
                              : tipo === "real"
                                ? "Real"
                                : "Previsto"}
                          </Badge>
                          <span>
                            {fmtBR(p.previsto_inicio)} → {fmtBR(p.previsto_fim)}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    </div>
  );
}

export function CalendarioAnoGoogle({
  processos,
  ano,
  onEdit,
}: {
  processos: Processo[];
  ano: number;
  onEdit?: (p: Processo) => void;
}) {
  const indice = React.useMemo(() => buildIndiceAno(processos, ano), [processos, ano]);
  const hojeISO = toISO(HOJE());
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 12 }, (_, m) => (
        <MiniMes key={m} ano={ano} mes={m} indice={indice} onEdit={onEdit} hojeISO={hojeISO} />
      ))}
    </div>
  );
}

export function LegendaProcessos({ processos }: { processos: Processo[] }) {
  if (processos.length === 0) return null;
  return (
    <div className="rounded-xl border bg-card/60 p-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Processos
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {processos.map((p) => (
          <div key={p.id} className="flex items-center gap-1.5 text-xs">
            <span className={cn("h-2.5 w-2.5 rounded-sm", COR_BG[p.cor])} />
            <span className="text-foreground/90">{p.nome}</span>
            <span className="text-muted-foreground">
              · {fmtBR(p.previsto_inicio)} → {fmtBR(p.previsto_fim)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
