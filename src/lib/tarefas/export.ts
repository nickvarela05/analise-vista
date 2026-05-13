import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import type { TarefaRow } from "@/lib/db-types";

export type ExportColab = { id: string; nome: string };
export type ExportLote = { id: string; nome: string };
export type ExportDemanda = { id: string; titulo: string };

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em desenvolvimento",
  teste_interno: "Teste interno",
  homologacao: "Homologação",
  aprovado: "Aprovado",
  aprovado_ressalvas: "Aprovado com ressalvas",
  reprovado: "Reprovado",
  producao: "Produção",
  pendente: "Pendente",
};

export function buildRows(
  tarefas: TarefaRow[],
  colabs: ExportColab[],
  lotes: ExportLote[],
  demandas: ExportDemanda[],
) {
  const colabMap = new Map(colabs.map((c) => [c.id, c.nome]));
  const loteMap = new Map(lotes.map((l) => [l.id, l.nome]));
  const demandaMap = new Map(demandas.map((d) => [d.id, d.titulo]));

  return tarefas.map((t) => ({
    Título: t.titulo ?? "",
    Descrição: t.descricao ?? "",
    Status: STATUS_LABEL[t.status] ?? t.status,
    Prioridade: t.prioridade ?? "",
    Responsáveis: t.equipe_toda
      ? "Equipe toda"
      : ((t.responsaveis_ids ?? []) as string[]).map((id) => colabMap.get(id) ?? id).join(", "),
    Prazo: t.data_prevista ? format(new Date(t.data_prevista + "T00:00:00"), "dd/MM/yyyy") : "",
    Lote: t.lote_importacao_id ? (loteMap.get(t.lote_importacao_id) ?? t.lote_importacao_id) : "",
    Origem: t.origem_importacao === "homologacao" ? "HML importada" : "Manual",
    Demanda: t.demanda_id ? (demandaMap.get(t.demanda_id) ?? "") : "",
    "Criada em": t.created_at ? format(new Date(t.created_at), "dd/MM/yyyy HH:mm") : "",
    "Concluída em": t.concluida_em ? format(new Date(t.concluida_em), "dd/MM/yyyy HH:mm") : "",
  }));
}

export function exportToXlsx(
  tarefas: TarefaRow[],
  colabs: ExportColab[],
  lotes: ExportLote[],
  demandas: ExportDemanda[],
  filename: string,
) {
  const rows = buildRows(tarefas, colabs, lotes, demandas);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  // Largura aproximada das colunas
  const colWidths = Object.keys(rows[0] ?? {}).map((k) => ({
    wch: Math.min(60, Math.max(k.length, ...rows.map((r) => String((r as Record<string, unknown>)[k] ?? "").length))),
  }));
  ws["!cols"] = colWidths;
  XLSX.utils.book_append_sheet(wb, ws, "Tarefas");

  // Aba resumo de lotes (se aplicável)
  const lotesUsados = Array.from(
    new Set(tarefas.map((t) => t.lote_importacao_id).filter(Boolean) as string[]),
  );
  if (lotesUsados.length > 0) {
    const resumo = lotesUsados.map((id) => {
      const lote = lotes.find((l) => l.id === id);
      const items = tarefas.filter((t) => t.lote_importacao_id === id);
      const porStatus = items.reduce<Record<string, number>>((acc, t) => {
        const k = STATUS_LABEL[t.status] ?? t.status;
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {});
      return {
        Lote: lote?.nome ?? id,
        Total: items.length,
        ...porStatus,
      };
    });
    const wsL = XLSX.utils.json_to_sheet(resumo);
    XLSX.utils.book_append_sheet(wb, wsL, "Resumo por lote");
  }

  XLSX.writeFile(wb, filename);
}

export function exportToPdf(
  tarefas: TarefaRow[],
  colabs: ExportColab[],
  lotes: ExportLote[],
  demandas: ExportDemanda[],
  filename: string,
  cabecalho: string,
) {
  const rows = buildRows(tarefas, colabs, lotes, demandas);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(14);
  doc.text("Relatório de Tarefas", 40, 40);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(cabecalho, 40, 56);
  doc.text(`Total: ${rows.length} tarefa(s) — gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 40, 70);

  const cols = ["Título", "Status", "Prioridade", "Responsáveis", "Prazo", "Lote", "Origem"];
  const body = rows.map((r) => cols.map((c) => String((r as Record<string, unknown>)[c] ?? "")));

  autoTable(doc, {
    startY: 84,
    head: [cols],
    body,
    styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [40, 40, 60] },
    columnStyles: {
      0: { cellWidth: 200 },
      3: { cellWidth: 130 },
    },
    didDrawPage: (data) => {
      const str = `Página ${doc.getNumberOfPages()}`;
      doc.setFontSize(8);
      doc.text(str, data.settings.margin.left, doc.internal.pageSize.height - 12);
    },
  });

  doc.save(filename);
}
