import { isPast, isToday } from "date-fns";
import { Card } from "@/components/ui/card";
import { STATUS_LABEL } from "@/components/tarefas/lib/workflow";
import type { TarefaRow } from "@/lib/db-types";
import type { CountsMap, ColabMini } from "@/components/tarefas/useTarefasData";

interface Props {
  tarefas: TarefaRow[];
  colabs: ColabMini[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string, checked: boolean) => void;
  onOpen: (t: TarefaRow) => void;
  countsMap: CountsMap;
}

/** Visualização em lista compacta (alternativa ao kanban). */
export function TarefasLista({ tarefas, colabs, selectedIds, onToggleSelect, onOpen, countsMap }: Props) {
  return (
    <Card className="divide-y">
      {tarefas.map((t) => {
        const responsaveis = t.equipe_toda
          ? colabs
          : colabs.filter((c) => (t.responsaveis_ids ?? []).includes(c.id));
        const prazo = t.data_prevista ? new Date(t.data_prevista) : null;
        const atrasada =
          prazo && isPast(prazo) && !isToday(prazo) && !["producao", "aprovado"].includes(t.status);
        const c = countsMap[t.id] ?? { comentarios: 0, checklistTotal: 0, checklistDone: 0, anexos: 0 };
        return (
          <div
            key={t.id}
            onClick={() => onOpen(t)}
            className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/40"
          >
            <input
              type="checkbox"
              checked={selectedIds.has(t.id)}
              onChange={(e) => onToggleSelect(t.id, e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{t.titulo}</span>
                {atrasada && (
                  <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                    Atrasada
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="capitalize">{STATUS_LABEL[t.status] ?? t.status}</span>
                <span>·</span>
                <span className="capitalize">{t.prioridade}</span>
                {prazo && (
                  <>
                    <span>·</span>
                    <span>{prazo.toLocaleDateString("pt-BR")}</span>
                  </>
                )}
                {c.comentarios > 0 && (
                  <>
                    <span>·</span>
                    <span>{c.comentarios} coments</span>
                  </>
                )}
                {c.checklistTotal > 0 && (
                  <>
                    <span>·</span>
                    <span>
                      {c.checklistDone}/{c.checklistTotal} itens
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex -space-x-1.5">
              {responsaveis.slice(0, 3).map((r) => (
                <div
                  key={r.id}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-background bg-primary/15 text-[10px] font-medium text-primary"
                  title={r.nome}
                >
                  {r.nome
                    .split(" ")
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </Card>
  );
}
