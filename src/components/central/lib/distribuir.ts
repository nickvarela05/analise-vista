// Distribuir os testes da rodada em lote (T1 da análise de uso, fase 2 do layout, 09/10/2026).
// Antes, cada tarefa recebia responsável no card, uma a uma.

type Item = { id: string; sistema: string | null; titulo: string };

/** Mesma ordem que a pessoa vê na lista: por sistema, depois pelo título (que começa pelo número). */
function ordenar<T extends Item>(tarefas: readonly T[]): T[] {
  return [...tarefas].sort(
    (a, b) =>
      (a.sistema ?? "~").localeCompare(b.sistema ?? "~") ||
      a.titulo.localeCompare(b.titulo, "pt-BR", { numeric: true }),
  );
}

/**
 * Partes iguais: divide a lista, ordenada por sistema, em blocos seguidos (diferença de no
 * máximo 1 tarefa entre as pessoas). Blocos seguidos mantêm as tarefas do mesmo sistema com a
 * mesma pessoa sempre que o tamanho do bloco permite.
 * @returns tarefa → colaborador
 */
export function distribuirIguais(
  tarefas: readonly Item[],
  pessoas: readonly string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  if (pessoas.length === 0) return out;
  const lista = ordenar(tarefas);
  const base = Math.floor(lista.length / pessoas.length);
  const sobra = lista.length % pessoas.length;
  let i = 0;
  pessoas.forEach((p, k) => {
    const n = base + (k < sobra ? 1 : 0);
    for (let j = 0; j < n; j++) out[lista[i++].id] = p;
  });
  return out;
}

/**
 * Por sistema: cada sistema vai para a pessoa escolhida. Sistema sem pessoa escolhida fica de
 * fora (a tarefa continua sem responsável).
 * @param mapa sistema → colaborador ("" para tarefas sem sistema)
 */
export function distribuirPorSistema(
  tarefas: readonly Item[],
  mapa: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of tarefas) {
    const p = mapa[t.sistema ?? ""];
    if (p) out[t.id] = p;
  }
  return out;
}

/** Agrupa por pessoa, para gravar com um update por pessoa. */
export function agruparPorPessoa(
  atribuicao: Readonly<Record<string, string>>,
): Record<string, string[]> {
  const g: Record<string, string[]> = {};
  for (const [tarefa, pessoa] of Object.entries(atribuicao)) (g[pessoa] ??= []).push(tarefa);
  return g;
}
