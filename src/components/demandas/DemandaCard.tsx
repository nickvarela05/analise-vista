import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, ListChecks, MessageSquare, Tag, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AssigneeBadges, type AssigneeOption } from "@/components/AssigneeCombobox";
import { cn } from "@/lib/utils";
import {
  describePrazo,
  prazoBadgeClass,
  prioridadeBadgeClass,
} from "./lib/demanda-utils";


interface DemandaCardProps {
  demanda: {
    id: string;
    titulo: string;
    descricao?: string | null;
    prioridade: string;
    categoria: string;
    status: string;
    prazo?: string | null;
    tags?: string[] | null;
    solicitante?: string | null;
    responsaveis_ids: string[];
    equipe_toda: boolean;
    created_at: string;
  };
  options: AssigneeOption[];
  todoCount?: number;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  compact?: boolean;
}

export function DemandaCard({
  demanda,
  options,
  todoCount,
  onClick,
  draggable,
  onDragStart,
  compact,
}: DemandaCardProps) {
  const prazo = describePrazo(demanda.prazo, demanda.status);
  const isCritica = demanda.prioridade === "critica";
  const isAtrasada = prazo?.isAtrasada;

  return (
    <button
      type="button"
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      className={cn(
        "group relative w-full overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-all",
        "hover:-translate-y-0.5 hover:shadow-lg hover:border-foreground/15",
        isCritica && "ring-1 ring-destructive/30",
        draggable && "cursor-grab active:cursor-grabbing",
        compact ? "p-2.5" : "p-3.5",
      )}
    >
      {/* lateral priority bar */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-[3px] rounded-l-xl",
          isCritica
            ? "bg-gradient-to-b from-destructive to-rose-500"
            : demanda.prioridade === "alta"
              ? "bg-gradient-to-b from-amber-500 to-orange-500"
              : demanda.prioridade === "media"
                ? "bg-gradient-to-b from-indigo-500 to-violet-500"
                : "bg-muted-foreground/30",
        )}
      />

      {/* subtle hover wash */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-violet-500/0 opacity-0 transition-opacity group-hover:opacity-100 group-hover:from-indigo-500/[0.04] group-hover:to-violet-500/[0.04]"
      />

      <div className="relative space-y-2 pl-1">
        <div className="flex items-start justify-between gap-2">
          <h4 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {demanda.titulo}
          </h4>
          {isCritica && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-destructive">
              <AlertCircle className="h-3 w-3 animate-pulse" />
              crítica
            </span>
          )}
        </div>

        {!compact && demanda.descricao && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{demanda.descricao}</p>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {!isCritica && (
            <Badge variant="outline" className={cn("capitalize text-[10px]", prioridadeBadgeClass(demanda.prioridade))}>
              {demanda.prioridade}
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px] capitalize text-muted-foreground">
            {demanda.categoria.replace(/_/g, " ")}
          </Badge>
          {prazo && (
            <Badge
              variant="outline"
              className={cn(
                "gap-1 text-[10px]",
                prazoBadgeClass(prazo.tone),
                isAtrasada && "animate-pulse",
              )}
            >
              <Calendar className="h-2.5 w-2.5" />
              {prazo.label}
            </Badge>
          )}
        </div>

        {demanda.tags && demanda.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {demanda.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-0.5 rounded-full bg-muted/70 px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                <Tag className="h-2.5 w-2.5" />
                {t}
              </span>
            ))}
            {demanda.tags.length > 3 && (
              <span className="text-[10px] text-muted-foreground">+{demanda.tags.length - 3}</span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2">
          <AssigneeBadges
            selectedIds={demanda.responsaveis_ids}
            equipeToda={demanda.equipe_toda}
            options={options}
            max={2}
          />
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            {todoCount !== undefined && todoCount > 0 && (
              <span
                className="inline-flex items-center gap-0.5 rounded-md bg-indigo-500/10 px-1.5 py-0.5 font-semibold text-indigo-600 dark:text-indigo-400"
                title="Tarefas vinculadas"
              >
                <ListChecks className="h-3 w-3" />
                {todoCount}
              </span>
            )}
            {demanda.solicitante && (
              <span className="flex max-w-[80px] items-center gap-0.5 truncate" title={demanda.solicitante}>
                <MessageSquare className="h-3 w-3" />
                {demanda.solicitante}
              </span>
            )}
            <span title={format(new Date(demanda.created_at), "dd/MM/yyyy HH:mm")}>
              {format(new Date(demanda.created_at), "dd/MM", { locale: ptBR })}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

