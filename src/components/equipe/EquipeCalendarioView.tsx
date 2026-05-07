import * as React from "react";
import { ChevronLeft, ChevronRight, Download, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Colaborador } from "./lib/types";
import { DIAS, EVENTO_LABEL } from "./lib/types";
import { ymdOf } from "./lib/status";
import { EventoPopover } from "./EventoPopover";

const TIPO_BG: Record<string, string> = {
  folga: "bg-[var(--status-fora)]/40 text-foreground",
  falta: "bg-[var(--status-evento)]/60 text-white",
  atestado: "bg-[var(--status-evento)]/40 text-foreground",
  atraso: "bg-[var(--status-almoco)]/60 text-foreground",
  ferias_avulso: "bg-[var(--status-ferias)]/50 text-foreground",
};

export function EquipeCalendarioView({ colabs }: { colabs: Colaborador[] }) {
  const [cursor, setCursor] = React.useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const today = ymdOf(new Date());
  const monthStart = new Date(cursor);
  const firstDow = monthStart.getDay();
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();

  const cells: Array<{ date: Date | null; iso: string }> = [];
  for (let i = 0; i < firstDow; i++) cells.push({ date: null, iso: "" });
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(cursor.getFullYear(), cursor.getMonth(), day);
    cells.push({ date: d, iso: ymdOf(d) });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, iso: "" });

  const colabMap = new Map(colabs.map((c) => [c.id, c]));

  // Indexa eventos e férias por dia
  const eventosByDia = new Map<string, Array<{ colab: Colaborador; tipo: string; obs?: string }>>();
  for (const c of colabs) {
    for (const e of c.colaborador_evento ?? []) {
      const arr = eventosByDia.get(e.data) ?? [];
      arr.push({ colab: c, tipo: e.tipo, obs: e.observacao ?? undefined });
      eventosByDia.set(e.data, arr);
    }
    for (const f of c.colaborador_ferias ?? []) {
      // expandir período em dias do mês
      const ini = new Date(f.data_inicio + "T00:00:00");
      const fim = new Date(f.data_fim + "T00:00:00");
      for (let d = new Date(ini); d <= fim; d.setDate(d.getDate() + 1)) {
        if (d.getMonth() === cursor.getMonth() && d.getFullYear() === cursor.getFullYear()) {
          const iso = ymdOf(d);
          const arr = eventosByDia.get(iso) ?? [];
          arr.push({ colab: c, tipo: "ferias_avulso", obs: "Férias" });
          eventosByDia.set(iso, arr);
        }
      }
    }
  }

  const navigate = (delta: number) => {
    const d = new Date(cursor);
    d.setMonth(d.getMonth() + delta);
    setCursor(d);
  };

  const exportCsv = () => {
    const rows: string[] = ["data;colaborador;tipo;observacao"];
    for (const [iso, arr] of eventosByDia.entries()) {
      for (const x of arr) {
        rows.push(
          `${iso};${x.colab.nome};${EVENTO_LABEL[x.tipo as keyof typeof EVENTO_LABEL] ?? x.tipo};${(x.obs ?? "").replaceAll(";", ",")}`,
        );
      }
    }
    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `equipe-eventos-${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  void colabMap;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm font-medium capitalize">
          {cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const d = new Date();
              d.setDate(1);
              d.setHours(0, 0, 0, 0);
              setCursor(d);
            }}
          >
            Hoje
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate(1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="mr-1 h-3.5 w-3.5" /> CSV
          </Button>
          <EventoPopover
            colaboradores={colabs.map((c) => ({ id: c.id, nome: c.nome, cargo: c.cargo, foto_url: c.foto_url, local_trabalho: c.local_trabalho }))}
            defaultDate={today}
            trigger={
              <Button size="sm">
                <Plus className="mr-1 h-3.5 w-3.5" /> Registrar evento
              </Button>
            }
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="grid grid-cols-7 border-b bg-muted/30 text-[11px] font-medium uppercase tracking-wider">
          {DIAS.map((d) => (
            <div key={d} className="px-2 py-1.5 text-center">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell, i) => {
            if (!cell.date) {
              return <div key={i} className="min-h-[110px] border-b border-l bg-muted/10" />;
            }
            const items = eventosByDia.get(cell.iso) ?? [];
            const isToday = cell.iso === today;

            const dayCell = (
              <div
                className={cn(
                  "min-h-[110px] border-b border-l p-1.5 text-left transition-colors hover:bg-muted/40 cursor-pointer",
                  isToday && "bg-primary/5",
                )}
              >
                <div
                  className={cn(
                    "mb-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full text-[11px] font-medium",
                    isToday && "bg-primary text-primary-foreground",
                  )}
                >
                  {cell.date.getDate()}
                </div>
                <div className="space-y-0.5">
                  {items.slice(0, 4).map((it, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px]",
                        TIPO_BG[it.tipo] ?? "bg-muted",
                      )}
                      title={`${it.colab.nome} · ${EVENTO_LABEL[it.tipo as keyof typeof EVENTO_LABEL] ?? it.tipo}`}
                    >
                      <span className="truncate font-medium">
                        {it.colab.nome.split(" ")[0]}
                      </span>
                      <span className="truncate opacity-75">
                        {EVENTO_LABEL[it.tipo as keyof typeof EVENTO_LABEL] ?? it.tipo}
                      </span>
                    </div>
                  ))}
                  {items.length > 4 && (
                    <div className="text-[10px] text-muted-foreground">
                      +{items.length - 4} mais
                    </div>
                  )}
                </div>
              </div>
            );

            return (
              <EventoPopover
                key={i}
                colaboradores={colabs.map((c) => ({ id: c.id, nome: c.nome }))}
                defaultDate={cell.iso}
                trigger={dayCell}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
