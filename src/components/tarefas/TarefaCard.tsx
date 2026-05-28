import * as React from "react";
import { format, differenceInCalendarDays, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle, Calendar, MessageSquare, ListChecks, Paperclip, Link2, FlaskConical,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Counts {
  comentarios: number;
  checklistTotal: number;
  checklistDone: number;
  anexos: number;
}

interface Props {
  tarefa: any;
  colabs: { id: string; nome: string }[];
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onOpen: () => void;
  counts: Counts;
  hasDemanda: boolean;
}

const PRIO_BAR: Record<string, string> = {
  alta: "bg-gradient-to-b from-rose-500 to-rose-600",
  media: "bg-gradient-to-b from-amber-400 to-amber-500",
  baixa: "bg-gradient-to-b from-emerald-400 to-emerald-500",
};

const PRIO_BADGE: Record<string, string> = {
  alta: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  media: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  baixa: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
};

export function TarefaCard({ tarefa, colabs, selected, onSelect, onOpen, counts, hasDemanda }: Props) {
  const responsaveis = tarefa.equipe_toda
    ? colabs
    : colabs.filter((c) => (tarefa.responsaveis_ids ?? []).includes(c.id));

  const prazo = tarefa.data_prevista ? new Date(tarefa.data_prevista) : null;
  const atrasada = !!(prazo && isPast(prazo) && !isToday(prazo) && !["producao", "aprovado"].includes(tarefa.status));
  const hojeFlag = !!(prazo && isToday(prazo));
  const diasRestantes = prazo ? differenceInCalendarDays(prazo, new Date()) : null;
  const proxima = !!(diasRestantes !== null && diasRestantes >= 0 && diasRestantes <= 3 && !atrasada && !hojeFlag);

  const prio = (tarefa.prioridade ?? "baixa") as "alta" | "media" | "baixa";
  const checklistPct = counts.checklistTotal > 0
    ? Math.round((counts.checklistDone / counts.checklistTotal) * 100)
    : 0;

  return (
    <Card
      onClick={onOpen}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-xl border bg-card p-3 pl-3.5 transition-all",
        "hover:-translate-y-0.5 hover:shadow-lg hover:ring-1 hover:ring-emerald-500/20",
        selected && "ring-2 ring-emerald-500 shadow-md",
      )}
    >
      {/* accent bar lateral */}
      <span className={cn("absolute left-0 top-0 h-full w-[3px]", PRIO_BAR[prio])} aria-hidden />

      {/* glow sutil de atrasada */}
      {atrasada && (
        <span className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-rose-500/15 blur-2xl" aria-hidden />
      )}

      {/* checkbox */}
      <div
        className={cn(
          "absolute right-2 top-2 transition-opacity",
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox checked={selected} onCheckedChange={(v) => onSelect(!!v)} />
      </div>

      <div className="flex items-start gap-2 pr-6">
        {atrasada && (
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 animate-pulse text-rose-500" />
            </TooltipTrigger>
            <TooltipContent>Atrasada</TooltipContent>
          </Tooltip>
        )}
        <h4 className="line-clamp-2 text-sm font-semibold leading-snug tracking-tight">
          {tarefa.titulo}
        </h4>
      </div>

      {tarefa.descricao && (
        <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground/85">{tarefa.descricao}</p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px] font-semibold capitalize", PRIO_BADGE[prio])}>
          {prio}
        </Badge>
        {hasDemanda && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="h-5 gap-1 border-indigo-500/30 bg-indigo-500/10 px-1.5 text-[10px] text-indigo-700 dark:text-indigo-300">
                <Link2 className="h-3 w-3" /> Demanda
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Vinculada a uma demanda</TooltipContent>
          </Tooltip>
        )}
        {tarefa.origem_importacao === "homologacao" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="h-5 border-sky-500/30 bg-sky-500/15 px-1.5 text-[10px] text-sky-700 dark:text-sky-300 hover:bg-sky-500/20">
                HML
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Tarefa importada via lote de homologação</TooltipContent>
          </Tooltip>
        )}
        {tarefa.em_teste && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="h-5 gap-1 border-cyan-500/30 bg-cyan-500/15 px-1.5 text-[10px] text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/20">
                <FlaskConical className="h-3 w-3" /> Em teste
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Tarefa sinalizada como em teste</TooltipContent>
          </Tooltip>
        )}
      </div>

      {counts.checklistTotal > 0 && (
        <div className="mt-2.5">
          <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <ListChecks className="h-3 w-3" /> Checklist
            </span>
            <span className="font-medium tabular-nums">
              {counts.checklistDone}/{counts.checklistTotal}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all"
              style={{ width: `${checklistPct}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {prazo && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px]",
                atrasada && "bg-rose-500/15 font-semibold text-rose-700 dark:text-rose-300",
                hojeFlag && "bg-amber-500/15 font-semibold text-amber-700 dark:text-amber-300",
                proxima && "bg-sky-500/15 text-sky-700 dark:text-sky-300",
                !atrasada && !hojeFlag && !proxima && "text-muted-foreground",
              )}
            >
              <Calendar className="h-3 w-3" />
              {format(prazo, "dd/MM", { locale: ptBR })}
              {diasRestantes !== null && diasRestantes >= 0 && diasRestantes <= 3 && !atrasada && (
                <span className="ml-0.5">
                  ({diasRestantes === 0 ? "hoje" : `${diasRestantes}d`})
                </span>
              )}
            </span>
          )}
          {counts.comentarios > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <MessageSquare className="h-3 w-3" /> {counts.comentarios}
            </span>
          )}
          {counts.anexos > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <Paperclip className="h-3 w-3" /> {counts.anexos}
            </span>
          )}
        </div>

        <div className="flex -space-x-1.5">
          {responsaveis.slice(0, 3).map((r) => (
            <Tooltip key={r.id}>
              <TooltipTrigger asChild>
                <Avatar className="h-5 w-5 ring-2 ring-background">
                  <AvatarFallback className="bg-gradient-to-br from-emerald-500/30 to-emerald-500/10 text-[9px] font-bold text-emerald-700 dark:text-emerald-300">
                    {r.nome
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>{r.nome}</TooltipContent>
            </Tooltip>
          ))}
          {responsaveis.length > 3 && (
            <Avatar className="h-5 w-5 ring-2 ring-background">
              <AvatarFallback className="bg-muted text-[9px] font-bold">+{responsaveis.length - 3}</AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </Card>
  );
}
