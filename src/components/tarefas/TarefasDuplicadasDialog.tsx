import * as React from "react";
import { Copy, Loader2, Trash2, AlertTriangle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queries/keys";
import type { TarefaRow } from "@/lib/db-types";
import {
  WORKFLOW,
  STATUS_LABEL,
  statusVariant,
  normalizeStatus,
} from "@/components/tarefas/lib/workflow";
import { taskDedupKey, extractTaskNumber } from "@/components/tarefas/lib/taskNumber";

type Grupo = { chave: string; numero: string | null; titulo: string; tarefas: TarefaRow[] };

function agrupar(tarefas: TarefaRow[]): Grupo[] {
  const mapa = new Map<string, TarefaRow[]>();
  for (const t of tarefas) {
    const k = taskDedupKey(t.titulo);
    if (!k) continue;
    const arr = mapa.get(k) ?? [];
    arr.push(t);
    mapa.set(k, arr);
  }
  const grupos: Grupo[] = [];
  for (const [chave, arr] of mapa.entries()) {
    if (arr.length < 2) continue;
    arr.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    grupos.push({
      chave,
      numero: extractTaskNumber(arr[0].titulo),
      titulo: arr[0].titulo,
      tarefas: arr,
    });
  }
  grupos.sort((a, b) => b.tarefas.length - a.tarefas.length);
  return grupos;
}

export function TarefasDuplicadasDialog({ tarefas }: { tarefas: TarefaRow[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  const grupos = React.useMemo(() => agrupar(tarefas), [tarefas]);
  const totalDup = grupos.reduce((n, g) => n + g.tarefas.length, 0);

  const refresh = () => qc.invalidateQueries({ queryKey: qk.tarefas.all() });

  const alterarStatus = async (id: string, status: string) => {
    setBusy(id);
    const { error } = await supabase
      .from("todo")
      .update({ status: status as never })
      .eq("id", id);
    setBusy(null);
    if (error) return toast.error("Erro ao atualizar", { description: error.message });
    toast.success("Status atualizado");
    refresh();
  };

  const excluir = async (id: string) => {
    if (!confirm("Excluir esta tarefa duplicada?")) return;
    setBusy(id);
    const { error } = await supabase.from("todo").delete().eq("id", id);
    setBusy(null);
    if (error) return toast.error("Erro ao excluir", { description: error.message });
    toast.success("Tarefa removida");
    refresh();
  };

  const manterMaisRecente = async (g: Grupo) => {
    if (g.tarefas.length < 2) return;
    const [manter, ...remover] = g.tarefas; // já ordenado por created_at desc
    if (!confirm(
      `Manter a versão mais recente (${format(new Date(manter.created_at), "dd/MM/yyyy")}) e excluir ${remover.length} duplicata(s)?`,
    )) return;
    setBusy(g.chave);
    const ids = remover.map((t) => t.id);
    const { error } = await supabase.from("todo").delete().in("id", ids);
    setBusy(null);
    if (error) return toast.error("Erro ao remover duplicatas", { description: error.message });
    toast.success(`${ids.length} duplicata(s) removida(s)`);
    refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Copy className="h-4 w-4" />
          Duplicadas
          {grupos.length > 0 && (
            <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">
              {grupos.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Tarefas duplicadas
          </DialogTitle>
          <DialogDescription>
            Tarefas com títulos idênticos (ignora acentos, maiúsculas e espaços). Ajuste
            o status ou remova as sobras — apenas a versão canônica deve permanecer.
          </DialogDescription>
        </DialogHeader>

        {grupos.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhuma duplicidade encontrada. 🎉
          </div>
        ) : (
          <>
            <div className="text-xs text-muted-foreground">
              {grupos.length} grupo(s) • {totalDup} tarefa(s) envolvida(s)
            </div>
            <div className="max-h-[60vh] space-y-3 overflow-auto pr-1">
              {grupos.map((g) => (
                <div key={g.chave} className="rounded-lg border bg-card">
                  <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{g.titulo}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {g.tarefas.length} ocorrências
                      </p>
                    </div>
                  </div>
                  <ul className="divide-y">
                    {g.tarefas.map((t, i) => (
                      <li
                        key={t.id}
                        className="flex flex-wrap items-center gap-2 px-3 py-2"
                      >
                        <Badge
                          variant="outline"
                          className={statusVariant(normalizeStatus(t.status))}
                        >
                          {STATUS_LABEL[t.status] ?? t.status}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          criada {format(new Date(t.created_at), "dd/MM/yyyy")}
                        </span>
                        {i === 0 && (
                          <Badge variant="secondary" className="text-[10px]">
                            mais recente
                          </Badge>
                        )}
                        <div className="ml-auto flex items-center gap-1.5">
                          <Select
                            value={t.status}
                            onValueChange={(v) => alterarStatus(t.id, v)}
                            disabled={busy === t.id}
                          >
                            <SelectTrigger className="h-8 w-[190px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {WORKFLOW.map((s) => (
                                <SelectItem key={s} value={s} className="text-xs">
                                  {STATUS_LABEL[s]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            disabled={busy === t.id}
                            onClick={() => excluir(t.id)}
                            title="Excluir"
                          >
                            {busy === t.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
