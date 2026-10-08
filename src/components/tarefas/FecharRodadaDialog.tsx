import * as React from "react";
import { Send, Loader2, Copy, Download, CheckCircle2, AlertTriangle } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { qk } from "@/lib/queries/keys";
import { cn, getErrorMessage } from "@/lib/utils";
import { isStaleChunkError, recarregarPorAtualizacao } from "@/lib/stale-build";
import type { TarefaRow } from "@/lib/db-types";
import { STATUS_LABEL } from "@/components/tarefas/lib/workflow";
import {
  STATUS_PRONTAS,
  STATUS_RODADA,
  montarHtmlEmail,
  montarLinhas,
  montarTextoEmail,
  type LinhaEnvio,
} from "@/components/tarefas/lib/fecharRodada";
import type { ColabMini, LoteMini } from "./useTarefasData";

/**
 * "Fechar rodada" (E1, 04/10/2026): passo de ENVIAR do processo de homologação.
 *  1. Escolher os lotes da rodada; aprovadas e com ressalvas entram, as que ainda estão em
 *     teste (homologação, reprovada) ficam de fora e continuam na rodada.
 *  2. Revisar e escrever a observação de cada tarefa (vai no e-mail e fica salva no card).
 *  3. Copiar o corpo do e-mail (tabela de verdade, no lugar dos prints) e baixar o Excel para
 *     anexar; o e-mail continua saindo do Outlook do Nickolas. Depois de enviar, marcar como
 *     enviadas: as tarefas vão para Pré-build.
 */

const SEM_LOTE = "__sem_lote";
const PRONTAS = new Set<string>(STATUS_PRONTAS);
const RODADA = new Set<string>(STATUS_RODADA);

