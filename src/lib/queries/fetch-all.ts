/**
 * @description Busca todas as linhas de uma consulta, página a página. O PostgREST (Supabase)
 * devolve no máximo 1.000 linhas por requisição; sem paginar, telas como o Dashboard viam só
 * 1.000 das ~9.100 tarefas e mostravam contagens erradas.
 * @param page Monta a consulta para o intervalo [from, to] (ex.: `.range(from, to)` no fim).
 *   Use uma ordenação estável (ex.: `order("id")`) para as páginas não se sobreporem.
 * @param pageSize Tamanho da página (padrão 1.000, o limite do servidor).
 * @returns Todas as linhas concatenadas.
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}
