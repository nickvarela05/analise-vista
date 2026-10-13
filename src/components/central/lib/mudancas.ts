// "O que mudou desde a sua última visita" (fase 2 do layout, 09/10/2026; ideia do modelo B,
// "Meu dia"). Agrupa o histórico feito por outras pessoas para caber em poucas linhas.
import { STATUS_LABEL } from "@/components/tarefas/lib/workflow";

export type Mudanca = {
  todo_id: string;
  titulo: string;
  campo: string;
  para: string | null;
  autor: string | null;
  em: string;
};

export type GrupoStatus = { status: string; rotulo: string; tarefas: Mudanca[] };

/** Ordem do fluxo, para a lista ler como o processo: recebe, testa, envia, sobe. */
const ORDEM = [
  "homologacao",
  "aprovado",
  "aprovado_ressalvas",
  "reprovado",
  "pre_build",
  "producao",
  "em_andamento",
  "encerrada",
];

/**
 * Agrupa as mudanças de status pelo status de destino. Se a mesma tarefa mudou mais de uma vez,
 * vale a última (onde ela está agora, do ponto de vista do histórico).
 */
export function agruparStatus(mudancas: readonly Mudanca[]): GrupoStatus[] {
  const ultima = new Map<string, Mudanca>();
  for (const m of mudancas) {
    if (m.campo !== "status" || !m.para) continue;
    const atual = ultima.get(m.todo_id);
    if (!atual || m.em > atual.em) ultima.set(m.todo_id, m);
  }
  const grupos = new Map<string, Mudanca[]>();
  for (const m of ultima.values()) {
    const l = grupos.get(m.para!);
    if (l) l.push(m);
    else grupos.set(m.para!, [m]);
  }
  const pos = (s: string) => (ORDEM.indexOf(s) === -1 ? ORDEM.length : ORDEM.indexOf(s));
  return [...grupos.entries()]
    .sort(([a], [b]) => pos(a) - pos(b))
    .map(([status, tarefas]) => ({
      status,
      rotulo: STATUS_LABEL[status] ?? status,
      tarefas: tarefas.sort((x, y) => x.titulo.localeCompare(y.titulo, "pt-BR", { numeric: true })),
    }));
}

/** Confirmações da liberação em produção (ignora as desfeitas). */
export function contarLiberacoes(mudancas: readonly Mudanca[]): number {
  return mudancas.filter((m) => m.campo === "liberacao" && m.para).length;
}