const INTRO_PADRAO = "Bom dia, prezados,\n\nSegue abaixo a situação após os testes das tarefas em homologação.";
const FECHO_PADRAO = "Atenciosamente,";

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function gerarExcel(linhas: LinhaEnvio[], titulo: string): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Nexus";
  const ws = wb.addWorksheet("Tarefas", { views: [{ state: "frozen", ySplit: 2 }] });
  const colunas = [
    { h: "Número", w: 10 },
    { h: "Sistema", w: 18 },
    { h: "Tarefa", w: 60 },
    { h: "Status", w: 22 },
    { h: "Observação", w: 45 },
    { h: "Responsáveis pelo teste", w: 32 },
    { h: "Data de hml", w: 13 },
    { h: "Lote", w: 28 },
  ];
  ws.columns = colunas.map((c) => ({ width: c.w }));
  ws.mergeCells(1, 1, 1, colunas.length);
  const t = ws.getCell(1, 1);
  t.value = titulo;
  t.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
  t.alignment = { vertical: "middle" };
  ws.getRow(1).height = 24;

  const cab = ws.getRow(2);
  colunas.forEach((c, i) => {
    const cell = cab.getCell(i + 1);
    cell.value = c.h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
  });
  for (const l of linhas) {
    const row = ws.addRow([
      Number(l.numero) || l.numero,
      l.sistema,
      l.tarefa,
      l.statusLabel,
      l.observacao,
      l.responsaveis,
      l.dataHml,
      l.lote,
    ]);
    row.alignment = { vertical: "top", wrapText: true };
    if (l.status === "aprovado_ressalvas") {
      row.getCell(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
    }
  }
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2 + linhas.length, column: colunas.length } };
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function FecharRodadaDialog({
  tarefas,
  colabs,
  lotes,
}: {
  tarefas: TarefaRow[];
  colabs: ColabMini[];
  lotes: LoteMini[];
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [passo, setPasso] = React.useState<1 | 2 | 3>(1);
  const [lotesSel, setLotesSel] = React.useState<Set<string>>(new Set());
  const [observacoes, setObservacoes] = React.useState<Record<string, string>>({});
  const [intro, setIntro] = React.useState(INTRO_PADRAO);
  const [fecho, setFecho] = React.useState(FECHO_PADRAO);
  const [assunto, setAssunto] = React.useState("");
  const [gravando, setGravando] = React.useState(false);
  const [confirmando, setConfirmando] = React.useState(false);
  // Escolha do Nickolas (04/10/2026): manter a marca "em teste" por padrão, para as tarefas
  // recém-enviadas não se misturarem com as que já estavam em Pré-build esperando produção.
  const [tirarDeTeste, setTirarDeTeste] = React.useState(false);
  const [enviadas, setEnviadas] = React.useState<number | null>(null);
  const previewRef = React.useRef<HTMLDivElement>(null);

  const naRodada = React.useMemo(() => tarefas.filter((t) => RODADA.has(t.status)), [tarefas]);

  // Lotes com tarefa na rodada, do mais novo para o mais antigo.
  const opcoes = React.useMemo(() => {
    const porLote = new Map<string, { prontas: number; pendentes: number }>();
    for (const t of naRodada) {
      const k = t.lote_importacao_id ?? SEM_LOTE;
      const c = porLote.get(k) ?? { prontas: 0, pendentes: 0 };
      if (PRONTAS.has(t.status)) c.prontas++;
      else c.pendentes++;
      porLote.set(k, c);
    }
    const nome = new Map(lotes.map((l) => [l.id, l]));
    return Array.from(porLote.entries())
      .map(([id, c]) => ({
        id,
        nome: id === SEM_LOTE ? "Sem lote (movidas à mão)" : (nome.get(id)?.nome ?? "Lote"),
        criado: id === SEM_LOTE ? "" : (nome.get(id)?.created_at ?? ""),
        ...c,
      }))
      .sort((a, b) => b.criado.localeCompare(a.criado));
  }, [naRodada, lotes]);

  React.useEffect(() => {
    if (!open) return;
    // Começa com todos os lotes que têm alguma tarefa pronta.
    setLotesSel(new Set(opcoes.filter((o) => o.prontas > 0).map((o) => o.id)));
    setAssunto(`Situação após testes em homologação – ${format(new Date(), "dd/MM/yyyy")}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const reset = () => {
    setPasso(1);
    setObservacoes({});
    setIntro(INTRO_PADRAO);
    setFecho(FECHO_PADRAO);
    setConfirmando(false);
    setTirarDeTeste(false);
    setEnviadas(null);
  };

  const daRodada = naRodada.filter((t) => lotesSel.has(t.lote_importacao_id ?? SEM_LOTE));
  const prontas = daRodada.filter((t) => PRONTAS.has(t.status));
  const pendentes = daRodada.filter((t) => !PRONTAS.has(t.status));

  const nomeColab = React.useMemo(() => new Map(colabs.map((c) => [c.id, c.nome])), [colabs]);
  const nomeLote = React.useMemo(() => new Map(lotes.map((l) => [l.id, l.nome])), [lotes]);
  const linhas = React.useMemo(
    () => montarLinhas(prontas, nomeColab, nomeLote, observacoes),
    [prontas, nomeColab, nomeLote, observacoes],
  );
  const html = React.useMemo(() => montarHtmlEmail(intro, linhas, fecho), [intro, linhas, fecho]);
  const ressalvasSemObs = linhas.filter((l) => l.status === "aprovado_ressalvas" && !l.observacao);

  const copiarCorpo = async () => {
    const texto = montarTextoEmail(intro, linhas, fecho);
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([texto], { type: "text/plain" }),
        }),
      ]);
      toast.success("Corpo do e-mail copiado. No Outlook, cole com Ctrl+V.");
    } catch {
      // Navegador sem ClipboardItem: copia a prévia selecionada, que também leva a tabela.
      const el = previewRef.current;
      if (!el) return;
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      const ok = document.execCommand("copy");
      sel?.removeAllRanges();
      if (ok) toast.success("Corpo do e-mail copiado. No Outlook, cole com Ctrl+V.");
      else toast.error("Não foi possível copiar. Selecione a prévia com o mouse e copie (Ctrl+C).");
    }
  };

  const copiarAssunto = async () => {
    try {
      await navigator.clipboard.writeText(assunto);
      toast.success("Assunto copiado");
    } catch {
      toast.error("Não foi possível copiar o assunto");
    }
  };

  const baixarExcel = async () => {
    try {
      const blob = await gerarExcel(linhas, assunto);
      baixar(blob, `homologacao-envio-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    } catch (e) {
      if (isStaleChunkError(e) && recarregarPorAtualizacao()) return;
      toast.error("Não foi possível gerar o Excel", { description: getErrorMessage(e) });
    }
  };

  const marcarEnviadas = async () => {
    if (!user || linhas.length === 0) return;
    setGravando(true);
    const ids = linhas.map((l) => l.id);
    const { error } = await supabase
      .from("todo")
      .update(tirarDeTeste ? { status: "pre_build", em_teste: false } : { status: "pre_build" })
      .in("id", ids);
    if (error) {
      setGravando(false);
      toast.error("Não foi possível mover para Pré-build", { description: error.message });
      return;
    }
    const { data: perfil } = await supabase.from("profiles").select("nome").eq("user_id", user.id).maybeSingle();
    const autorNome = perfil?.nome ?? user.email ?? null;
    const hoje = format(new Date(), "dd/MM/yyyy");
    // O histórico de status é gravado pelo banco (gatilho trg_todo_registrar_status, 08/10/2026).
    // A observação é complementar: se falhar, o status já foi movido.
    const comObs = linhas.filter((l) => l.observacao);
    const { error: erroObs } =
      comObs.length === 0
        ? { error: null }
        : await supabase.from("todo_comentario").insert(
            comObs.map((l) => ({
              todo_id: l.id,
              autor_id: user.id,
              autor_nome: autorNome,
              conteudo: `Observação do teste (enviada em ${hoje}): ${l.observacao}`,
            })),
          );
    setGravando(false);
    if (erroObs) {
      toast.warning("Tarefas movidas para Pré-build, mas as observações não foram salvas", {
        description: erroObs.message,
      });
    }
    setEnviadas(ids.length);
    setConfirmando(false);
    qc.invalidateQueries({ queryKey: qk.tarefas.all() });
    qc.invalidateQueries({ queryKey: qk.dash.tarefas() });
  };

  const alternarLote = (id: string) =>
    setLotesSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
          <Send className="mr-2 h-4 w-4" /> Fechar rodada
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90dvh] max-w-4xl flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 border-b px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
            <DialogTitle>Fechar rodada de homologação</DialogTitle>
            <ol className="flex items-center gap-1.5 text-[11px]">
              {["Escolher", "Revisar", "Enviar"].map((nome, i) => (
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
            {passo === 1 && "Escolha os lotes desta rodada. Entram as aprovadas e as aprovadas com ressalvas."}
            {passo === 2 && "Escreva a observação de cada tarefa. Ela vai no e-mail e fica salva no card."}
            {passo === 3 && "Copie o corpo, baixe o Excel, envie pelo Outlook e depois marque como enviadas."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {passo === 1 && (
            <div className="space-y-3">
              {opcoes.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma tarefa em teste no momento.</p>
              )}
              {opcoes.map((o) => (
                <label
                  key={o.id}
                  htmlFor={`lote-${o.id}`}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <Checkbox id={`lote-${o.id}`} checked={lotesSel.has(o.id)} onCheckedChange={() => alternarLote(o.id)} />
                    {o.nome}
                  </span>
                  <span className="flex gap-1.5 text-[11px]">
                    <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
                      {o.prontas} pronta(s)
                    </Badge>
                    {o.pendentes > 0 && (
                      <Badge variant="outline" className="border-warning/40 bg-warning/15 text-warning">
                        {o.pendentes} ainda em teste
                      </Badge>
                    )}
                  </span>
                </label>
              ))}
              {pendentes.length > 0 && (
                <div className="rounded-md border border-warning/50 p-3 text-xs">
                  <p className="flex items-center gap-2 font-medium">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    {pendentes.length} tarefa(s) ainda em teste ficam fora deste envio e continuam na rodada
                  </p>
                  <ul className="mt-1.5 space-y-0.5 text-muted-foreground">
                    {pendentes.map((t) => (
                      <li key={t.id}>
                        {t.titulo} · {STATUS_LABEL[t.status] ?? t.status}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {passo === 2 && (
            <div className="space-y-2">
              {ressalvasSemObs.length > 0 && (
                <p className="flex items-center gap-2 rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                  {ressalvasSemObs.length} aprovada(s) com ressalvas sem observação. O desenvolvimento precisa saber
                  qual é a ressalva.
                </p>
              )}
              <ul className="divide-y rounded-md border text-xs">
                {linhas.map((l) => (
                  <li key={l.id} className="grid gap-2 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
                    <div className="min-w-0">
                      <p>
                        <span className="font-mono text-muted-foreground">{l.numero}</span>{" "}
                        <span className="font-medium">{l.tarefa}</span>
                      </p>
                      <p className="mt-0.5 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            l.status === "aprovado_ressalvas"
                              ? "border-warning/40 bg-warning/15 text-warning"
                              : "border-success/30 bg-success/10 text-success",
                          )}
                        >
                          {l.statusLabel}
                        </Badge>
                        {l.sistema && <span>{l.sistema}</span>}
                        <span>{l.responsaveis || "sem responsável"}</span>
                      </p>
                    </div>
                    <Input
                      id={`obs-${l.id}`}
                      aria-label={`Observação da tarefa ${l.numero}`}
                      value={observacoes[l.id] ?? ""}
                      onChange={(e) => setObservacoes((o) => ({ ...o, [l.id]: e.target.value }))}
                      placeholder={l.status === "aprovado_ressalvas" ? "Qual é a ressalva?" : "Observação (opcional)"}
                      className="h-8 text-xs"
                      maxLength={500}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {passo === 3 && enviadas === null && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="rodada-assunto" className="text-xs">
                  Assunto
                </Label>
                <div className="mt-1 flex gap-2">
                  <Input id="rodada-assunto" value={assunto} onChange={(e) => setAssunto(e.target.value)} className="h-8 text-sm" />
                  <Button type="button" variant="outline" size="sm" onClick={copiarAssunto}>
                    <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="rodada-intro" className="text-xs">
                    Abertura
                  </Label>
                  <Textarea id="rodada-intro" value={intro} onChange={(e) => setIntro(e.target.value)} rows={3} className="mt-1 text-xs" />
                </div>
                <div>
                  <Label htmlFor="rodada-fecho" className="text-xs">
                    Fechamento (ex.: tarefa a manter em stand-by)
                  </Label>
                  <Textarea id="rodada-fecho" value={fecho} onChange={(e) => setFecho(e.target.value)} rows={3} className="mt-1 text-xs" />
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Prévia do corpo do e-mail</p>
                {/* Fundo branco de propósito: é assim que o e-mail aparece no Outlook. */}
                <div
                  ref={previewRef}
                  className="max-h-80 overflow-auto rounded-md border bg-white p-3 text-black"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </div>
            </div>
          )}

          {passo === 3 && enviadas !== null && (
            <p className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-5 w-5 text-success" />
              {enviadas} tarefa(s) movida(s) para Pré-build
              {tirarDeTeste ? ", sem a marca “em teste”" : ", mantendo a marca “em teste”"}. As observações ficaram
              salvas nos cards.
            </p>
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
          <span className="text-xs text-muted-foreground">
            {passo < 3 && `${prontas.length} pronta(s) para enviar`}
            {passo === 3 && enviadas === null && !confirmando && "Envie o e-mail pelo Outlook antes de marcar como enviadas."}
            {confirmando && (
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>Confirma: {linhas.length} tarefa(s) vão para Pré-build.</span>
                <span className="flex items-center gap-1.5">
                  <Checkbox
                    id="rodada-tirar-teste"
                    checked={tirarDeTeste}
                    onCheckedChange={(v) => setTirarDeTeste(v === true)}
                  />
                  <Label htmlFor="rodada-tirar-teste" className="cursor-pointer text-xs font-normal">
                    Tirar também a marca “em teste”
                  </Label>
                </span>
              </span>
            )}
          </span>
          <span className="flex flex-wrap gap-2">
            {passo === 1 && (
              <>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => setPasso(2)} disabled={prontas.length === 0}>
                  Revisar ({prontas.length})
                </Button>
              </>
            )}
            {passo === 2 && (
              <>
                <Button variant="ghost" onClick={() => setPasso(1)}>
                  Voltar
                </Button>
                <Button onClick={() => setPasso(3)}>Montar e-mail</Button>
              </>
            )}
            {passo === 3 && enviadas === null && !confirmando && (
              <>
                <Button variant="ghost" onClick={() => setPasso(2)}>
                  Voltar
                </Button>
                <Button variant="outline" onClick={copiarCorpo}>
                  <Copy className="mr-1.5 h-4 w-4" /> Copiar corpo do e-mail
                </Button>
                <Button variant="outline" onClick={baixarExcel}>
                  <Download className="mr-1.5 h-4 w-4" /> Baixar Excel
                </Button>
                <Button onClick={() => setConfirmando(true)}>Marcar como enviadas</Button>
              </>
            )}
            {confirmando && (
              <>
                <Button variant="ghost" onClick={() => setConfirmando(false)} disabled={gravando}>
                  Ainda não
                </Button>
                <Button onClick={marcarEnviadas} disabled={gravando}>
                  {gravando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sim, mover {linhas.length} para Pré-build
                </Button>
              </>
            )}
            {enviadas !== null && <Button onClick={() => setOpen(false)}>Fechar</Button>}
          </span>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
