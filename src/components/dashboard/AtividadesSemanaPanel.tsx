import { Link } from "@tanstack/react-router";
import { format, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, Calendar, CheckSquare, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/KpiTile";
import { cn } from "@/lib/utils";
import type { PreviewItem } from "@/components/PreviewDialog";

export type Atividade = PreviewItem & { _sortDate: number };

interface Props {
  atividades: Atividade[];
  weekStart: Date;
  weekEnd: Date;
  onPreview: (item: PreviewItem) => void;
}

export function AtividadesSemanaPanel({ atividades, weekStart, weekEnd, onPreview }: Props) {
  return (
    <Panel
      title="Atividades da semana"
      className="lg:col-span-2"
      actions={
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {format(weekStart, "dd MMM", { locale: ptBR })} – {format(weekEnd, "dd MMM", { locale: ptBR })}
          </span>
          <Link to="/atividades" className="text-xs font-medium text-primary hover:underline">
            Agenda →
          </Link>
        </div>
      }
      bodyClassName="p-2"
    >
      <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
        {atividades.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            Nenhuma atividade nesta semana.
          </div>
        ) : (
          atividades.slice(0, 8).map((a) => {
            const tone =
              a.tipo === "reuniao" ? "info" : a.tipo === "tarefa" ? "warning" : "primary";
            const Icon = a.tipo === "reuniao" ? Calendar : a.tipo === "tarefa" ? CheckSquare : Inbox;
            const concluido =
              (a.tipo === "tarefa" && ["producao", "aprovado"].includes(a.status ?? "")) ||
              (a.tipo === "demanda" && ["concluida", "cancelada"].includes(a.status ?? "")) ||
              (a.tipo === "reuniao" && ["realizada", "cancelada"].includes(a.status ?? ""));
            const atrasada =
              !!a.data && isBefore(new Date(a.data), startOfDay(new Date())) && !concluido;
            return (
              <button
                key={`${a.tipo}-${a.id}`}
                type="button"
                onClick={() => onPreview(a)}
                className={cn(
                  "list-item-interactive group",
                  atrasada && "border-l-2 border-l-destructive bg-destructive/5",
                  concluido && "opacity-60",
                )}
              >
                <span className={cn("type-dot", `type-dot-${tone}`)} />
                <Icon
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0 group-hover:text-foreground",
                    atrasada ? "text-destructive" : "text-muted-foreground",
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("truncate text-sm font-medium", concluido && "line-through")}>
                      {a.titulo}
                    </span>
                    {atrasada && (
                      <Badge variant="destructive" className="text-[9px] uppercase">
                        Atrasada
                      </Badge>
                    )}
                    {a.prioridade === "alta" || a.prioridade === "critica" ? (
                      <Badge variant="destructive" className="text-[9px] uppercase">
                        {a.prioridade}
                      </Badge>
                    ) : null}
                  </div>
                  <p className={cn("mt-0.5 text-xs", atrasada ? "text-destructive/80" : "text-muted-foreground")}>
                    {format(new Date(a.data!), "EEE, dd/MM 'às' HH:mm", { locale: ptBR })}
                    {a.responsavel && ` · ${a.responsavel}`}
                  </p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            );
          })
        )}
        {atividades.length > 8 && (
          <Link
            to="/atividades"
            className="block py-2 text-center text-xs font-medium text-primary hover:underline"
          >
            Ver mais {atividades.length - 8} atividades →
          </Link>
        )}
      </div>
    </Panel>
  );
}
