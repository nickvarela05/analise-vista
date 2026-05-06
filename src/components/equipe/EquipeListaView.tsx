import * as React from "react";
import { Search, Building2, MapPin, Utensils, CalendarClock, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ColaboradorStatusBadge } from "./ColaboradorStatusBadge";
import { computeStatus } from "./lib/status";
import type { Colaborador, LocalTrabalho } from "./lib/types";
import { DIAS, EVENTO_LABEL, LOCAL_TRABALHO_LABEL } from "./lib/types";
import { CARGOS } from "./lib/cargos";

interface Props {
  colabs: Colaborador[];
  onSelect: (c: Colaborador) => void;
}

const CARGO_ORDER = new Map<string, number>(CARGOS.map((c, i) => [c, i]));
const cargoRank = (c: string) =>
  CARGO_ORDER.has(c) ? CARGO_ORDER.get(c)! : c === "Sem cargo" ? 999 : 500;

const LOCAIS: {
  key: LocalTrabalho;
  icon: typeof Building2;
  accent: string;
  ring: string;
  bg: string;
}[] = [
  {
    key: "escritorio",
    icon: Building2,
    accent: "text-primary",
    ring: "ring-primary/20",
    bg: "from-primary/10 via-primary/5 to-transparent",
  },
  {
    key: "rua",
    icon: MapPin,
    accent: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/20",
    bg: "from-amber-500/10 via-amber-500/5 to-transparent",
  },
];

export function EquipeListaView({ colabs, onSelect }: Props) {
  const [q, setQ] = React.useState("");
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const dia = now.getDay();

  const filtered = colabs.filter((c) =>
    c.nome.toLowerCase().includes(q.toLowerCase()) ||
    (c.cargo ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  const byLocal = React.useMemo(() => {
    const result = new Map<LocalTrabalho, Map<string, Colaborador[]>>();
    for (const local of LOCAIS) result.set(local.key, new Map());
    for (const c of filtered) {
      const local = (c.local_trabalho ?? "escritorio") as LocalTrabalho;
      const cargoKey = c.cargo?.trim() || "Sem cargo";
      const m = result.get(local)!;
      if (!m.has(cargoKey)) m.set(cargoKey, []);
      m.get(cargoKey)!.push(c);
    }
    return result;
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome ou cargo..."
          className="pl-9"
        />
      </div>

      {LOCAIS.map(({ key, icon: Icon, accent, ring, bg }) => {
        const groups = Array.from(byLocal.get(key)!.entries()).sort(
          ([a], [b]) => cargoRank(a) - cargoRank(b),
        );
        const total = groups.reduce((sum, [, items]) => sum + items.length, 0);

        return (
          <section
            key={key}
            className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${bg}`}
          >
            <header className="flex items-center justify-between gap-2 border-b border-border/40 bg-background/40 px-5 py-3 backdrop-blur">
              <div className="flex items-center gap-2.5">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-background ring-1 ${ring}`}>
                  <Icon className={`h-4 w-4 ${accent}`} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold leading-none">
                    {LOCAL_TRABALHO_LABEL[key]}
                  </h3>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {total} {total === 1 ? "colaborador" : "colaboradores"}
                  </p>
                </div>
              </div>
            </header>

            {total === 0 ? (
              <div className="px-5 py-10 text-center text-xs text-muted-foreground">
                Nenhum colaborador neste local.
              </div>
            ) : (
              <div className="space-y-5 p-5">
                {groups.map(([cargo, items]) => (
                  <div key={cargo}>
                    <div className="mb-2.5 flex items-center gap-2">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {cargo}
                      </h4>
                      <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-normal">
                        {items.length}
                      </Badge>
                      <div className="h-px flex-1 bg-border/60" />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {items.map((c) => {
                        const status = computeStatus(c, now);
                        const h = c.colaborador_horario?.find((x) => x.dia_semana === dia);
                        const expediente = h?.expediente_inicio
                          ? `${h.expediente_inicio.slice(0, 5)}–${h.expediente_fim?.slice(0, 5) ?? "—"}`
                          : null;
                        const almoco = h?.almoco_inicio
                          ? `${h.almoco_inicio.slice(0, 5)}–${h.almoco_fim?.slice(0, 5) ?? "—"}`
                          : null;
                        const proxEvento = c.colaborador_evento
                          ?.filter((e) => e.data >= today)
                          .sort((a, b) => a.data.localeCompare(b.data))[0];

                        const iniciais = c.nome
                          .split(" ")
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((n) => n[0]?.toUpperCase())
                          .join("");

                        return (
                          <Card
                            key={c.id}
                            onClick={() => onSelect(c)}
                            className="group relative cursor-pointer overflow-hidden border-border/60 p-0 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                          >
                            <div className="flex items-start gap-3 p-3.5">
                              <Avatar className="h-11 w-11 ring-2 ring-background transition-transform group-hover:scale-105">
                                {c.foto_url && <AvatarImage src={c.foto_url} alt={c.nome} />}
                                <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                                  {iniciais}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <h5 className="truncate text-sm font-semibold leading-tight">
                                    {c.nome}
                                  </h5>
                                </div>
                                <div className="mt-1.5">
                                  <ColaboradorStatusBadge status={status} />
                                </div>
                              </div>
                            </div>

                            <div className="space-y-1.5 border-t border-border/50 bg-muted/20 px-3.5 py-2.5 text-[11px] text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3 w-3 shrink-0" />
                                <span className="truncate">
                                  <span className="text-foreground/80">{DIAS[dia]}:</span>{" "}
                                  {expediente ?? "—"}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Utensils className="h-3 w-3 shrink-0" />
                                <span className="truncate">
                                  {almoco ? (
                                    <>
                                      {almoco}
                                      {h?.local_almoco && (
                                        <span className="text-foreground/70"> · {h.local_almoco}</span>
                                      )}
                                    </>
                                  ) : h?.local_almoco ? (
                                    h.local_almoco
                                  ) : (
                                    "—"
                                  )}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <CalendarClock className="h-3 w-3 shrink-0" />
                                <span className="truncate">
                                  {proxEvento ? (
                                    <>
                                      {EVENTO_LABEL[proxEvento.tipo]}
                                      <span className="text-foreground/70">
                                        {" "}
                                        · {proxEvento.data.split("-").reverse().join("/")}
                                      </span>
                                    </>
                                  ) : (
                                    "Sem eventos"
                                  )}
                                </span>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
