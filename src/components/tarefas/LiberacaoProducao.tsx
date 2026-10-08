import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle2, Circle, Loader2, Rocket, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { qk } from "@/lib/queries/keys";
import { cn } from "@/lib/utils";
import type { TarefaRow } from "@/lib/db-types";
import { confirmarLiberacao, etapasLiberacao, type EtapaLiberacao } from "./lib/liberacao";

/**
 * Bloco "Liberação em produção" da tarefa (Pré-build e Produção): versão publicada, acessos
 * liberados (objetos e grupos) e validada em produção, cada um com quem confirmou e quando.
 */
export function LiberacaoProducao({ tarefa }: { tarefa: TarefaRow }) {
  const qc = useQueryClient();
  const [objetos, setObjetos] = React.useState(tarefa.liberacao_objetos ?? "");
  const [dispensada, setDispensada] = React.useState(tarefa.liberacao_acesso_dispensada);
  const [gravando, setGravando] = React.useState<EtapaLiberacao | null>(null);

  React.useEffect(() => {
    setObjetos(tarefa.liberacao_objetos ?? "");
    setDispensada(tarefa.liberacao_acesso_dispensada);
  }, [tarefa.id, tarefa.liberacao_objetos, tarefa.liberacao_acesso_dispensada]);

  const etapas = etapasLiberacao(tarefa);
  const naoAplica = !["pre_build", "producao"].includes(tarefa.status);

  const executar = async (etapa: EtapaLiberacao, marcar: boolean) => {
    setGravando(etapa);
    try {
      const r = await confirmarLiberacao([tarefa.id], etapa, {
        marcar,
        objetos: etapa === "acesso" ? objetos : undefined,
        dispensada: etapa === "acesso" ? dispensada : undefined,
      });
      if (r.em_producao > 0) toast.success("Liberação completa: a tarefa foi para Produção");
      // Segura o botão até a tarefa recarregada chegar. Sem isso, no teste de 08/10 o botão
      // voltou antes da tela mostrar a confirmação e a etapa foi confirmada duas vezes.
      await qc.invalidateQueries({ queryKey: qk.tarefas.all() });
    } catch (e) {
      toast.error("Não foi possível salvar", { description: (e as Error).message });
    } finally {
      setGravando(null);
    }
  };

  if (naoAplica) return null;

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-violet-500/25 bg-violet-500/5 p-3">
      <div className="flex items-center gap-2">
        <Rocket className="h-4 w-4 text-violet-500" />
        <p className="text-xs font-semibold uppercase tracking-wider">Liberação em produção</p>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {etapas.filter((e) => e.feita).length} de 3
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        A tarefa só vai para Produção com as três confirmações, e vai sozinha quando a última é
        feita.
      </p>

      <ol className="space-y-2.5">
        {etapas.map((e, i) => {
          const bloqueada = i > 0 && !etapas[i - 1].feita && !e.feita;
          return (
            <li key={e.etapa} className="rounded-md border bg-background/60 p-2.5">
              <div className="flex items-start gap-2">
                {e.feita ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", e.feita && "font-medium")}>{e.rotulo}</p>
                  {e.feita && e.em && (
                    <p className="text-[11px] text-muted-foreground">
                      {e.por} · {format(new Date(e.em), "dd/MM/yyyy HH:mm")}
                    </p>
                  )}
                  {e.etapa === "acesso" && e.feita && tarefa.liberacao_objetos && (
                    <p className="mt-1 whitespace-pre-wrap rounded bg-muted/40 px-2 py-1 text-xs">
                      {tarefa.liberacao_objetos}
                    </p>
                  )}
                </div>
                {e.feita ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 text-xs text-muted-foreground"
                    disabled={!!gravando}
                    onClick={() => executar(e.etapa, false)}
                    title="Desfazer esta confirmação"
                  >
                    {gravando === e.etapa ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Undo2 className="h-3 w-3" />
                    )}
                    Desfazer
                  </Button>
                ) : e.etapa !== "acesso" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={!!gravando || bloqueada}
                    title={bloqueada ? "Confirme a etapa anterior primeiro" : undefined}
                    onClick={() => executar(e.etapa, true)}
                  >
                    {gravando === e.etapa && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                    Confirmar
                  </Button>
                ) : null}
              </div>

              {e.etapa === "acesso" && !e.feita && (
                <div
                  className={cn(
                    "mt-2 space-y-2 pl-6",
                    bloqueada && "pointer-events-none opacity-50",
                  )}
                >
                  <Textarea
                    value={objetos}
                    onChange={(ev) => setObjetos(ev.target.value)}
                    disabled={dispensada}
                    placeholder="Objetos e grupos de usuários liberados (ver “Versões do sistema” no GED e o E-project)"
                    className="min-h-16 text-xs"
                  />
                  <label className="flex cursor-pointer items-center gap-2 text-xs">
                    <Checkbox
                      checked={dispensada}
                      onCheckedChange={(v) => setDispensada(v === true)}
                    />
                    Esta tarefa não precisa de liberação de acesso
                  </label>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={!!gravando || bloqueada || (!dispensada && !objetos.trim())}
                    onClick={() => executar("acesso", true)}
                  >
                    {gravando === "acesso" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                    Confirmar
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
