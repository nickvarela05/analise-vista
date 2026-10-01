import * as React from "react";
import {
  Inbox,
  Loader2,
  AlertTriangle,
  Plus,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  ClipboardPaste,
} from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queries/keys";
import { fetchAllRows } from "@/lib/queries/fetch-all";
import { cn, getErrorMessage } from "@/lib/utils";
import { STATUS_LABEL, normalizeStatus } from "@/components/tarefas/lib/workflow";
import { extractTaskNumber } from "@/components/tarefas/lib/taskNumber";
import {
  parseEmailHomologacao,
  tabelaHtmlParaTsv,
  type ItemEmailHml,
} from "@/components/tarefas/lib/emailHomologacao";

/**
 * Recebimento de um pacote de homologação a partir do e-mail do desenvolvimento.
 *
 * Fluxo (definido com o Nickolas em 01/10/2026): colar a tabela do e-mail, conferir e
 * confirmar. A planilha do E-project deixou de ser necessária. Cada tarefa do e-mail cai em
 * uma de quatro situações, e nenhuma delas cria card duplicado:
 *  - nova        não existe no Nexus: entra em Homologação;
 *  - mover       já existe e ainda não foi testada (stand-by, encerrada): o mesmo card vai
 *                para Homologação;
 *  - em_rodada   já está em teste (homologação, aprovada, com ressalvas, reprovada): fica
 *                como está, a menos que se escolha retestar;
 *  - subiu       já está em pré-build ou produção (o dev pode ter mandado por engano): não é
 *                mexida sem decisão explícita.
 * A gravação é uma chamada só (`receber_pacote_homologacao`): ou entra tudo, ou nada.
 */

type Existente = { id: string; titulo: string; status: string };
type Situacao = "nova" | "mover" | "em_rodada" | "subiu";
type Linha = { item: ItemEmailHml; situacao: Situacao; existente?: Existente };
type Resultado = { criadas: number; movidas: number; atualizadas: number; conferir: Linha[] };

const EM_RODADA = new Set(["homologacao", "aprovado", "aprovado_ressalvas", "reprovado"]);
const SUBIU = new Set(["pre_build", "producao"]);

function situacaoDe(status: string): Situacao {
  const s = normalizeStatus(status);
  if (EM_RODADA.has(s)) return "em_rodada";
  if (SUBIU.has(s)) return "subiu";
  return "mover"; // stand-by e encerrada
}

function tituloDe(i: ItemEmailHml): string {
  return (i.tarefa ? `Tarefa ${i.numero} - ${i.tarefa}` : `Tarefa ${i.numero}`).slice(0, 200);
}

const GRUPOS: Record<
  Situacao,
  { titulo: string; icone: typeof Plus; borda: string; selo: string }
> = {
  nova: {
    titulo: "Novas no Nexus",
    icone: Plus,
    borda: "border-border",
    selo: "bg-success/15 text-success border-success/30",
  },
  mover: {
    titulo: "Já existem, ainda não testadas",
    icone: ArrowRight,
    borda: "border-border",
    selo: "bg-success/15 text-success border-success/30",
  },
  em_rodada: {
    titulo: "Já estão em teste",
    icone: RefreshCw,
    borda: "border-warning/50",
    selo: "bg-warning/20 text-warning border-warning/40",
  },
  subiu: {
    titulo: "Já subiram: conferir com o desenvolvimento",
    icone: AlertTriangle,
    borda: "border-destructive/50",
    selo: "bg-destructive/15 text-destructive border-destructive/30",
  },
};

