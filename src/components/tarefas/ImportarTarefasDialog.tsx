import * as React from "react";
import { Upload, FileSpreadsheet, Loader2, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { qk } from "@/lib/queries/keys";
import type { WorkflowStatus } from "@/components/tarefas/lib/workflow";

type LinhaImport = {
  titulo: string;
  descricao: string | null;
  status: WorkflowStatus;
  prioridade: "baixa" | "media" | "alta";
};

const norm = (s: unknown) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

function mapearStatus(raw: unknown): WorkflowStatus {
  const s = norm(raw);
  if (!s) return "aberta";
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

export function ImportarTarefasDialog() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [linhas, setLinhas] = React.useState<LinhaImport[]>([]);
  const [erros, setErros] = React.useState<string[]>([]);
  const [arquivo, setArquivo] = React.useState<string>("");
  const [importando, setImportando] = React.useState(false);
  const [forcarHomologacao, setForcarHomologacao] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const reset = () => {
    setLinhas([]);
    setErros([]);
    setArquivo("");
    setForcarHomologacao(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onFile = async (file: File) => {
    setArquivo(file.name);
    setErros([]);
    setLinhas([]);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

      const erroAcum: string[] = [];
      const out: LinhaImport[] = [];
      rows.forEach((row, idx) => {
        const tarefa = buscarColuna(row, ["tarefa"]);
        const assunto = buscarColuna(row, ["assunto"]);
        const status = buscarColuna(row, ["status"]);
        const prioridade = buscarColuna(row, ["prioridade"]);
        const descricao = buscarColuna(row, ["descricao", "descrição"]);

        const tarefaStr = String(tarefa ?? "").trim();
        const assuntoStr = String(assunto ?? "").trim();
        if (!tarefaStr && !assuntoStr) return; // linha vazia

        const titulo =
          tarefaStr && assuntoStr
            ? `Tarefa ${tarefaStr} - ${assuntoStr}`
            : tarefaStr
              ? `Tarefa ${tarefaStr}`
              : assuntoStr;

        if (!titulo) {
          erroAcum.push(`Linha ${idx + 2}: sem Tarefa/Assunto`);
          return;
        }

        out.push({
          titulo,
          descricao: descricao ? String(descricao).trim() || null : null,
          status: mapearStatus(status),
          prioridade: mapearPrioridade(prioridade),
        });
      });

      setLinhas(out);
      setErros(erroAcum);
      if (out.length === 0 && erroAcum.length === 0) {
        setErros(["Nenhuma linha válida encontrada na planilha."]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErros([`Erro ao ler planilha: ${msg}`]);
    }
  };

  const importar = async () => {
    if (!user || linhas.length === 0) return;
    setImportando(true);
    const payload = linhas.map((l) => ({
      titulo: l.titulo,
      descricao: l.descricao,
      status: l.status as never,
      prioridade: l.prioridade,
      responsaveis_ids: [],
      equipe_toda: false,
      criado_por: user.id,
    }));
    const { error } = await supabase.from("todo").insert(payload);
    setImportando(false);
    if (error) {
      toast.error("Erro ao importar", { description: error.message });
      return;
    }
    toast.success(`${linhas.length} tarefa(s) importada(s)`);
    qc.invalidateQueries({ queryKey: qk.tarefas.all() });
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
            Prioridade e Descrição. Demais colunas serão ignoradas.
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
            <div className="rounded-md border">
              <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium">
                Pré-visualização ({linhas.length} tarefa{linhas.length > 1 ? "s" : ""})
              </div>
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b text-left">
                      <th className="px-3 py-2 font-medium">Título</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Prioridade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.slice(0, 50).map((l, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-3 py-1.5">{l.titulo}</td>
                        <td className="px-3 py-1.5 capitalize">{l.status.replace("_", " ")}</td>
                        <td className="px-3 py-1.5 capitalize">{l.prioridade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {linhas.length > 50 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    Exibindo 50 de {linhas.length} linhas.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={importando}>
            Cancelar
          </Button>
          <Button onClick={importar} disabled={linhas.length === 0 || importando}>
            {importando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Importar {linhas.length > 0 ? `(${linhas.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
