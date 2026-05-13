import * as React from "react";
import { format, differenceInCalendarDays, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, Calendar, MessageSquare, ListChecks, Paperclip, Link2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { prioVariant } from "./lib/workflow";

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

export function TarefaCard({ tarefa, colabs, selected, onSelect, onOpen, counts, hasDemanda }: Props) {
  const responsaveis = tarefa.equipe_toda
    ? colabs
    : colabs.filter((c) => (tarefa.responsaveis_ids ?? []).includes(c.id));

  const prazo = tarefa.data_prevista ? new Date(tarefa.data_prevista) : null;
  const atrasada = prazo && isPast(prazo) && !isToday(prazo) && !["producao", "aprovado"].includes(tarefa.status);
  const hojeFlag = prazo && isToday(prazo);
  const diasRestantes = prazo ? differenceInCalendarDays(prazo, new Date()) : null;

  return (
    <Card
      onClick={onOpen}
      className={`group relative cursor-pointer space-y-2.5 border-l-2 p-3 transition hover:shadow-md ${
        selected ? "ring-2 ring-primary" : ""
      } ${
        tarefa.prioridade === "alta"
          ? "border-l-destructive"
          : tarefa.prioridade === "media"
          ? "border-l-warning"
          : "border-l-success"
      }`}
    >
      {/* checkbox de seleção */}
      <div
        className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100 data-[selected=true]:opacity-100"
        data-selected={selected}
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox checked={selected} onCheckedChange={(v) => onSelect(!!v)} />
      </div>

      <div className="flex items-start gap-2 pr-6">
        {atrasada && (
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            </TooltipTrigger>
            <TooltipContent>Atrasada</TooltipContent>
          </Tooltip>
        )}
        <h4 className="line-clamp-2 text-sm font-medium leading-snug">{tarefa.titulo}</h4>
      </div>

      {tarefa.descricao && (
        <p className="line-clamp-2 text-xs text-muted-foreground">{tarefa.descricao}</p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className={`h-5 px-1.5 text-[10px] capitalize ${prioVariant(tarefa.prioridade)}`}>
          {tarefa.prioridade}
        </Badge>
        {hasDemanda && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px]">
                <Link2 className="h-3 w-3" /> Demanda
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Vinculada a uma demanda</TooltipContent>
          </Tooltip>
        )}
        {tarefa.origem_importacao === "homologacao" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="h-5 border-info/40 bg-info/15 px-1.5 text-[10px] text-info hover:bg-info/20">
                HML importada
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Tarefa importada via lote de homologação</TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {prazo && (
            <span
              className={`inline-flex items-center gap-1 ${
                atrasada ? "text-destructive font-medium" : hojeFlag ? "text-warning font-medium" : ""
              }`}
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
          {counts.checklistTotal > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <ListChecks className="h-3 w-3" /> {counts.checklistDone}/{counts.checklistTotal}
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
                <Avatar className="h-5 w-5 border border-background">
                  <AvatarFallback className="bg-primary/15 text-[9px] text-primary">
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
            <Avatar className="h-5 w-5 border border-background">
              <AvatarFallback className="bg-muted text-[9px]">+{responsaveis.length - 3}</AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </Card>
  );
}
