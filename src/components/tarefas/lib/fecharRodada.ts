/**
 * Montagem do envio de uma rodada de homologação (E1, 04/10/2026).
 *
 * Processo do Nickolas: quando as tarefas do pacote estão aprovadas ou aprovadas com
 * ressalvas, ele manda aos gerentes e ao desenvolvimento um e-mail com a situação de cada
 * tarefa (tabela no corpo + Excel em anexo) e move as tarefas para Pré-build. Antes, o corpo
 * levava prints do PDF; aqui sai uma tabela de verdade, que o Outlook mantém ao colar.
 */
import { extractTaskNumber } from "@/components/tarefas/lib/taskNumber";
import { STATUS_LABEL } from "@/components/tarefas/lib/workflow";

/** Status em que a tarefa está "na rodada" (em teste). */
export const STATUS_RODADA = ["homologacao", "aprovado", "aprovado_ressalvas", "reprovado"] as const;
/** Prontas para envio. Reprovada só existe durante o teste e é corrigida antes do envio. */
export const STATUS_PRONTAS = ["aprovado", "aprovado_ressalvas"] as const;

export type TarefaEnvio = {
  id: string;
  titulo: string;
  status: string;
  sistema: string | null;
  data_homologacao: string | null;
  lote_importacao_id: string | null;
  responsavel_id: string | null;
  responsaveis_ids: string[] | null;
  equipe_toda: boolean | null;
};

export type LinhaEnvio = {
  id: string;
  numero: string;
  tarefa: string;
  sistema: string;
  status: string;
  statusLabel: string;
  responsaveis: string;
  observacao: string;
  dataHml: string;
  lote: string;
};

/** "Tarefa 9083 - Verificar…" -> "Verificar…" (o número vai em coluna própria). */
export function tituloSemNumero(titulo: string): string {
  return titulo
    .replace(/^\s*(?:tarefa|task)\s*[:#-]?\s*\d{2,}\s*[-–:]?\s*/i, "")
    .replace(/^\s*#?\d{2,}\s*[-–:]\s*/, "")
    .trim() || titulo.trim();
}

function dataBr(iso: string | null): string {
  if (!iso) return "";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : "";
}

/**
 * Converte as tarefas prontas nas linhas do envio, na ordem do e-mail: aprovadas, depois com
 * ressalvas; dentro de cada grupo, por número.
 */
export function montarLinhas(
  tarefas: TarefaEnvio[],
  nomeColab: Map<string, string>,
  nomeLote: Map<string, string>,
  observacoes: Record<string, string>,
): LinhaEnvio[] {
  const ordem = (s: string) => (s === "aprovado" ? 0 : s === "aprovado_ressalvas" ? 1 : 2);
  return tarefas
    .map((t) => {
      const ids = new Set<string>([...(t.responsaveis_ids ?? []), ...(t.responsavel_id ? [t.responsavel_id] : [])]);
      const responsaveis = t.equipe_toda
        ? "Equipe toda"
        : Array.from(ids)
            .map((id) => nomeColab.get(id))
            .filter(Boolean)
            .join(", ");
      return {
        id: t.id,
        numero: extractTaskNumber(t.titulo) ?? "",
        tarefa: tituloSemNumero(t.titulo),
        sistema: t.sistema ?? "",
        status: t.status,
        statusLabel: STATUS_LABEL[t.status] ?? t.status,
        responsaveis,
        observacao: (observacoes[t.id] ?? "").trim(),
        dataHml: dataBr(t.data_homologacao),
        lote: t.lote_importacao_id ? (nomeLote.get(t.lote_importacao_id) ?? "") : "",
      };
    })
    .sort((a, b) => ordem(a.status) - ordem(b.status) || Number(a.numero) - Number(b.numero));
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * Corpo do e-mail em HTML com estilos na própria tag (o Outlook descarta folhas de estilo ao
 * colar). Uma tabela por grupo de status, como os grupos do relatório em PDF de antes.
 */
export function montarHtmlEmail(intro: string, linhas: LinhaEnvio[], fecho: string): string {
  const th = "background:#1f2937;color:#ffffff;text-align:left;padding:6px 8px;border:1px solid #1f2937;font-size:12px";
  const td = "padding:6px 8px;border:1px solid #d1d5db;font-size:12px;vertical-align:top";
  const grupos = [
    { status: "aprovado", titulo: "Aprovadas" },
    { status: "aprovado_ressalvas", titulo: "Aprovadas com ressalvas" },
  ];
  const paragrafos = (t: string) =>
    t
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p style="margin:0 0 12px">${esc(p).replace(/\n/g, "<br>")}</p>`)
      .join("");

  const tabelas = grupos
    .map(({ status, titulo }) => {
      const itens = linhas.filter((l) => l.status === status);
      if (itens.length === 0) return "";
      const corpo = itens
        .map(
          (l, i) =>
            `<tr style="background:${i % 2 ? "#f9fafb" : "#ffffff"}">` +
            `<td style="${td};white-space:nowrap">${esc(l.numero)}</td>` +
            `<td style="${td};white-space:nowrap">${esc(l.sistema)}</td>` +
            `<td style="${td}">${esc(l.tarefa)}</td>` +
            `<td style="${td};white-space:nowrap">${esc(l.statusLabel)}</td>` +
            `<td style="${td}">${esc(l.observacao)}</td>` +
            `<td style="${td}">${esc(l.responsaveis)}</td>` +
            `</tr>`,
        )
        .join("");
      return (
        `<p style="margin:16px 0 6px;font-weight:bold">${esc(titulo)} (${itens.length})</p>` +
        `<table style="border-collapse:collapse;width:100%;font-family:Arial,Helvetica,sans-serif">` +
        `<thead><tr>` +
        ["Número", "Sistema", "Tarefa", "Status", "Observação", "Responsáveis pelo teste"]
          .map((h) => `<th style="${th}">${h}</th>`)
          .join("") +
        `</tr></thead><tbody>${corpo}</tbody></table>`
      );
    })
    .join("");

  return (
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#111827">` +
    paragrafos(intro) +
    tabelas +
    (fecho.trim() ? `<div style="margin-top:16px">${paragrafos(fecho)}</div>` : "") +
    `</div>`
  );
}

/** Versão em texto puro, para quem colar onde HTML não é aceito. */
export function montarTextoEmail(intro: string, linhas: LinhaEnvio[], fecho: string): string {
  const partes = [intro.trim(), ""];
  for (const [status, titulo] of [
    ["aprovado", "Aprovadas"],
    ["aprovado_ressalvas", "Aprovadas com ressalvas"],
  ] as const) {
    const itens = linhas.filter((l) => l.status === status);
    if (itens.length === 0) continue;
    partes.push(`${titulo} (${itens.length})`);
    for (const l of itens) {
      const extra = [l.sistema, l.responsaveis && `teste: ${l.responsaveis}`, l.observacao && `obs.: ${l.observacao}`]
        .filter(Boolean)
        .join(" · ");
      partes.push(`- ${l.numero} ${l.tarefa}${extra ? ` (${extra})` : ""}`);
    }
    partes.push("");
  }
  if (fecho.trim()) partes.push(fecho.trim());
  return partes.join("\n").trim();
}
