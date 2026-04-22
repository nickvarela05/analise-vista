import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Calendar, User, Tag, ArrowRight, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type PreviewItem = {
  id: string;
  tipo: "tarefa" | "demanda" | "reuniao" | "chamado" | "aviso";
  titulo: string;
  descricao?: string | null;
  status?: string | null;
  prioridade?: string | null;
  responsavel?: string | null;
  data?: string | Date | null;
  dataLabel?: string;
  tags?: string[] | null;
  extra?: Record<string, string | undefined>;
};

const tipoToRoute: Record<PreviewItem["tipo"], string> = {
  tarefa: "/tarefas",
  demanda: "/demandas",
  reuniao: "/reunioes",
  chamado: "/relatorios",
  aviso: "/avisos",
};

const tipoToLabel: Record<PreviewItem["tipo"], string> = {
  tarefa: "Tarefa",
  demanda: "Demanda",
  reuniao: "Reunião",
  chamado: "Chamado",
  aviso: "Aviso",
};

interface PreviewDialogProps {
  item: PreviewItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PreviewDialog({ item, open, onOpenChange }: PreviewDialogProps) {
  if (!item) return null;

  const dataFmt = item.data
    ? format(new Date(item.data), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] uppercase">
              {tipoToLabel[item.tipo]}
            </Badge>
            {item.status && (
              <Badge variant="secondary" className="text-[10px] uppercase">
                {item.status}
              </Badge>
            )}
            {item.prioridade && (
              <Badge
                className="text-[10px] uppercase"
                variant={
                  item.prioridade === "alta" || item.prioridade === "critica"
                    ? "destructive"
                    : "outline"
                }
              >
                {item.prioridade}
              </Badge>
            )}
          </div>
          <DialogTitle className="text-lg">{item.titulo}</DialogTitle>
          {item.descricao && (
            <DialogDescription className="text-sm leading-relaxed">
              {item.descricao}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {dataFmt && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4 text-primary" />
              <span>
                {item.dataLabel ?? "Data"}: <span className="font-medium text-foreground">{dataFmt}</span>
              </span>
            </div>
          )}
          {item.responsavel && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4 text-primary" />
              <span>
                Responsável: <span className="font-medium text-foreground">{item.responsavel}</span>
              </span>
            </div>
          )}
          {item.tags && item.tags.length > 0 && (
            <div className="flex items-start gap-2 text-muted-foreground">
              <Tag className="mt-0.5 h-4 w-4 text-primary" />
              <div className="flex flex-wrap gap-1">
                {item.tags.map((t) => (
                  <Badge key={t} variant="outline" className="text-[10px]">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {item.extra &&
            Object.entries(item.extra).map(([k, v]) =>
              v ? (
                <div key={k} className="flex items-start gap-2 text-muted-foreground">
                  <AlertCircle className="mt-0.5 h-4 w-4 text-primary" />
                  <span>
                    {k}: <span className="font-medium text-foreground">{v}</span>
                  </span>
                </div>
              ) : null,
            )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button asChild>
            <Link to={tipoToRoute[item.tipo]}>
              Abrir em {tipoToLabel[item.tipo]}s
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
