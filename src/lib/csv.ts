/**
 * Gera CSV (separador vírgula; com o BOM UTF-8 o Excel em português abre certo) a partir de
 * linhas de objeto. Substituiu o XLSX.utils.sheet_to_csv quando a biblioteca xlsx saiu
 * (14/10/2026). Campos com vírgula, aspas ou quebra de linha vão entre aspas.
 */
export function paraCsv(linhas: readonly Record<string, unknown>[]): string {
  const colunas = Array.from(new Set(linhas.flatMap((l) => Object.keys(l))));
  const campo = (v: unknown) => {
    const t = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return [
    colunas.map(campo).join(","),
    ...linhas.map((l) => colunas.map((c) => campo(l[c])).join(",")),
  ].join("\n");
}
