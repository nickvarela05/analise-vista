/**
 * Regras puras para atribuição de atividades a colaboradores.
 *
 * Modelo de atribuição (compatível com tarefas, demandas, reuniões e relatórios):
 * - `equipe_toda = true` → vale para todos os colaboradores.
 * - `responsaveis_ids: string[]` → lista explícita.
 * - `responsavel_id: string` → fallback legado para registros antigos
 *   com responsável único.
 */

export interface AtribuivelRow {
  equipe_toda?: boolean | null;
  responsaveis_ids?: string[] | null;
  responsavel_id?: string | null;
}

/**
 * Indica se uma linha está atribuída ao colaborador informado.
 * Quando `colabId` é nulo (usuário sem vínculo de colaborador),
 * apenas itens marcados como `equipe_toda` retornam `true`.
 */
export function isAtribuidoA(
  row: AtribuivelRow,
  colabId: string | null | undefined,
): boolean {
  if (row.equipe_toda) return true;
  if (!colabId) return false;
  const ids = row.responsaveis_ids ?? [];
  if (ids.length > 0) return ids.includes(colabId);
  return row.responsavel_id === colabId;
}

/**
 * Conta quantas linhas estão atribuídas ao colaborador.
 */
export function contarAtribuicoes(
  rows: ReadonlyArray<AtribuivelRow>,
  colabId: string,
): number {
  let n = 0;
  for (const r of rows) if (isAtribuidoA(r, colabId)) n++;
  return n;
}

/**
 * Filtra linhas pelo escopo de visualização.
 * - "equipe": retorna todas as linhas.
 * - "minhas": retorna apenas as atribuídas ao colaborador atual.
 *   Se `meuColabId` for nulo, devolve lista vazia.
 */
export function filtrarPorEscopo<T extends AtribuivelRow>(
  rows: ReadonlyArray<T>,
  escopo: "equipe" | "minhas",
  meuColabId: string | null | undefined,
): T[] {
  if (escopo === "equipe") return [...rows];
  if (!meuColabId) return [];
  return rows.filter((r) => isAtribuidoA(r, meuColabId));
}

// ---------------------------------------------------------------------------
// Regras de "ativo" / "atrasado" — centralizadas para evitar reimplementação
// nas telas de Dashboard, Atividades e Minhas Atribuições.
// ---------------------------------------------------------------------------

/** Converte string ISO/Date para Date; retorna null se inválido. */
function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/** Data passou (é menor que agora). Se `v` é null/undefined, retorna false. */
export function isAtrasado(v: string | Date | null | undefined): boolean {
  const d = toDate(v);
  if (!d) return false;
  return d.getTime() < Date.now();
}

/** Status considerado "encerrado" para tarefas. */
const TAREFA_ENCERRADAS = new Set([
  "encerrada",
  "concluida",
  "producao",
  "reprovada",
  "cancelada",
]);

export function isTarefaAtiva(t: {
  status?: string | null;
  data_prevista?: string | null;
}): boolean {
  const s = (t.status ?? "").toLowerCase();
  if (TAREFA_ENCERRADAS.has(s)) return false;
  return !isAtrasado(t.data_prevista);
}

const DEMANDA_ENCERRADAS = new Set(["concluida", "cancelada"]);
export function isDemandaAtiva(d: {
  status?: string | null;
  prazo?: string | null;
}): boolean {
  const s = (d.status ?? "").toLowerCase();
  if (DEMANDA_ENCERRADAS.has(s)) return false;
  return !isAtrasado(d.prazo);
}

const REUNIAO_ENCERRADAS = new Set(["realizada", "cancelada"]);
export function isReuniaoAtiva(r: {
  status?: string | null;
  data_reuniao?: string | null;
}): boolean {
  const s = (r.status ?? "").toLowerCase();
  if (REUNIAO_ENCERRADAS.has(s)) return false;
  return !isAtrasado(r.data_reuniao);
}

const CHAMADO_ATIVOS = new Set(["pendente", "feito", "aberto", "encaminhado"]);
export function isChamadoAtivo(c: { status?: string | null }): boolean {
  const s = (c.status ?? "").toLowerCase();
  return CHAMADO_ATIVOS.has(s);
}
