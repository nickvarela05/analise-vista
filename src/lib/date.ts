/**
 * Utilitários de data para colunas `date` (YYYY-MM-DD) do banco.
 *
 * `new Date("2026-07-30")` é interpretado como UTC meia-noite, o que no
 * fuso de Brasília (UTC-3) vira 29/07 21:00 — causando prazos exibidos
 * com um dia a menos. Sempre use `parseDateOnly` para essas colunas.
 */
export function parseDateOnly(value?: string | null): Date | null {
  if (!value) return null;
  const s = String(value).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Igual a `parseDateOnly`, mas lança/retorna data inválida em vez de null. */
export function parseDateOnlyOrNow(value?: string | null): Date {
  return parseDateOnly(value) ?? new Date();
}