export function ReceberPacoteDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [passo, setPasso] = React.useState<1 | 2 | 3>(1);
  const [texto, setTexto] = React.useState("");
  const [nomeLote, setNomeLote] = React.useState("");
  const [descricao, setDescricao] = React.useState("");
  const [existentes, setExistentes] = React.useState<Existente[] | null>(null);
  const [erroCarga, setErroCarga] = React.useState<string | null>(null);
  // Números marcados para voltar a Homologação (retestar / reabrir). O padrão é não mexer.
  const [voltar, setVoltar] = React.useState<Set<string>>(new Set());
  const [gravando, setGravando] = React.useState(false);
  const [resultado, setResultado] = React.useState<Resultado | null>(null);

  const reset = () => {
    setPasso(1);
    setTexto("");
    setNomeLote("");
    setDescricao("");
    setExistentes(null);
    setErroCarga(null);
    setVoltar(new Set());
    setResultado(null);
  };

  React.useEffect(() => {
    if (!open) return;
    setNomeLote(`HML – ${format(new Date(), "dd/MM/yyyy")}`);
    // Todas as tarefas (paginado): a conferência de duplicidade precisa enxergar as ~9 mil.
    fetchAllRows<Existente>((from, to) =>
      supabase.from("todo").select("id, titulo, status").order("id").range(from, to),
    )
      .then(setExistentes)
      .catch((e) => setErroCarga(getErrorMessage(e)));
  }, [open]);

  const email = React.useMemo(() => parseEmailHomologacao(texto), [texto]);

  const porNumero = React.useMemo(() => {
    const m = new Map<string, Existente>();
    for (const e of existentes ?? []) {
      const n = extractTaskNumber(e.titulo);
      if (n && !m.has(n)) m.set(n, e);
    }
    return m;
  }, [existentes]);

  const linhas = React.useMemo<Linha[]>(
    () =>
      email.itens.map((item) => {
        const existente = porNumero.get(item.numero);
        return existente
          ? { item, existente, situacao: situacaoDe(existente.status) }
          : { item, situacao: "nova" };
      }),
    [email, porNumero],
  );

  const grupo = (s: Situacao) => linhas.filter((l) => l.situacao === s);
  const entraNoLote = (l: Linha) =>
    l.situacao === "nova" || l.situacao === "mover" || voltar.has(l.item.numero);
  const totalLote = linhas.filter(entraNoLote).length;
  const mantidas = linhas.length - totalLote;

  const alternar = (numero: string) =>
    setVoltar((prev) => {
      const next = new Set(prev);
      if (next.has(numero)) next.delete(numero);
      else next.add(numero);
      return next;
    });

  const receber = async () => {
    setGravando(true);
    const itens = linhas
      // "Já subiu" e mantida: não é tocada de forma nenhuma.
      .filter((l) => !(l.situacao === "subiu" && !voltar.has(l.item.numero)))
      .map((l) => ({
        acao: l.situacao === "nova" ? "criar" : entraNoLote(l) ? "mover" : "dados",
        numero: l.item.numero,
        id: l.existente?.id ?? null,
        titulo: tituloDe(l.item),
        sistema: l.item.sistema,
        link: l.item.link,
        observacao: l.item.observacao,
        data: l.item.dataHml,
      }));

    const { data, error } = await supabase.rpc("receber_pacote_homologacao", {
      p_nome: nomeLote,
      p_descricao: descricao || null,
      p_itens: itens,
    });
    setGravando(false);
    if (error) {
      toast.error("Não foi possível receber o pacote", { description: error.message });
      return;
    }
    const r = (data ?? {}) as { criadas?: number; movidas?: number; atualizadas?: number };
    setResultado({
      criadas: r.criadas ?? 0,
      movidas: r.movidas ?? 0,
      atualizadas: r.atualizadas ?? 0,
      conferir: linhas.filter((l) => l.situacao === "subiu" && !voltar.has(l.item.numero)),
    });
    setPasso(3);
    qc.invalidateQueries({ queryKey: qk.tarefas.all() });
    qc.invalidateQueries({ queryKey: ["tarefas", "lotes"] });
    qc.invalidateQueries({ queryKey: qk.dash.tarefas() });
  };

  const podeConferir = email.itens.length > 0 && existentes !== null;
  // Só tarefas que já subiram, todas mantidas: não há o que gravar.
  const nadaAGravar = linhas.every((l) => l.situacao === "subiu" && !voltar.has(l.item.numero));

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Inbox className="mr-2 h-4 w-4" /> Receber pacote
        </Button>
      </DialogTrigger>
      {/* Altura limitada à tela, com rolagem só no miolo: o rodapé com os botões fica sempre
          visível, em qualquer zoom. */}
      <DialogContent className="flex max-h-[90dvh] max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 border-b px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
            <DialogTitle>Receber pacote de homologação</DialogTitle>
            <ol className="flex items-center gap-1.5 text-[11px]">
              {["Colar e-mail", "Conferir", "Pronto"].map((nome, i) => (
                <li
                  key={nome}
                  className={cn(
                    "rounded-md border px-2 py-0.5",
                    passo === i + 1
                      ? "border-primary/40 bg-primary/15 font-medium text-primary"
                      : passo > i + 1
                        ? "border-success/30 bg-success/10 text-success"
                        : "text-muted-foreground",
                  )}
                >
                  {i + 1} {nome}
                </li>
              ))}
            </ol>
          </div>
          <DialogDescription>
            {passo === 1 && "Copie a tabela do e-mail do desenvolvimento e cole abaixo."}
            {passo === 2 &&
              `${linhas.length} tarefa(s) no e-mail. Nada é gravado até você confirmar.`}
            {passo === 3 && "Pacote recebido."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {passo === 1 && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="pacote-email" className="text-xs">
                  Tabela do e-mail
                </Label>
                <Textarea
                  id="pacote-email"
                  autoFocus
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onPaste={(e) => {
                    // O Outlook copia a tabela também em HTML; dali dá para recuperar as
                    // células mescladas (data e sistema que valem para várias linhas).
                    const html = e.clipboardData.getData("text/html");
                    const tsv = html ? tabelaHtmlParaTsv(html) : null;
                    if (tsv) {
                      e.preventDefault();
                      setTexto(tsv);
                    }
                  }}
                  placeholder="Selecione a tabela no e-mail, copie (Ctrl+C) e cole aqui (Ctrl+V)."
                  rows={9}
                  className="mt-1 font-mono text-[11px]"
                />
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <ClipboardPaste className="h-3.5 w-3.5" />
                  Pode vir com coluna a mais ou em outra ordem. Também aceita só os números.
                </p>
              </div>

              {texto.trim() && email.itens.length === 0 && (
                <p className="text-xs text-destructive">
                  Não encontrei números de tarefa no texto colado.
                </p>
              )}
              {email.itens.length > 0 && (
                <div className="rounded-md border">
                  <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium">
                    {email.itens.length} tarefa(s) lida(s)
                  </div>
                  <div className="max-h-56 overflow-auto">
                    <table className="w-full text-xs">
                      <tbody>
                        {email.itens.map((i) => (
                          <tr key={i.numero} className="border-b align-top last:border-0">
                            <td className="w-14 px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
                              {i.numero}
                            </td>
                            <td className="w-28 px-2 py-1.5 text-muted-foreground">{i.sistema ?? "—"}</td>
                            <td className="px-2 py-1.5">{i.tarefa ?? "—"}</td>
                            <td className="w-12 px-2 py-1.5 text-right text-[11px] text-muted-foreground">
                              {i.link ? "link" : ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {erroCarga && (
                <p className="text-xs text-destructive">
                  Não foi possível carregar as tarefas do Nexus para conferir duplicidade: {erroCarga}
                </p>
              )}
            </div>
          )}

          {passo === 2 && (
            <div className="space-y-3">
              {(["nova", "mover", "em_rodada", "subiu"] as const).map((s) => {
                const itens = grupo(s);
                if (itens.length === 0) return null;
                const g = GRUPOS[s];
                const Icone = g.icone;
                const decide = s === "em_rodada" || s === "subiu";
                return (
                  <section key={s} className={cn("rounded-md border", g.borda)}>
                    <header className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
                      <h3 className="flex items-center gap-2 text-sm font-medium">
                        <Icone className="h-4 w-4" /> {g.titulo}
                      </h3>
                      <Badge variant="outline" className={cn("text-[11px]", g.selo)}>
                        {itens.length} ·{" "}
                        {s === "nova"
                          ? "entram em Homologação"
                          : s === "mover"
                            ? "vão para Homologação"
                            : s === "em_rodada"
                              ? "ficam como estão, salvo retestar"
                              : "não são mexidas, salvo reabrir"}
                      </Badge>
                    </header>
                    <ul className="max-h-52 divide-y overflow-auto text-xs">
                      {itens.map((l) => {
                        const marcada = voltar.has(l.item.numero);
                        const jaEmHml = l.existente?.status === "homologacao";
                        return (
                          <li
                            key={l.item.numero}
                            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-1.5"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="font-mono text-[11px] text-muted-foreground">
                                {l.item.numero}
                              </span>{" "}
                              {l.item.tarefa ?? l.existente?.titulo ?? ""}
                              {l.item.sistema && (
                                <Badge variant="outline" className="ml-2 text-[10px]">
                                  {l.item.sistema}
                                </Badge>
                              )}
                              {l.existente && (
                                <span className="ml-2 text-[11px] text-muted-foreground">
                                  hoje: {STATUS_LABEL[l.existente.status] ?? l.existente.status}
                                </span>
                              )}
                            </span>
                            {decide && !jaEmHml && (
                              <span className="flex shrink-0 gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={marcada ? "outline" : "secondary"}
                                  className="h-6 px-2 text-[11px]"
                                  onClick={() => marcada && alternar(l.item.numero)}
                                >
                                  {s === "subiu" ? "Deixar como está" : "Manter"}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={marcada ? "secondary" : "outline"}
                                  className="h-6 px-2 text-[11px]"
                                  onClick={() => !marcada && alternar(l.item.numero)}
                                >
                                  {s === "subiu" ? "Reabrir para teste" : "Retestar"}
                                </Button>
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="pacote-nome" className="text-xs">
                    Nome do lote
                  </Label>
                  <Input
                    id="pacote-nome"
                    value={nomeLote}
                    onChange={(e) => setNomeLote(e.target.value)}
                    maxLength={120}
                    className="mt-1 h-8 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="pacote-descricao" className="text-xs">
                    Observação do lote (opcional)
                  </Label>
                  <Input
                    id="pacote-descricao"
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    maxLength={500}
                    className="mt-1 h-8 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {passo === 3 && resultado && (
            <div className="space-y-3 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-5 w-5 text-success" />
                {resultado.criadas + resultado.movidas} tarefa(s) em Homologação, marcadas “em teste”.
              </p>
              <ul className="list-disc space-y-0.5 pl-6 text-xs text-muted-foreground">
                <li>{resultado.criadas} nova(s) criada(s)</li>
                <li>{resultado.movidas} já existente(s) movida(s) para Homologação</li>
                {resultado.atualizadas > 0 && (
                  <li>{resultado.atualizadas} mantida(s) no status atual, com os dados do e-mail atualizados</li>
                )}
              </ul>
              {resultado.conferir.length > 0 && (
                <div className="rounded-md border border-destructive/50 p-3 text-xs">
                  <p className="flex items-center gap-2 font-medium">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    Conferir com o desenvolvimento: vieram no e-mail, mas já tinham subido
                  </p>
                  <ul className="mt-1.5 space-y-0.5">
                    {resultado.conferir.map((l) => (
                      <li key={l.item.numero}>
                        <span className="font-mono">{l.item.numero}</span> ·{" "}
                        {STATUS_LABEL[l.existente!.status] ?? l.existente!.status}
                        {l.item.tarefa ? ` · ${l.item.tarefa}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
          <span className="text-xs text-muted-foreground">
            {passo === 1 && existentes === null && !erroCarga && "Carregando as tarefas do Nexus…"}
            {passo === 2 &&
              `${totalLote} entram no lote${mantidas > 0 ? ` · ${mantidas} ficam como estão` : ""}`}
          </span>
          <span className="flex gap-2">
            {passo === 1 && (
              <>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => setPasso(2)} disabled={!podeConferir}>
                  Conferir {email.itens.length > 0 ? `(${email.itens.length})` : ""}
                </Button>
              </>
            )}
            {passo === 2 && (
              <>
                <Button variant="ghost" onClick={() => setPasso(1)} disabled={gravando}>
                  Voltar
                </Button>
                <Button onClick={receber} disabled={gravando || !nomeLote.trim() || nadaAGravar}>
                  {gravando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {totalLote > 0 ? `Receber ${totalLote} tarefa(s)` : "Atualizar dados"}
                </Button>
              </>
            )}
            {passo === 3 && <Button onClick={() => setOpen(false)}>Fechar</Button>}
          </span>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
