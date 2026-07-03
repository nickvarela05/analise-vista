/** Helpers compartilhados por schemas Zod. */
import { MAX_IMAGE_UPLOAD_BYTES, formatBytes } from "@/constants/upload";

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

/** Valida um arquivo de imagem. Retorna mensagem de erro ou null. */
export const validateImageFile = (file: File): string | null => {
  if (!file.type.startsWith("image/")) return "Arquivo deve ser uma imagem";
  if (file.size > MAX_IMAGE_UPLOAD_BYTES)
    return `Imagem muito grande (máx ${formatBytes(MAX_IMAGE_UPLOAD_BYTES)})`;
  return null;
};
