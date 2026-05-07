import * as React from "react";
import { format, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowRight,
  Calendar,
  CheckSquare,
  FileText,
  Inbox,
  ListChecks,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PreviewItem } from "@/components/PreviewDialog";
import { isAtribuidoA } from "@/lib/domain/atividades";

const STATUS_CONCLUIDOS = new Set([
  "concluida",
  "cancelada",
  "finalizado",
  "realizada",
  "producao",
  "aprovado",
]);

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  nome: string | null;
  colabId: string | null;
  tarefas: any[];
  demandas: any[];
  reunioes: any[];
  chamados: any[];
  onOpenItem: (item: PreviewItem) => void;
}

function MinhasAtribuicoesDialogImpl({
  open,
  onOpenChange,
  nome,
  colabId,
  tarefas,
  demandas,
  reunioes,
  chamados,
  onOpenItem,
}: Props) {
  const { minhasTarefas, minhasDemandas, minhasReunioes, meusChamados, total } =
    React.useMemo(() => {
      const filterFn = (r: any) => (colabId ? isAtribuidoA(r, colabId) : false);
      const mt = tarefas.filter(filterFn);
      const md = demandas.filter(filterFn);
      const mr = reunioes.filter(filterFn);
      const mc = chamados.filter(filterFn);
      return {
        minhasTarefas: mt,
        minhasDemandas: md,
        minhasReunioes: mr,
        meusChamados: mc,
        total: mt.length + md.length + mr.length + mc.length,
      };
    }, [tarefas, demandas, reunioes, chamados, colabId]);

  const renderList = (
    items: any[],
    tipo: PreviewItem["tipo"],
    dataKey: string,
    dataLabel: string,
    Icon: any,
  ) => {
    if (items.length === 0) {
      return (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhum item atribuído a você.
        </p>
      );
    }
    const sorted = [...items].sort((a, b) => {
      const da = a[dataKey] ? new Date(a[dataKey]).getTime() : Infinity;
      const db = b[dataKey] ? new Date(b[dataKey]).getTime() : Infinity;
      return da - db;
    });
    return (
      <ul className="space-y-1">
        {sorted.map((it) => {
          const dt = it[dataKey] ? new Date(it[dataKey]) : null;
          const atrasada =
            dt &&
            isBefore(dt, startOfDay(new Date())) &&
            !STATUS_CONCLUIDOS.has((it.status ?? "").toLowerCase());
          return (
            <li key={it.id}>
              <button
                type="button"
                onClick={() =>
                  onOpenItem({
                    id: it.id,
                    tipo,
                    titulo: it.titulo,
                    descricao: it.descricao ?? it.pauta ?? null,
                    status: it.status,
                    prioridade: it.prioridade,
                    data: dt ?? undefined,
                    dataLabel,
                    tags: it.tags,
                  })
                }
                className={cn(
                  "list-item-interactive group w-full text-left",
                  atrasada && "border-l-2 border-l-destructive bg-destructive/5",
                )}
              >
                <Icon
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    atrasada ? "text-destructive" : "text-muted-foreground",
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{it.titulo}</span>
                    {atrasada && (
                      <Badge variant="destructive" className="text-[9px] uppercase">
                        Atrasada
                      </Badge>
                    )}
                    {(it.prioridade === "alta" || it.prioridade === "critica") && (
                      <Badge variant="destructive" className="text-[9px] uppercase">
                        {it.prioridade}
                      </Badge>
                    )}
                    {it.status && (
                      <Badge variant="outline" className="text-[9px] uppercase">
                        {it.status}
                      </Badge>
                    )}
                  </div>
                  <p
                    className={cn(
                      "mt-0.5 text-xs",
                      atrasada ? "text-destructive/80" : "text-muted-foreground",
                    )}
                  >
                    {dt
                      ? `${dataLabel}: ${format(dt, "EEE, dd/MM 'às' HH:mm", { locale: ptBR })}`
                      : "Sem data"}
                  </p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" />
            Minhas atribuições
          </DialogTitle>
          <DialogDescription>
            {nome ? `${nome} · ` : ""}
            {total} {total === 1 ? "item atribuído" : "itens atribuídos"} a você.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="tarefas" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="tarefas" className="gap-1.5">
              <CheckSquare className="h-3.5 w-3.5" />
              Tarefas
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {minhasTarefas.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="demandas" className="gap-1.5">
              <Inbox className="h-3.5 w-3.5" />
              Demandas
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {minhasDemandas.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="reunioes" className="gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Reuniões
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {minhasReunioes.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="relatorios" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Relatórios
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {meusChamados.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
          <div className="mt-3 max-h-[60vh] overflow-y-auto pr-1">
            <TabsContent value="tarefas">
              {renderList(minhasTarefas, "tarefa", "data_prevista", "Prazo", CheckSquare)}
            </TabsContent>
            <TabsContent value="demandas">
              {renderList(minhasDemandas, "demanda", "prazo", "Prazo", Inbox)}
            </TabsContent>
            <TabsContent value="reunioes">
              {renderList(minhasReunioes, "reuniao", "data_reuniao", "Quando", Calendar)}
            </TabsContent>
            <TabsContent value="relatorios">
              {renderList(meusChamados, "chamado", "prazo", "Prazo", FileText)}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export const MinhasAtribuicoesDialog = React.memo(MinhasAtribuicoesDialogImpl);
