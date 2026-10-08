import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Rocket } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/KpiTile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { qk } from "@/lib/queries/keys";
import { cn } from "@/lib/utils";
import type { TarefaRow } from "@/lib/db-types";
import { registrarMudancaStatus } from "@/components/tarefas/lib/historico";
import type { Aguardando } from "./lib/central";

/** Dias de espera a partir dos quais a tarefa chama atenção (a mediana medida em 01/10 era 7). */
const ALERTA_DIAS = 7;

function DiasBadge({ dias }: { dias: number | null }) {
  if (dias === null) {
    return (
      <span
        className="text-[11px] text-muted-foreground"
        title="Movida antes de 08/10/2026, quando a mudança em lote não gravava histórico"
      >
        sem registro
      </span>
    );
  }
  return (
    <Badge
      variant="outline"
      className={cn(
        "tabular-nums",
        dias >= ALERTA_DIAS * 2
          ? "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400"
          : dias >= ALERTA_DIAS
            ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
            : "text-muted-foreground",
      )}
    >
      {dias === 0 ? "hoje" : `${dias} dia${dias === 1 ? "" : "s"}`}
    </Badge>
  );
}

/**
 * Tarefas enviadas (Pré-build) que esperam o desenvolvimento subir para produção (E2).
 * Marcar "Subiu para produção" em lote grava o histórico de cada tarefa.
 */
export function AguardandoProducaoPanel({
  itens,
  onOpen,
  tv = false,
}: {
  itens: Aguardando<TarefaRow>[];
  onOpen: (t: TarefaRow) => void;
  tv?: boolean;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = React.useState(false);
  const [gravando, setGravando] = React.useState(false);

  // Some da seleção o que saiu de Pré-build (ex.: movido no Kanban por outra pessoa).
  React.useEffect(() => {
    const ids = new Set(itens.map((i) => i.tarefa.id));
    setSel((prev) => {
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [itens]);

  const todas = itens.length > 0 && sel.size === itens.length;
  const alternar = (id: string, v: boolean) =>
    setSel((prev) => {
      const next = new Set(prev);
      if (v) next.add(id);
      else next.delete(id);
      return next;
    });

  const subir = async () => {
    if (!user || sel.size === 0) return;
    setGravando(true);
    const ids = [...sel];
    const { error } = await supabase
      .from("todo")
      .update({ status: "producao", concluida_em: new Date().toISOString() })
      .in("id", ids);
    if (error) {
      setGravando(false);
      toast.error("Não foi possível marcar como em produção", { description: error.message });
      return;
    }
    const erroHist = await registrarMudancaStatus(
      user,
      ids.map((id) => ({ id, de: "pre_build" })),
      "producao",
    );
    setGravando(false);
    setConfirmando(false);
    setSel(new Set());
    if (erroHist)
      toast.warning("Tarefas em Produção, mas o histórico não foi salvo", {
        description: erroHist.message,
      });
    else toast.success(`${ids.length} tarefa${ids.length === 1 ? "" : "s"} em Produção`);
    qc.invalidateQueries({ queryKey: qk.tarefas.all() });
  };

  const comDias = itens.filter((i) => i.dias !== null);
  const maisAntiga = comDias[0]?.dias ?? null;

  return (
    <Panel
      title="Aguardando produção"
      hint="Tarefas em Pré-build: já enviadas, esperando o desenvolvimento subir a versão. Dias contados desde a entrada em Pré-build."
      actions={
        !tv && itens.length > 0 ? (
          <Button
            size="sm"
            className="h-8 gap-1.5"
            disabled={sel.size === 0}
            onClick={() => setConfirmando(true)}
          >
            <Rocket className="h-3.5 w-3.5" />
            Subiu para produção{sel.size > 0 ? ` (${sel.size})` : ""}
          </Button>
        ) : undefined
      }
    >
      {itens.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">Nada esperando produção.</p>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            {!tv ? (
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={todas}
                  onCheckedChange={(v) =>
                    setSel(v ? new Set(itens.map((i) => i.tarefa.id)) : new Set())
                  }
                  aria-label="Selecionar todas"
                />
                Selecionar todas ({itens.length})
              </label>
            ) : (
              <span>{itens.length} tarefas</span>
            )}
            {maisAntiga !== null && (
              <span>
                mais antiga: {maisAntiga} dia{maisAntiga === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <ul className={cn("space-y-1 overflow-y-auto pr-1", tv ? "max-h-[28rem]" : "max-h-80")}>
            {itens.map(({ tarefa, dias, desde }) => (
              <li
                key={tarefa.id}
                className="flex items-center gap-2 rounded-lg border bg-muted/10 px-2.5 py-1.5"
              >
                {!tv && (
                  <Checkbox
                    checked={sel.has(tarefa.id)}
                    onCheckedChange={(v) => alternar(tarefa.id, !!v)}
                    aria-label={`Selecionar ${tarefa.titulo}`}
                  />
                )}
                <button
                  type="button"
                  onClick={() => onOpen(tarefa)}
                  disabled={tv}
                  className="min-w-0 flex-1 truncate text-left text-sm hover:underline disabled:no-underline"
                  title={desde ? `Em Pré-build desde ${format(desde, "dd/MM/yyyy")}` : undefined}
                >
                  {tarefa.titulo}
                </button>
                {tarefa.sistema && (
                  <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">
                    {tarefa.sistema}
                  </Badge>
                )}
                <DiasBadge dias={dias} />
              </li>
            ))}
          </ul>
        </>
      )}

      <AlertDialog open={confirmando} onOpenChange={(v) => !gravando && setConfirmando(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Marcar {sel.size} tarefa{sel.size === 1 ? "" : "s"} como em Produção?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Saem de Pré-build e vão para Produção, com a data de hoje como conclusão. A mudança
              fica no histórico de cada tarefa e pode ser desfeita no Kanban.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={gravando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={gravando}
              onClick={(e) => {
                e.preventDefault();
                void subir();
              }}
            >
              {gravando && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Subiu para produção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
}
