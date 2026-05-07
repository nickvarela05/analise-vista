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
