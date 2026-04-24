import * as React from "react";
import { TarefaCard } from "./TarefaCard";
import { WORKFLOW, STATUS_LABEL, STATUS_DESCRIPTION, columnAccent, normalizeStatus } from "./lib/workflow";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface Props {
  tarefas: any[];
  colabs: { id: string; nome: string }[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string, checked: boolean) => void;
  onOpen: (tarefa: any) => void;
  onDropStatus: (id: string, status: string) => void;
  countsMap: Record<string, { comentarios: number; checklistTotal: number; checklistDone: number; anexos: number }>;
}

export function TarefaKanban({
  tarefas,
  colabs,
  selectedIds,
  onToggleSelect,
  onOpen,
  onDropStatus,
  countsMap,
}: Props) {
  const [dragOver, setDragOver] = React.useState<string | null>(null);

  const grouped = React.useMemo(() => {
    const map: Record<string, any[]> = {};
    WORKFLOW.forEach((s) => (map[s] = []));
    tarefas.forEach((t) => {
      const s = normalizeStatus(t.status);
      if (!map[s]) map[s] = [];
      map[s].push(t);
    });
    return map;
  }, [tarefas]);

  return (
    <ScrollArea className="w-full">
      <div
        className="grid gap-3 pb-4"
        style={{
          gridTemplateColumns: `repeat(${WORKFLOW.length}, minmax(220px, 1fr))`,
          minWidth: `${WORKFLOW.length * 220}px`,
        }}
      >
        {WORKFLOW.map((status) => {
          const items = grouped[status] ?? [];
          const isOver = dragOver === status;
          return (
            <div
              key={status}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(status);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                setDragOver(null);
                if (id) onDropStatus(id, status);
              }}
              className={`flex min-w-0 flex-col rounded-lg border-t-2 bg-muted/40 p-2 transition ${columnAccent(
                status,
              )} ${isOver ? "bg-muted ring-2 ring-primary/40" : ""}`}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide">
                    {STATUS_LABEL[status]}
                  </h3>
                  <p className="text-[10px] text-muted-foreground">{STATUS_DESCRIPTION[status]}</p>
                </div>
                <Badge variant="secondary" className="h-5 text-[10px]">
                  {items.length}
                </Badge>
              </div>

              <div className="flex min-h-[120px] flex-col gap-2">
                {items.length === 0 ? (
                  <div className="flex h-24 items-center justify-center rounded-md border border-dashed text-[11px] text-muted-foreground">
                    Arraste tarefas aqui
                  </div>
                ) : (
                  items.map((t) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                    >
                      <TarefaCard
                        tarefa={t}
                        colabs={colabs}
                        selected={selectedIds.has(t.id)}
                        onSelect={(c) => onToggleSelect(t.id, c)}
                        onOpen={() => onOpen(t)}
                        counts={countsMap[t.id] ?? { comentarios: 0, checklistTotal: 0, checklistDone: 0, anexos: 0 }}
                        hasDemanda={!!t.demanda_id}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
