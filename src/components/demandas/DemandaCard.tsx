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
  prioridadeSideClass,
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

  return (
    <button
      type="button"
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      className={cn(
        "group relative w-full rounded-lg border bg-card text-left shadow-sm transition-all",
        "border-l-4 hover:shadow-md hover:-translate-y-0.5",
        prioridadeSideClass(demanda.prioridade),
        isCritica && "ring-1 ring-destructive/20",
        draggable && "cursor-grab active:cursor-grabbing",
        compact ? "p-2.5" : "p-3",
      )}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {demanda.titulo}
          </h4>
          {isCritica && (
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive animate-pulse" />
          )}
        </div>

        {!compact && demanda.descricao && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{demanda.descricao}</p>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className={cn("capitalize text-[10px]", prioridadeBadgeClass(demanda.prioridade))}>
            {demanda.prioridade}
          </Badge>
          <Badge variant="outline" className="text-[10px] capitalize text-muted-foreground">
            {demanda.categoria.replace(/_/g, " ")}
          </Badge>
          {prazo && (
            <Badge variant="outline" className={cn("gap-1 text-[10px]", prazoBadgeClass(prazo.tone))}>
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
                className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
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

        <div className="flex items-center justify-between gap-2 pt-1">
          <AssigneeBadges
            selectedIds={demanda.responsaveis_ids}
            equipeToda={demanda.equipe_toda}
            options={options}
            max={2}
          />
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            {todoCount !== undefined && todoCount > 0 && (
              <span className="flex items-center gap-0.5" title="Tarefas vinculadas">
                <ListChecks className="h-3 w-3" />
                {todoCount}
              </span>
            )}
            {demanda.solicitante && (
              <span className="flex items-center gap-0.5 max-w-[80px] truncate" title={demanda.solicitante}>
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
