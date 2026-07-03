/** Helpers compartilhados por schemas Zod. */

export const emptyToNull = (v: unknown) =>
  typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v ?? null;

/** Valida se uma string yyyy-mm-dd representa uma data real (rejeita 2026-02-31). */
export const isRealDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
};

export const todayISO = () => new Date().toISOString().slice(0, 10);
