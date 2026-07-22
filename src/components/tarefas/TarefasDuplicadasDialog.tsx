import * as React from "react";
import { Copy, Loader2, Trash2, AlertTriangle, Sparkles, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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

async function deleteInChunks(ids: string[]): Promise<{ deleted: number; error: string | null }> {
  const chunkSize = 100;
  let deleted = 0;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const slice = ids.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("todo")
      .delete()
      .in("id", slice)
      .select("id");
    if (error) return { deleted, error: error.message };
    deleted += (data ?? []).length;
  }
  return { deleted, error: null };
}

export function TarefasDuplicadasDialog({ tarefas }: { tarefas: TarefaRow[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const grupos = React.useMemo(() => agrupar(tarefas), [tarefas]);
  const totalDup = grupos.reduce((n, g) => n + g.tarefas.length, 0);

  // Limpar seleção quando fecha ou muda a lista
  React.useEffect(() => {
    if (!open) setSelected(new Set());
  }, [open]);

  const refresh = () => qc.invalidateQueries({ queryKey: qk.tarefas.all() });

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGrupo = (g: Grupo, mode: "all" | "exceptFirst") => {
    setSelected((prev) => {
      const next = new Set(prev);
      const ids = mode === "all" ? g.tarefas.map((t) => t.id) : g.tarefas.slice(1).map((t) => t.id);
      const allIn = ids.every((id) => next.has(id));
      if (allIn) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const selecionarTodasExcetoMaisRecente = () => {
    const ids = new Set<string>();
    for (const g of grupos) g.tarefas.slice(1).forEach((t) => ids.add(t.id));
    setSelected(ids);
  };

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
    const { data, error } = await supabase
      .from("todo")
      .delete()
      .eq("id", id)
      .select("id");
    setBusy(null);
    if (error) return toast.error("Erro ao excluir", { description: error.message });
    if (!data || data.length === 0) {
      return toast.error("Nada foi excluído", {
        description: "Sem permissão ou tarefa já removida.",
      });
    }
    toast.success("Tarefa removida");
    refresh();
  };

  const excluirSelecionadas = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`Excluir ${ids.length} tarefa(s) selecionada(s)? Esta ação não pode ser desfeita.`)) return;
    setBulkBusy(true);
    const { deleted, error } = await deleteInChunks(ids);
    setBulkBusy(false);
    if (error) {
      toast.error("Erro ao excluir em massa", { description: error });
    } else if (deleted === 0) {
      toast.error("Nenhuma tarefa foi excluída", {
        description: "Verifique suas permissões.",
      });
    } else if (deleted < ids.length) {
      toast.warning(`${deleted} de ${ids.length} excluída(s)`, {
        description: "Algumas não puderam ser removidas (permissão ou já apagadas).",
      });
    } else {
      toast.success(`${deleted} tarefa(s) excluída(s)`);
    }
    setSelected(new Set());
    refresh();
  };

  const manterMaisRecente = async (g: Grupo) => {
    if (g.tarefas.length < 2) return;
    const [manter, ...remover] = g.tarefas;
    if (!confirm(
      `Manter a versão mais recente (${format(new Date(manter.created_at), "dd/MM/yyyy")}) e excluir ${remover.length} duplicata(s)?`,
    )) return;
    setBusy(g.chave);
    const { deleted, error } = await deleteInChunks(remover.map((t) => t.id));
    setBusy(null);
    if (error) return toast.error("Erro ao remover duplicatas", { description: error });
    if (deleted === 0) return toast.error("Nada foi excluído", { description: "Sem permissão." });
    toast.success(`${deleted} duplicata(s) removida(s)`);
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
            Agrupadas pelo <span className="font-medium">número da tarefa</span> (ex.: “Tarefa 12345”).
            Selecione várias e exclua de uma vez, ou use “Manter mais recente” em cada grupo.
          </DialogDescription>
        </DialogHeader>

        {grupos.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhuma duplicidade encontrada. 🎉
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
              <div className="text-xs text-muted-foreground">
                {grupos.length} grupo(s) • {totalDup} tarefa(s) envolvida(s)
                {selected.size > 0 && (
                  <span className="ml-2 font-medium text-foreground">
                    · {selected.size} selecionada(s)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={selecionarTodasExcetoMaisRecente}
                  disabled={bulkBusy}
                >
                  <CheckSquare className="mr-1.5 h-3 w-3" />
                  Selecionar antigas
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setSelected(new Set())}
                  disabled={bulkBusy || selected.size === 0}
                >
                  Limpar
                </Button>
              </div>
            </div>

            <div className="max-h-[55vh] space-y-3 overflow-auto pr-1">
              {grupos.map((g) => {
                const ids = g.tarefas.map((t) => t.id);
                const allChecked = ids.every((id) => selected.has(id));
                const someChecked = ids.some((id) => selected.has(id));
                return (
                  <div key={g.chave} className="rounded-lg border bg-card">
                    <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Checkbox
                          checked={allChecked ? true : someChecked ? "indeterminate" : false}
                          onCheckedChange={() => toggleGrupo(g, "all")}
                          aria-label="Selecionar grupo"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {g.numero && (
                              <Badge variant="outline" className="h-5 px-1.5 font-mono text-[10px]">
                                #{g.numero}
                              </Badge>
                            )}
                            <p className="truncate text-sm font-medium">{g.titulo}</p>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {g.tarefas.length} ocorrências
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => toggleGrupo(g, "exceptFirst")}
                          disabled={bulkBusy}
                          title="Marca todas exceto a mais recente"
                        >
                          Antigas
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={busy === g.chave || bulkBusy}
                          onClick={() => manterMaisRecente(g)}
                          title="Mantém a mais recente e exclui as demais"
                        >
                          {busy === g.chave ? (
                            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                          ) : (
                            <Sparkles className="mr-1.5 h-3 w-3" />
                          )}
                          Manter recente
                        </Button>
                      </div>
                    </div>
                    <ul className="divide-y">
                      {g.tarefas.map((t, i) => (
                        <li
                          key={t.id}
                          className="flex flex-wrap items-center gap-2 px-3 py-2"
                        >
                          <Checkbox
                            checked={selected.has(t.id)}
                            onCheckedChange={() => toggle(t.id)}
                            aria-label="Selecionar tarefa"
                          />
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
                              disabled={busy === t.id || bulkBusy}
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
                              disabled={busy === t.id || bulkBusy}
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
                );
              })}
            </div>

            <DialogFooter className="sm:justify-between">
              <p className="text-[11px] text-muted-foreground">
                A exclusão é confirmada pelo servidor. Se sua conta não tiver permissão, a tarefa
                não é apagada e um aviso aparece.
              </p>
              <Button
                variant="destructive"
                disabled={selected.size === 0 || bulkBusy}
                onClick={excluirSelecionadas}
                className="gap-2"
              >
                {bulkBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Excluir selecionadas ({selected.size})
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
