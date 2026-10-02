/**
 * Aba aberta antes de uma publicação: cada publicação troca o nome dos arquivos de código, e a
 * aba antiga passa a pedir arquivos que não existem mais. O sintoma é uma página ou botão que
 * "não faz nada" (ex.: exportar Excel em Unidades, 02/10/2026). A saída é recarregar a página.
 */

const CHAVE = "nexus:recarga-por-atualizacao";

/** Erro típico de arquivo de código que sumiu depois de uma publicação. */
export function isStaleChunkError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  return /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(msg);
}

/**
 * Recarrega a página, no máximo uma vez a cada 30 s, para não entrar em laço se o problema
 * for outro (queda de rede, por exemplo).
 * @returns `true` se a recarga foi disparada.
 */
export function recarregarPorAtualizacao(): boolean {
  try {
    const ultima = Number(sessionStorage.getItem(CHAVE) ?? 0);
    if (Date.now() - ultima < 30_000) return false;
    sessionStorage.setItem(CHAVE, String(Date.now()));
  } catch {
    // Sem sessionStorage (modo restrito): recarrega mesmo assim.
  }
  window.location.reload();
  return true;
}
