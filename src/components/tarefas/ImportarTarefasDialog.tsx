import * as React from "react";
import { Upload, FileSpreadsheet, Loader2, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { qk } from "@/lib/queries/keys";
import { STATUS_LABEL, type WorkflowStatus } from "@/components/tarefas/lib/workflow";
import {
  parseLinhasImport,
  loteImportSchema,
  type LinhaImport,
} from "@/lib/schemas/tarefa_import";
import { taskDedupKey, extractTaskNumber } from "@/components/tarefas/lib/taskNumber";

const norm = (s: unknown) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

function mapearStatus(raw: unknown): WorkflowStatus {
  const s = norm(raw);
  if (!s) return "aberta";
  if (s.startsWith("cancel") || s.startsWith("encerr")) return "encerrada";
  if (s.startsWith("aberta")) return "aberta";
  if (s.startsWith("encaminhada")) return "em_andamento";
  if (s.includes("homologa") || s.includes("correc")) return "homologacao";
  if (s.startsWith("executada") || s.startsWith("finalizada") || s.includes("conclu"))
    return "producao";
  return "aberta";
}

function mapearPrioridade(raw: unknown): "baixa" | "media" | "alta" {
  const s = norm(raw);
  if (s.startsWith("alta") || s.includes("urgent")) return "alta";
  if (s.startsWith("baixa")) return "baixa";
  return "media";
}

function buscarColuna(row: Record<string, unknown>, alvos: string[]): unknown {
  for (const k of Object.keys(row)) {
    const n = norm(k);
    if (alvos.some((a) => n === a || n.startsWith(a))) return row[k];
  }
  return undefined;
}

type Existente = { id: string; titulo: string; status: string };
type Duplicada = { linha: LinhaImport; existente: Existente };

export function ImportarTarefasDialog() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [linhas, setLinhas] = React.useState<LinhaImport[]>([]);
  const [erros, setErros] = React.useState<string[]>([]);
  const [arquivo, setArquivo] = React.useState<string>("");
  const [importando, setImportando] = React.useState(false);
  const [forcarHomologacao, setForcarHomologacao] = React.useState(false);
  const [nomeLote, setNomeLote] = React.useState("");
  const [descricaoLote, setDescricaoLote] = React.useState("");
  const [existentes, setExistentes] = React.useState<Existente[]>([]);
  const [substituirIds, setSubstituirIds] = React.useState<Set<string>>(new Set());
  const inputRef = React.useRef<HTMLInputElement>(null);

  const reset = () => {
    setLinhas([]);
    setErros([]);
    setArquivo("");
    setForcarHomologacao(false);
    setNomeLote("");
    setDescricaoLote("");
    setExistentes([]);
    setSubstituirIds(new Set());
    if (inputRef.current) inputRef.current.value = "";
  };

  // Carrega existentes ao abrir para permitir checagem no momento do parse
  React.useEffect(() => {
    if (!open) return;
    supabase
      .from("todo")
      .select("id, titulo, status")
      .then(({ data }) => setExistentes(data ?? []));
  }, [open]);

  // Índice de existentes por chave de dedup (número → id/status/título)
  const mapaExistentes = React.useMemo(() => {
    const m = new Map<string, Existente>();
    for (const e of existentes) {
      const k = taskDedupKey(e.titulo);
      if (k && !m.has(k)) m.set(k, e);
    }
    return m;
  }, [existentes]);

  // Classifica as linhas parseadas em novas vs duplicadas
  const { novas, duplicadas } = React.useMemo(() => {
    const novasArr: LinhaImport[] = [];
    const dupArr: Duplicada[] = [];
    for (const l of linhas) {
      const k = taskDedupKey(l.titulo);
      const ex = k ? mapaExistentes.get(k) : undefined;
      if (ex) dupArr.push({ linha: l, existente: ex });
      else novasArr.push(l);
    }
    return { novas: novasArr, duplicadas: dupArr };
  }, [linhas, mapaExistentes]);

  const onFile = async (file: File) => {
    setArquivo(file.name);
    setErros([]);
    setLinhas([]);
    setSubstituirIds(new Set());
    const baseNome = file.name.replace(/\.(xlsx?|XLSX?)$/, "");
    setNomeLote(`HML – ${baseNome} – ${format(new Date(), "dd/MM/yyyy HH:mm")}`);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

      const brutas: Array<{
        titulo: string;
        descricao: string | null;
        status: WorkflowStatus;
        prioridade: "baixa" | "media" | "alta";
      }> = [];
      rows.forEach((row) => {
        const tarefa = buscarColuna(row, ["tarefa"]);
        const assunto = buscarColuna(row, ["assunto"]);
        const status = buscarColuna(row, ["status"]);
        const prioridade = buscarColuna(row, ["prioridade"]);
        const descricao = buscarColuna(row, ["descricao", "descrição"]);

        const tarefaStr = String(tarefa ?? "").trim();
        const assuntoStr = String(assunto ?? "").trim();
        if (!tarefaStr && !assuntoStr) return;

        const titulo =
          tarefaStr && assuntoStr
            ? `Tarefa ${tarefaStr} - ${assuntoStr}`
            : tarefaStr
              ? `Tarefa ${tarefaStr}`
              : assuntoStr;

        brutas.push({
          titulo,
          descricao: descricao ? String(descricao).trim() || null : null,
          status: mapearStatus(status),
          prioridade: mapearPrioridade(prioridade),
        });
      });

      // Dedup intra-planilha por número da tarefa (fallback: título normalizado)
      const vistas = new Set<string>();
      let duplicadasNaPlanilha = 0;
      const brutasUnicas = brutas.filter((b) => {
        const k = taskDedupKey(b.titulo);
        if (!k) return false;
        if (vistas.has(k)) {
          duplicadasNaPlanilha++;
          return false;
        }
        vistas.add(k);
        return true;
      });

      const { validas, erros: erroAcum } = parseLinhasImport(brutasUnicas);

      setLinhas(validas);
      setErros(erroAcum);
      if (validas.length === 0 && erroAcum.length === 0) {
        setErros(["Nenhuma linha válida encontrada na planilha."]);
      }
      if (duplicadasNaPlanilha > 0) {
        toast.info(
          `${duplicadasNaPlanilha} linha(s) duplicada(s) na planilha foram ignoradas.`,
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErros([`Erro ao ler planilha: ${msg}`]);
    }
  };

  const toggleSubstituir = (id: string) => {
    setSubstituirIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selecionarTodas = () =>
    setSubstituirIds(new Set(duplicadas.map((d) => d.existente.id)));
  const limparSelecao = () => setSubstituirIds(new Set());

  const importar = async () => {
    if (!user || linhas.length === 0) return;
    let loteData: { nome: string; descricao: string | null } | null = null;
    if (forcarHomologacao) {
      const parsedLote = loteImportSchema.safeParse({
        nome: nomeLote,
        descricao: descricaoLote,
      });
      if (!parsedLote.success) {
        toast.error(parsedLote.error.issues[0]?.message ?? "Dados do lote inválidos");
        return;
      }
      loteData = parsedLote.data;
    }
    setImportando(true);

    // Substituições manuais escolhidas pelo usuário
    const substituicoes = duplicadas.filter((d) => substituirIds.has(d.existente.id));
    const duplicadasIgnoradas = duplicadas.length - substituicoes.length;

    let loteId: string | null = null;
    if (forcarHomologacao && (novas.length > 0 || substituicoes.length > 0)) {
      const total = novas.length + substituicoes.length;
      const { data: lote, error: loteErr } = await supabase
        .from("todo_importacao_lote")
        .insert({
          nome: loteData!.nome,
          descricao: loteData!.descricao,
          tipo: "homologacao",
          total_tarefas: total,
          criado_por: user.id,
        })
        .select("id")
        .single();
      if (loteErr || !lote) {
        setImportando(false);
        toast.error("Erro ao criar lote", { description: loteErr?.message });
        return;
      }
      loteId = lote.id;
    }

    // 1) Inserir as novas
    if (novas.length > 0) {
      const payload = novas.map((l) => ({
        titulo: l.titulo,
        descricao: l.descricao,
        status: (forcarHomologacao ? "homologacao" : l.status) as never,
        prioridade: l.prioridade,
        responsaveis_ids: [],
        equipe_toda: false,
        criado_por: user.id,
        lote_importacao_id: loteId,
        origem_importacao: forcarHomologacao ? "homologacao" : null,
        em_teste: forcarHomologacao,
      }));
      const { error } = await supabase.from("todo").insert(payload);
      if (error) {
        setImportando(false);
        toast.error("Erro ao importar", { description: error.message });
        return;
      }
    }

    // 2) Substituir apenas os que o usuário marcou
    // Agrupa por status alvo para minimizar chamadas
    const porStatus = new Map<WorkflowStatus, string[]>();
    for (const d of substituicoes) {
      const alvo: WorkflowStatus = forcarHomologacao ? "homologacao" : d.linha.status;
      const arr = porStatus.get(alvo) ?? [];
      arr.push(d.existente.id);
      porStatus.set(alvo, arr);
    }
    let totalAtualizadas = 0;
    for (const [status, ids] of porStatus.entries()) {
      if (ids.length === 0) continue;
      const patch = forcarHomologacao
        ? { status: status as never, em_teste: true, origem_importacao: "homologacao", lote_importacao_id: loteId }
        : { status: status as never };
      const { error } = await supabase.from("todo").update(patch).in("id", ids);
      if (error) {
        setImportando(false);
        toast.error("Erro ao substituir tarefas", { description: error.message });
        return;
      }
      totalAtualizadas += ids.length;
    }

    setImportando(false);
    const partes: string[] = [];
    if (novas.length) partes.push(`${novas.length} nova(s)`);
    if (totalAtualizadas) partes.push(`${totalAtualizadas} substituída(s)`);
    if (duplicadasIgnoradas) partes.push(`${duplicadasIgnoradas} duplicada(s) preservada(s)`);
    toast.success(`Import concluído: ${partes.join(", ") || "nada a fazer"}.`);
    qc.invalidateQueries({ queryKey: qk.tarefas.all() });
    qc.invalidateQueries({ queryKey: ["tarefas", "lotes"] });
    reset();
    setOpen(false);
  };

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
          <Upload className="mr-2 h-4 w-4" /> Importar planilha
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar tarefas via Excel</DialogTitle>
          <DialogDescription>
            Aceita arquivos .xls e .xlsx. Serão considerados apenas: Tarefa, Assunto, Status,
            Prioridade e Descrição. A checagem de duplicidade usa o <span className="font-medium">número da tarefa</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border-2 border-dashed border-border bg-muted/30 p-6 text-center">
            <FileSpreadsheet className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <input
              ref={inputRef}
              type="file"
              accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              Selecionar arquivo
            </Button>
            {arquivo && (
              <p className="mt-2 text-xs text-muted-foreground">
                Arquivo: <span className="font-medium">{arquivo}</span>
              </p>
            )}
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs space-y-1.5">
            <p className="font-medium text-foreground">Regras de duplicidade:</p>
            <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
              <li>Duplicatas são identificadas pelo <span className="font-medium">número da tarefa</span> extraído do título (ex.: “Tarefa 12345”).</li>
              <li>Tarefas <span className="font-medium">novas</span> são incluídas normalmente.</li>
              <li>Tarefas <span className="font-medium">duplicadas nunca são criadas</span> — você escolhe manualmente quais devem ter o status substituído pela planilha.</li>
            </ul>
          </div>

          <div className="space-y-3 rounded-md border border-info/30 bg-info/5 p-3">
            <div className="flex items-start gap-2">
              <Checkbox
                id="forcar-hml"
                checked={forcarHomologacao}
                onCheckedChange={(v) => setForcarHomologacao(v === true)}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <Label htmlFor="forcar-hml" className="cursor-pointer text-sm font-medium">
                  Importar tarefas de homologação
                </Label>
                <p className="text-xs text-muted-foreground">
                  Cria um <span className="font-medium">lote</span> rastreável e marca tudo como{" "}
                  <span className="font-medium">Homologação</span>, ignorando o status da planilha.
                </p>
              </div>
            </div>

            {forcarHomologacao && (
              <div className="space-y-2 pl-6">
                <div>
                  <Label htmlFor="nome-lote" className="text-xs">
                    Nome do lote <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="nome-lote"
                    value={nomeLote}
                    onChange={(e) => setNomeLote(e.target.value)}
                    placeholder="Ex.: HML Sprint 23"
                    className="mt-1 h-8 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="desc-lote" className="text-xs">
                    Descrição (opcional)
                  </Label>
                  <Textarea
                    id="desc-lote"
                    value={descricaoLote}
                    onChange={(e) => setDescricaoLote(e.target.value)}
                    placeholder="Notas sobre este lote..."
                    rows={2}
                    className="mt-1 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {erros.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-inside list-disc text-xs">
                  {erros.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {linhas.length > 0 && (
            <>
              <div className="rounded-md border">
                <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2 text-xs">
                  <span className="font-medium">
                    Novas ({novas.length}) — serão criadas
                  </span>
                </div>
                <div className="max-h-52 overflow-auto">
                  <table className="w-full text-xs">
                    <tbody>
                      {novas.slice(0, 50).map((l, i) => {
                        const num = extractTaskNumber(l.titulo);
                        return (
                          <tr key={i} className="border-b last:border-0">
                            <td className="w-14 px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
                              {num ? `#${num}` : "—"}
                            </td>
                            <td className="px-3 py-1.5">{l.titulo}</td>
                            <td className="px-3 py-1.5 capitalize text-muted-foreground">
                              {forcarHomologacao ? "homologação" : l.status.replace("_", " ")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {novas.length === 0 && (
                    <p className="px-3 py-3 text-xs text-muted-foreground">
                      Nenhuma tarefa nova nesta planilha.
                    </p>
                  )}
                </div>
              </div>

              {duplicadas.length > 0 && (
                <div className="rounded-md border border-warning/40 bg-warning/5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-warning/30 px-3 py-2 text-xs">
                    <span className="font-medium">
                      Duplicadas encontradas ({duplicadas.length}) —{" "}
                      <span className="text-warning">selecione as que devem ser substituídas</span>
                    </span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={selecionarTodas}>
                        Selecionar todas
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={limparSelecao}>
                        Limpar
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-auto">
                    <table className="w-full text-xs">
                      <tbody>
                        {duplicadas.map((d, i) => {
                          const num = extractTaskNumber(d.linha.titulo);
                          const marcada = substituirIds.has(d.existente.id);
                          return (
                            <tr key={i} className="border-b last:border-0 align-top">
                              <td className="px-2 py-2">
                                <Checkbox
                                  checked={marcada}
                                  onCheckedChange={() => toggleSubstituir(d.existente.id)}
                                />
                              </td>
                              <td className="w-14 px-2 py-2 font-mono text-[10px] text-muted-foreground">
                                {num ? `#${num}` : "—"}
                              </td>
                              <td className="px-2 py-2">
                                <p className="font-medium">{d.linha.titulo}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  já cadastrada: {STATUS_LABEL[d.existente.status] ?? d.existente.status}
                                </p>
                              </td>
                              <td className="px-2 py-2 text-right">
                                <Badge variant="outline" className="text-[10px]">
                                  {STATUS_LABEL[forcarHomologacao ? "homologacao" : d.linha.status] ?? d.linha.status}
                                </Badge>
                                <p className="mt-1 text-[10px] text-muted-foreground">
                                  novo status da planilha
                                </p>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="border-t border-warning/30 bg-warning/10 px-3 py-1.5 text-[11px] text-muted-foreground">
                    {substituirIds.size} de {duplicadas.length} marcadas para substituição —{" "}
                    as demais serão preservadas.
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={importando}>
            Cancelar
          </Button>
          <Button onClick={importar} disabled={linhas.length === 0 || importando}>
            {importando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Importar {novas.length + substituirIds.size > 0 ? `(${novas.length + substituirIds.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
