import * as React from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { exportToPdf, exportToXlsx } from "@/lib/tarefas/export";
import type { TarefaRow } from "@/lib/db-types";
import type { ColabMini, DemandaMini, LoteMini } from "./useTarefasData";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "aberta", label: "Aberta" },
  { value: "em_andamento", label: "Em desenvolvimento" },
  { value: "teste_interno", label: "Teste interno" },
  { value: "homologacao", label: "Homologação" },
  { value: "aprovado", label: "Aprovado" },
  { value: "aprovado_ressalvas", label: "Aprovado c/ ressalvas" },
  { value: "reprovado", label: "Reprovado" },
  { value: "producao", label: "Produção" },
];

interface Props {
  todasTarefas: TarefaRow[];
  tarefasFiltradas: TarefaRow[];
  colabs: ColabMini[];
  demandas: DemandaMini[];
  lotes: LoteMini[];
}

type Escopo = "filtrados" | "lotes" | "status";
type Formato = "xlsx" | "pdf";

export function ExportarTarefasDialog({
  todasTarefas,
  tarefasFiltradas,
  colabs,
  demandas,
  lotes,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [escopo, setEscopo] = React.useState<Escopo>("filtrados");
  const [formato, setFormato] = React.useState<Formato>("xlsx");
  const [lotesSel, setLotesSel] = React.useState<string[]>([]);
  const [statusSel, setStatusSel] = React.useState<string[]>([]);

  const toggle = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const tarefasParaExportar = React.useMemo(() => {
    if (escopo === "filtrados") return tarefasFiltradas;
    if (escopo === "lotes") {
      if (lotesSel.length === 0) return [];
      return todasTarefas.filter((t) => t.lote_importacao_id && lotesSel.includes(t.lote_importacao_id));
    }
    if (statusSel.length === 0) return [];
    return todasTarefas.filter((t) => statusSel.includes(t.status));
  }, [escopo, tarefasFiltradas, todasTarefas, lotesSel, statusSel]);

  const handleExport = () => {
    if (tarefasParaExportar.length === 0) return;
    const data = format(new Date(), "yyyyMMdd-HHmm");
    const escopoLabel =
      escopo === "filtrados" ? "filtradas" : escopo === "lotes" ? "lotes" : "status";
    const filename = `tarefas-${escopoLabel}-${data}.${formato}`;

    let cabecalho = "";
    if (escopo === "filtrados") cabecalho = "Tarefas filtradas na tela";
    else if (escopo === "lotes")
      cabecalho = `Lote(s): ${lotes
        .filter((l) => lotesSel.includes(l.id))
        .map((l) => l.nome)
        .join(", ")}`;
    else
      cabecalho = `Status: ${STATUS_OPTIONS.filter((s) => statusSel.includes(s.value))
        .map((s) => s.label)
        .join(", ")}`;

    if (formato === "xlsx") {
      exportToXlsx(tarefasParaExportar, colabs, lotes, demandas, filename);
    } else {
      exportToPdf(tarefasParaExportar, colabs, lotes, demandas, filename, cabecalho);
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" /> Exportar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Exportar relatório de tarefas</DialogTitle>
          <DialogDescription>
            Escolha o escopo e o formato. Inclui título, descrição, status, prioridade, responsáveis,
            prazo, lote, origem e demanda vinculada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Escopo</Label>
            <RadioGroup
              value={escopo}
              onValueChange={(v) => setEscopo(v as Escopo)}
              className="mt-1.5 space-y-1"
            >
              <label className="flex cursor-pointer items-center gap-2 rounded border p-2 text-sm hover:bg-muted">
                <RadioGroupItem value="filtrados" />
                Tarefas filtradas atualmente ({tarefasFiltradas.length})
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded border p-2 text-sm hover:bg-muted">
                <RadioGroupItem value="lotes" />
                Por lote(s) de importação
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded border p-2 text-sm hover:bg-muted">
                <RadioGroupItem value="status" />
                Por status
              </label>
            </RadioGroup>
          </div>

          {escopo === "lotes" && (
            <div>
              <Label className="text-xs">Selecionar lotes</Label>
              {lotes.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">Nenhum lote disponível.</p>
              ) : (
                <ScrollArea className="mt-1.5 h-40 rounded-md border p-2">
                  <div className="space-y-0.5">
                    {lotes.map((l) => (
                      <label
                        key={l.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-muted"
                      >
                        <Checkbox
                          checked={lotesSel.includes(l.id)}
                          onCheckedChange={() => setLotesSel((prev) => toggle(prev, l.id))}
                        />
                        <span className="text-xs">
                          {l.nome}{" "}
                          <span className="text-muted-foreground">({l.total_tarefas})</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          {escopo === "status" && (
            <div>
              <Label className="text-xs">Selecionar status</Label>
              <div className="mt-1.5 grid grid-cols-2 gap-1">
                {STATUS_OPTIONS.map((s) => (
                  <label
                    key={s.value}
                    className="flex cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-xs hover:bg-muted"
                  >
                    <Checkbox
                      checked={statusSel.includes(s.value)}
                      onCheckedChange={() => setStatusSel((prev) => toggle(prev, s.value))}
                    />
                    {s.label}
                  </label>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 h-7 text-xs"
                onClick={() => setStatusSel(STATUS_OPTIONS.map((s) => s.value))}
              >
                Selecionar todos
              </Button>
            </div>
          )}

          <div>
            <Label className="text-xs">Formato</Label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={formato === "xlsx" ? "default" : "outline"}
                onClick={() => setFormato("xlsx")}
                className="h-9"
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
              </Button>
              <Button
                type="button"
                variant={formato === "pdf" ? "default" : "outline"}
                onClick={() => setFormato("pdf")}
                className="h-9"
              >
                <FileText className="mr-2 h-4 w-4" /> PDF
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Total a exportar: <span className="font-medium">{tarefasParaExportar.length}</span>{" "}
            tarefa(s)
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={tarefasParaExportar.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Exportar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
