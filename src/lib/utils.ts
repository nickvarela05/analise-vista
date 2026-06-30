import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * @description Combina classes Tailwind/CSS resolvendo conflitos via tailwind-merge.
 * @param inputs Lista de classes (strings, arrays, objetos condicionais).
 * @returns String final de classes pronta para `className`.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * @description Formata um tamanho em bytes para uma string legível (B / KB / MB).
 * @param bytes Quantidade de bytes (>= 0).
 * @returns Representação humana, ex: `1.5 MB`.
 * @example
 * formatBytes(2048) // => "2.0 KB"
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
