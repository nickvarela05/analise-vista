import * as React from "react";
import { Inbox } from "lucide-react";
import { TarefaCard } from "./TarefaCard";
import { WORKFLOW, STATUS_LABEL, STATUS_DESCRIPTION, normalizeStatus } from "./lib/workflow";
import { cn } from "@/lib/utils";

interface Props {
  tarefas: any[];
  colabs: { id: string; nome: string }[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string, checked: boolean) => void;
  onOpen: (tarefa: any) => void;
  onDropStatus: (id: string, status: string) => void;
  countsMap: Record<string, { comentarios: number; checklistTotal: number; checklistDone: number; anexos: number }>;
}

// Tom por coluna (gradiente do header + ring drag-over + pill do contador)
const COL_TONE: Record<string, { wash: string; bar: string; pill: string; ring: string; text: string }> = {
  aberta:             { wash: "from-slate-500/15 via-slate-500/5",   bar: "bg-slate-400",   pill: "bg-slate-500/15 text-slate-700 dark:text-slate-300",   ring: "ring-slate-400/40",  text: "text-slate-700 dark:text-slate-200" },
  em_andamento:       { wash: "from-primary/20 via-primary/5",       bar: "bg-primary",     pill: "bg-primary/15 text-primary",                            ring: "ring-primary/40",    text: "text-primary" },
  homologacao:        { wash: "from-sky-500/20 via-sky-500/5",       bar: "bg-sky-500",     pill: "bg-sky-500/15 text-sky-700 dark:text-sky-300",          ring: "ring-sky-500/40",    text: "text-sky-700 dark:text-sky-300" },
  aprovado:           { wash: "from-emerald-500/20 via-emerald-500/5", bar: "bg-emerald-500", pill: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", ring: "ring-emerald-500/40", text: "text-emerald-700 dark:text-emerald-300" },
  aprovado_ressalvas: { wash: "from-amber-500/20 via-amber-500/5",   bar: "bg-amber-500",   pill: "bg-amber-500/15 text-amber-700 dark:text-amber-300",    ring: "ring-amber-500/40",  text: "text-amber-700 dark:text-amber-300" },
  reprovado:          { wash: "from-rose-500/20 via-rose-500/5",     bar: "bg-rose-500",    pill: "bg-rose-500/15 text-rose-700 dark:text-rose-300",       ring: "ring-rose-500/40",   text: "text-rose-700 dark:text-rose-300" },
  producao:           { wash: "from-violet-500/20 via-violet-500/5", bar: "bg-violet-500",  pill: "bg-violet-500/15 text-violet-700 dark:text-violet-300", ring: "ring-violet-500/40", text: "text-violet-700 dark:text-violet-300" },
  encerrada:          { wash: "from-zinc-500/15 via-zinc-500/5",     bar: "bg-zinc-400",    pill: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300",       ring: "ring-zinc-500/40",   text: "text-zinc-700 dark:text-zinc-200" },
};

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
    <div className="w-full overflow-x-auto">
      <div
        className="grid gap-2.5 pb-4"
        style={{ gridTemplateColumns: `repeat(${WORKFLOW.length}, minmax(0, 1fr))` }}
      >
        {WORKFLOW.map((status) => {
          const items = grouped[status] ?? [];
          const isOver = dragOver === status;
          const tone = COL_TONE[status] ?? COL_TONE.aberta;
          return (
            <div
              key={status}
              onDragOver={(e) => { e.preventDefault(); setDragOver(status); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                setDragOver(null);
                if (id) onDropStatus(id, status);
              }}
              className={cn(
                "group/col relative flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card/60 backdrop-blur transition-all",
                isOver && cn("ring-2 -translate-y-0.5 shadow-md", tone.ring),
              )}
            >
              {/* Header com gradient tonal */}
              <div className={cn("relative overflow-hidden bg-gradient-to-b to-transparent px-3 py-2.5", tone.wash)}>
                <div className={cn("absolute left-0 top-0 h-full w-[3px]", tone.bar)} />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className={cn("truncate text-[11px] font-bold uppercase tracking-[0.08em]", tone.text)}>
                      {STATUS_LABEL[status]}
                    </h3>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {STATUS_DESCRIPTION[status]}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums",
                      tone.pill,
                    )}
                  >
                    {items.length}
                  </span>
                </div>
              </div>

              {/* Coluna */}
              <div className="flex min-h-[140px] flex-col gap-2 p-2">
                {items.length === 0 ? (
                  <div className="flex h-24 flex-col items-center justify-center gap-1 rounded-md border border-dashed px-2 text-center text-[10px] text-muted-foreground/70">
                    <Inbox className="h-4 w-4 opacity-60" />
                    <span>Arraste aqui</span>
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
    </div>
  );
}
