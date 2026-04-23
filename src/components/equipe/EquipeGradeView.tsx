import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Colaborador } from "./lib/types";
import { DIAS, EVENTO_LABEL } from "./lib/types";
import { eventOn, isOnVacation, ymdOf } from "./lib/status";

const DAY_START_MIN = 6 * 60; // 06:00
const DAY_END_MIN = 22 * 60; // 22:00
const DAY_TOTAL = DAY_END_MIN - DAY_START_MIN;

function toMin(t: string | null | undefined): number | null {
  if (!t) return null;
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
}

function pct(min: number) {
  return ((min - DAY_START_MIN) / DAY_TOTAL) * 100;
}

export function EquipeGradeView({ colabs }: { colabs: Colaborador[] }) {
  const [weekStart, setWeekStart] = React.useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const navigate = (delta: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(d);
  };

  const today = ymdOf(new Date());

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">
          {days[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} –{" "}
          {days[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() - d.getDay());
              d.setHours(0, 0, 0, 0);
              setWeekStart(d);
            }}
          >
            Hoje
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate(1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Header com dias */}
          <div className="grid grid-cols-[200px_repeat(7,1fr)] border-b bg-muted/30 text-xs font-medium">
            <div className="px-3 py-2">Colaborador</div>
            {days.map((d, i) => {
              const iso = ymdOf(d);
              return (
                <div
                  key={i}
                  className={cn(
                    "border-l px-2 py-2 text-center",
                    iso === today && "bg-primary/10 text-primary",
                  )}
                >
                  <div>{DIAS[i]}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {d.getDate().toString().padStart(2, "0")}/
                    {(d.getMonth() + 1).toString().padStart(2, "0")}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Linhas por colaborador */}
          {colabs.map((c) => (
            <div
              key={c.id}
              className="grid grid-cols-[200px_repeat(7,1fr)] border-b last:border-b-0"
            >
              <div className="flex items-center gap-2 border-r px-3 py-2">
                <Avatar className="h-7 w-7">
                  {c.foto_url && <AvatarImage src={c.foto_url} />}
                  <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                    {c.nome
                      .split(" ")
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium">{c.nome}</div>
                  {c.cargo && (
                    <div className="truncate text-[10px] text-muted-foreground">
                      {c.cargo}
                    </div>
                  )}
                </div>
              </div>

              {days.map((d, i) => {
                const iso = ymdOf(d);
                const dia = d.getDay();
                const h = c.colaborador_horario?.find((x) => x.dia_semana === dia);
                const onVacation = isOnVacation(c, iso);
                const ev = eventOn(c, iso);

                const ei = toMin(h?.expediente_inicio);
                const ef = toMin(h?.expediente_fim);
                const ai = toMin(h?.almoco_inicio);
                const af = toMin(h?.almoco_fim);

                return (
                  <div
                    key={i}
                    className={cn(
                      "relative h-12 border-l",
                      iso === today && "bg-primary/5",
                    )}
                    title={
                      onVacation
                        ? "Em férias"
                        : ev
                          ? EVENTO_LABEL[ev.tipo]
                          : h && ei != null && ef != null
                            ? `Expediente ${h.expediente_inicio?.slice(0, 5)}–${h.expediente_fim?.slice(0, 5)}`
                            : "Sem expediente"
                    }
                  >
                    {/* Barra de expediente */}
                    {h && ei != null && ef != null && !onVacation && (
                      <div
                        className="absolute top-1/2 h-3 -translate-y-1/2 rounded-sm bg-[var(--status-trabalhando)]/30 ring-1 ring-[var(--status-trabalhando)]/60"
                        style={{
                          left: `${pct(ei)}%`,
                          width: `${pct(ef) - pct(ei)}%`,
                        }}
                      />
                    )}
                    {/* Janela de almoço */}
                    {h && ai != null && af != null && !onVacation && (
                      <div
                        className="absolute top-1/2 h-3 -translate-y-1/2 rounded-sm bg-[var(--status-almoco)]/70"
                        style={{
                          left: `${pct(ai)}%`,
                          width: `${pct(af) - pct(ai)}%`,
                        }}
                      />
                    )}
                    {/* Férias */}
                    {onVacation && (
                      <div className="absolute inset-1 rounded-sm bg-[var(--status-ferias)]/40 ring-1 ring-[var(--status-ferias)]/60" />
                    )}
                    {/* Evento */}
                    {ev && !onVacation && (
                      <div className="absolute inset-1 flex items-center justify-center rounded-sm bg-[var(--status-evento)]/40 ring-1 ring-[var(--status-evento)]/60">
                        <span className="text-[9px] font-medium uppercase tracking-wide text-foreground/80">
                          {EVENTO_LABEL[ev.tipo]}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <LegendDot color="var(--status-trabalhando)" label="Expediente" />
        <LegendDot color="var(--status-almoco)" label="Almoço" />
        <LegendDot color="var(--status-ferias)" label="Férias" />
        <LegendDot color="var(--status-evento)" label="Evento" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="h-2.5 w-2.5 rounded-sm"
        style={{ background: color, opacity: 0.6 }}
      />
      {label}
    </span>
  );
}
