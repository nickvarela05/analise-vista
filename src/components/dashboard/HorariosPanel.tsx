import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Building2, Clock, MapPin, UtensilsCrossed } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Panel } from "@/components/KpiTile";
import { agruparColaboradoresPorEquipe } from "@/lib/equipes";
import { cn } from "@/lib/utils";

export interface HorarioItem {
  id: string;
  nome: string;
  nomeCompleto: string;
  foto: string | null;
  localTrabalho: "escritorio" | "rua";
  expediente: string;
  almoco: string;
  local: string;
}

const LOCAL_ORDEM: Array<{
  key: "escritorio" | "rua";
  label: string;
  icon: typeof Building2;
  className: string;
}> = [
  {
    key: "escritorio",
    label: "Escritório",
    icon: Building2,
    className:
      "bg-primary/10 text-primary ring-1 ring-inset ring-primary/20",
  },
  {
    key: "rua",
    label: "Rua",
    icon: MapPin,
    className:
      "bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-1 ring-inset ring-amber-500/20",
  },
];

function HorarioRow({ h }: { h: HorarioItem }) {
  return (
    <li className="flex items-center gap-3 py-2 text-sm first:pt-0 last:pb-0">
      <Avatar className="h-8 w-8 shrink-0">
        {h.foto && <AvatarImage src={h.foto} />}
        <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
          {h.nome.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium leading-tight">{h.nome}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-foreground/80">
            <Clock className="h-3 w-3 text-primary" />
            {h.expediente}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-foreground/70">
            <UtensilsCrossed className="h-3 w-3 text-amber-500" />
            {h.almoco}
            <span className="text-muted-foreground/80">· {h.local}</span>
          </span>
        </div>
      </div>
    </li>
  );
}

export function HorariosPanel({ horarios }: { horarios: HorarioItem[] }) {
  const { grupos, outros } = React.useMemo(
    () => agruparColaboradoresPorEquipe(horarios.map((h) => ({ id: h.id, nome: h.nomeCompleto }))),
    [horarios],
  );

  const byId = React.useMemo(() => {
    const m = new Map<string, HorarioItem>();
    horarios.forEach((h) => m.set(h.id, h));
    return m;
  }, [horarios]);

  const seccoes = React.useMemo(() => {
    const todos = [...grupos, { label: "Outros", items: outros }];
    return todos
      .map((g) => {
        const items = g.items.map((i) => byId.get(i.id)!).filter(Boolean);
        const escritorio = items.filter((i) => i.localTrabalho === "escritorio");
        const rua = items.filter((i) => i.localTrabalho === "rua");
        return { label: g.label, total: items.length, escritorio, rua };
      })
      .filter((g) => g.total > 0);
  }, [grupos, outros, byId]);

  return (
    <Panel
      title="Horários (segunda)"
      actions={
        <Link to="/equipe" className="text-xs font-medium text-primary hover:underline">
          Editar →
        </Link>
      }
    >
      {horarios.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Cadastre horários em{" "}
          <Link to="/equipe" className="font-medium text-primary hover:underline">
            Equipe
          </Link>
          .
        </p>
      ) : (
        <div className="space-y-4">
          {seccoes.map((s) => (
            <section key={s.label}>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </h4>
                <span className="text-[10px] font-medium text-muted-foreground/70">
                  {s.total} {s.total === 1 ? "pessoa" : "pessoas"}
                </span>
              </div>

              <div className="space-y-2">
                {LOCAL_ORDEM.map(({ key, label, icon: Icon, className }) => {
                  const lista = key === "escritorio" ? s.escritorio : s.rua;
                  if (lista.length === 0) return null;
                  return (
                    <div
                      key={key}
                      className="rounded-lg border border-border/50 bg-card/40 p-2"
                    >
                      <div className="mb-1.5 flex items-center justify-between px-1">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                            className,
                          )}
                        >
                          <Icon className="h-3 w-3" />
                          {label}
                        </span>
                        <span className="text-[10px] text-muted-foreground/70">
                          {lista.length}
                        </span>
                      </div>
                      <ul className="divide-y divide-border/40">
                        {lista.map((h) => (
                          <HorarioRow key={h.id} h={h} />
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </Panel>
  );
}
