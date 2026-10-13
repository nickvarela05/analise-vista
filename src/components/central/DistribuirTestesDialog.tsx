import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queries/keys";
import { cn } from "@/lib/utils";
import type { TarefaRow } from "@/lib/db-types";
import { agruparPorPessoa, distribuirIguais, distribuirPorSistema } from "./lib/distribuir";

const NINGUEM = "__ninguem__";
const SEM_SISTEMA = "";

type Colab = { id: string; nome: string };

function temResponsavel(t: TarefaRow) {
  return t.equipe_toda || (t.responsaveis_ids ?? []).length > 0 || !!t.responsavel_id;
}

/**
 * Distribui as tarefas a testar entre os analistas de uma vez (T1, fase 2 do layout):
 * em partes iguais ou por sistema, com prévia editável antes de gravar.
 */
export function DistribuirTestesDialog({
  aTestar,
  colabs,
}: {
  aTestar: TarefaRow[];
  colabs: Colab[];
}) {
  const qc = useQueryClient();
  const [aberto, setAberto] = React.useState(false);
  const [escopo, setEscopo] = React.useState<"sem" | "todas">("sem");
  const [modo, setModo] = React.useState<"iguais" | "sistema">("iguais");
  const [pessoas, setPessoas] = React.useState<string[]>([]);
  const [mapa, setMapa] = React.useState<Record<string, string>>({});
  const [ajustes, setAjustes] = React.useState<Record<string, string>>({});
  const [gravando, setGravando] = React.useState(false);

  const semResp = React.useMemo(() => aTestar.filter((t) => !temResponsavel(t)), [aTestar]);
  const lista = escopo === "sem" ? semResp : aTestar;
  const sistemas = React.useMemo(
    () => [...new Set(lista.map((t) => t.sistema ?? SEM_SISTEMA))].sort(),
    [lista],
  );
  const nome = React.useMemo(() => new Map(colabs.map((c) => [c.id, c.nome])), [colabs]);

  // Ao abrir: escopo "sem responsável" se houver alguma, senão "todas"; prévia limpa.
  React.useEffect(() => {
    if (!aberto) return;
    setEscopo(semResp.length > 0 ? "sem" : "todas");
    setAjustes({});
  }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps

  const automatica = React.useMemo(
    () =>
      modo === "iguais" ? distribuirIguais(lista, pessoas) : distribuirPorSistema(lista, mapa),
    [modo, lista, pessoas, mapa],
  );
  const final = React.useMemo(() => {
    const r: Record<string, string> = {};
    for (const t of lista) {
      const p = ajustes[t.id] ?? automatica[t.id];
      if (p && p !== NINGUEM) r[t.id] = p;
    }
    return r;
  }, [lista, ajustes, automatica]);
  const total = Object.keys(final).length;

  const alternarPessoa = (id: string, v: boolean) =>
    setPessoas((prev) => (v ? [...prev, id] : prev.filter((p) => p !== id)));

  const gravar = async () => {
    setGravando(true);
    try {
      // Um update por pessoa. A notificação sai agrupada por pessoa (ver migração da fase 2).
      let gravadas = 0;
      for (const [pessoa, ids] of Object.entries(agruparPorPessoa(final))) {
        const { data, error } = await supabase
          .from("todo")
          .update({ responsaveis_ids: [pessoa] })
          .in("id", ids)
          .select("id");
        if (error) throw error;
        gravadas += data?.length ?? 0;
      }
      // A permissão de alterar tarefa é de gestor, criador ou responsável: sem ela o banco não
      // grava e também não dá erro. Por isso a conferência pela quantidade devolvida.
      if (gravadas < total) {
        toast.warning(`${gravadas} de ${total} tarefas distribuídas`, {
          description:
            "As demais não foram alteradas: falta permissão para mudar o responsável delas.",
        });
      } else {
        toast.success(
          `${total} tarefa${total === 1 ? "" : "s"} distribuída${total === 1 ? "" : "s"}`,
        );
      }
      await qc.invalidateQueries({ queryKey: qk.tarefas.all() });
      setAberto(false);
    } catch (e) {
      toast.error("Não foi possível distribuir", { description: (e as Error).message });
    } finally {
      setGravando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !gravando && setAberto(v)}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 gap-1.5" disabled={aTestar.length === 0}>
          <Users className="h-3.5 w-3.5" />
          Distribuir testes
          {semResp.length > 0 && (
            <span className="rounded-full bg-amber-500/15 px-1.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
              {semResp.length}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>Distribuir testes</DialogTitle>
          <DialogDescription>
            Escolha quem testa. A prévia abaixo pode ser ajustada tarefa a tarefa antes de gravar.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Tarefas:</span>
            <Tabs
              value={escopo}
              onValueChange={(v) => {
                setEscopo(v as "sem" | "todas");
                setAjustes({});
              }}
            >
              <TabsList className="h-8">
                <TabsTrigger value="sem" className="text-xs" disabled={semResp.length === 0}>
                  Sem responsável ({semResp.length})
                </TabsTrigger>
                <TabsTrigger value="todas" className="text-xs">
                  Todas a testar ({aTestar.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Como:</span>
            <Tabs
              value={modo}
              onValueChange={(v) => {
                setModo(v as "iguais" | "sistema");
                setAjustes({});
              }}
            >
              <TabsList className="h-8">
                <TabsTrigger value="iguais" className="text-xs">
                  Partes iguais
                </TabsTrigger>
                <TabsTrigger value="sistema" className="text-xs">
                  Por sistema
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {modo === "iguais" ? (
            <div>
              <p className="mb-1.5 text-xs text-muted-foreground">
                Quem testa (as tarefas do mesmo sistema ficam juntas sempre que der):
              </p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {colabs.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={pessoas.includes(c.id)}
                      onCheckedChange={(v) => {
                        alternarPessoa(c.id, v === true);
                        setAjustes({});
                      }}
                    />
                    <span className="truncate">{c.nome}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Quem testa cada sistema:</p>
              {sistemas.map((s) => (
                <div key={s || "sem"} className="flex items-center gap-2">
                  <span className="w-40 shrink-0 truncate text-sm">{s || "Sem sistema"}</span>
                  <Select
                    value={mapa[s] || NINGUEM}
                    onValueChange={(v) => {
                      setMapa((m) => ({ ...m, [s]: v === NINGUEM ? "" : v }));
                      setAjustes({});
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NINGUEM}>— Ninguém —</SelectItem>
                      {colabs.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Prévia ({total} de {lista.length})
            </p>
            <ul className="space-y-1">
              {lista.map((t) => {
                const p = ajustes[t.id] ?? automatica[t.id] ?? NINGUEM;
                return (
                  <li key={t.id} className="flex items-center gap-2 rounded-md border px-2 py-1">
                    <span className="min-w-0 flex-1 truncate text-sm" title={t.titulo}>
                      {t.titulo}
                    </span>
                    {t.sistema && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {t.sistema}
                      </span>
                    )}
                    <Select
                      value={p}
                      onValueChange={(v) => setAjustes((a) => ({ ...a, [t.id]: v }))}
                    >
                      <SelectTrigger
                        className={cn(
                          "h-7 w-40 shrink-0 text-xs",
                          p === NINGUEM && "text-muted-foreground",
                        )}
                      >
                        <SelectValue>{p === NINGUEM ? "—" : nome.get(p)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NINGUEM}>— Ninguém —</SelectItem>
                        {colabs.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2">
          {escopo === "todas" && (
            <p className="mr-auto self-center text-[11px] text-amber-600 dark:text-amber-400">
              Quem já tinha responsável passa para a pessoa da prévia.
            </p>
          )}
          <Button variant="outline" onClick={() => setAberto(false)} disabled={gravando}>
            Cancelar
          </Button>
          <Button onClick={gravar} disabled={gravando || total === 0}>
            {gravando && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Distribuir {total > 0 ? total : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
