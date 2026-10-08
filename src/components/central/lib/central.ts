// Regras da Central de Homologação (tela inicial desde 08/10/2026).
// A unidade de trabalho é a rodada: o pacote recebido por e-mail, testado e enviado de volta.
// Ver "Análise de Uso e Propostas de Layout (Out-2026)" no vault do Nickolas.
import { differenceInCalendarDays, isSameDay } from "date-fns";
import type { TarefaRow } from "@/lib/db-types";
import { normalizeStatus } from "@/components/tarefas/lib/workflow";

/** Status de uma tarefa que ainda está na rodada (recebida e não enviada). */
export const STATUS_RODADA = [
  "homologacao",
  "aprovado",
  "aprovado_ressalvas",
  "reprovado",
] as const;
const RODADA = new Set<string>(STATUS_RODADA);

type Tarefa = Pick<
  TarefaRow,
  "id" | "status" | "lote_importacao_id" | "responsavel_id" | "responsaveis_ids" | "equipe_toda"
>;

export function naRodada<T extends Pick<TarefaRow, "status">>(tarefas: readonly T[]): T[] {
  return tarefas.filter((t) => RODADA.has(normalizeStatus(t.status)));
}

export type LoteRodada = {
  id: string | null;
  nome: string;
  criadoEm: string | null;
  total: number;
  aTestar: number;
};

export type ResumoRodada = {
  total: number;
  aTestar: number;
  aprovadas: number;
  ressalvas: number;
  reprovadas: number;
  /** Percentual testado (aprovadas + ressalvas + reprovadas sobre o total). */
  pct: number;
  /** Lotes com tarefa na rodada, do mais recente para o mais antigo. */
  lotes: LoteRodada[];
};

/** Resume a rodada atual: o que falta testar e o resultado do que já foi testado. */
export function resumirRodada(
  tarefas: readonly Tarefa[],
  lotes: readonly { id: string; nome: string; created_at: string }[],
): ResumoRodada {
  const r = { total: 0, aTestar: 0, aprovadas: 0, ressalvas: 0, reprovadas: 0 };
  const porLote = new Map<string | null, LoteRodada>();
  const loteById = new Map(lotes.map((l) => [l.id, l]));
  for (const t of naRodada(tarefas)) {
    const s = normalizeStatus(t.status);
    r.total++;
    if (s === "homologacao") r.aTestar++;
    else if (s === "aprovado") r.aprovadas++;
    else if (s === "aprovado_ressalvas") r.ressalvas++;
    else if (s === "reprovado") r.reprovadas++;
    const loteId = t.lote_importacao_id ?? null;
    let l = porLote.get(loteId);
    if (!l) {
      const info = loteId ? loteById.get(loteId) : undefined;
      l = {
        id: loteId,
        nome: info?.nome ?? "Sem pacote (criadas à mão)",
        criadoEm: info?.created_at ?? null,
        total: 0,
        aTestar: 0,
      };
      porLote.set(loteId, l);
    }
    l.total++;
    if (s === "homologacao") l.aTestar++;
  }
  const testadas = r.total - r.aTestar;
  return {
    ...r,
    pct: r.total ? Math.round((testadas / r.total) * 100) : 0,
    lotes: [...porLote.values()].sort((a, b) => (b.criadoEm ?? "").localeCompare(a.criadoEm ?? "")),
  };
}

export type FilaPessoa = {
  /** `null` para "Sem responsável"; "equipe" para tarefas da equipe toda. */
  chave: string;
  nome: string;
  aTestar: number;
  testadas: number;
  reprovadas: number;
};

/** Ids dos responsáveis pela tarefa (lista explícita, com o responsável único legado como reserva). */
function responsaveis(t: Tarefa): string[] {
  const ids = (t.responsaveis_ids ?? []).filter(Boolean);
  if (ids.length) return ids;
  return t.responsavel_id ? [t.responsavel_id] : [];
}

/**
 * Fila de testes por pessoa. Tarefa com dois responsáveis conta para os dois, porque os dois
 * têm de olhar. Quem está sem tarefa na rodada não aparece.
 */
export function filaPorPessoa(
  tarefas: readonly Tarefa[],
  colabs: readonly { id: string; nome: string }[],
): FilaPessoa[] {
  const nomes = new Map(colabs.map((c) => [c.id, c.nome]));
  const fila = new Map<string, FilaPessoa>();
  const conta = (chave: string, nome: string, s: string) => {
    let p = fila.get(chave);
    if (!p) fila.set(chave, (p = { chave, nome, aTestar: 0, testadas: 0, reprovadas: 0 }));
    if (s === "homologacao") p.aTestar++;
    else p.testadas++;
    if (s === "reprovado") p.reprovadas++;
  };
  for (const t of naRodada(tarefas)) {
    const s = normalizeStatus(t.status);
    if (t.equipe_toda) {
      conta("equipe", "Equipe toda", s);
      continue;
    }
    const ids = responsaveis(t);
    if (ids.length === 0) conta("sem", "Sem responsável", s);
    for (const id of ids) conta(id, nomes.get(id) ?? "Colaborador inativo", s);
  }
  // Quem tem mais a testar primeiro; "Sem responsável" sempre no topo, porque pede ação.
  return [...fila.values()].sort((a, b) => {
    if (a.chave === "sem") return -1;
    if (b.chave === "sem") return 1;
    return b.aTestar - a.aTestar || b.testadas - a.testadas || a.nome.localeCompare(b.nome);
  });
}

export type Aguardando<T> = { tarefa: T; desde: Date | null; dias: number | null };

/**
 * Tarefas em Pré-build, da que espera há mais tempo para a mais recente.
 * `entradas` traz, por tarefa, quando ela entrou em Pré-build segundo o histórico. Sem registro
 * (tarefas movidas em lote antes de 08/10/2026, quando o lote não gravava histórico), os dias
 * ficam `null` e a tarefa vai para o fim, em vez de mostrar um número inventado.
 */
export function aguardandoProducao<T extends Pick<TarefaRow, "id" | "status">>(
  tarefas: readonly T[],
  entradas: Readonly<Record<string, string>>,
  hoje = new Date(),
): Aguardando<T>[] {
  return tarefas
    .filter((t) => normalizeStatus(t.status) === "pre_build")
    .map((tarefa) => {
      const iso = entradas[tarefa.id];
      const desde = iso ? new Date(iso) : null;
      return { tarefa, desde, dias: desde ? differenceInCalendarDays(hoje, desde) : null };
    })
    .sort((a, b) => (b.dias ?? -1) - (a.dias ?? -1));
}

/** Reunião de hoje, não cancelada. */
export function reuniaoDeHoje(
  r: { data_reuniao: string; status: string | null },
  hoje = new Date(),
) {
  return r.status !== "cancelada" && isSameDay(new Date(r.data_reuniao), hoje);
}

/**
 * Relatório é de quem? A tela Relatórios grava o nome do colaborador (texto), não o id.
 * Compara sem acento e sem diferença de maiúsculas, para não perder "Nickolas" vs "nickolas".
 */
export function mesmoNome(a: string | null | undefined, b: string | null | undefined) {
  const n = (s: string | null | undefined) =>
    (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  return !!n(a) && n(a) === n(b);
}
