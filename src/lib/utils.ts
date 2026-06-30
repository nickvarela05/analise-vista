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

/**
 * @description Extrai uma mensagem legível de um valor de erro `unknown` capturado em `catch`.
 * Aceita `Error`, `string` e objetos com propriedade `message: string`.
 * @param e Valor capturado em `catch (e: unknown)`.
 * @param fallback Mensagem usada quando nenhuma extração funciona.
 * @returns Mensagem segura para exibição (toast, log).
 */
export function getErrorMessage(e: unknown, fallback = "Erro desconhecido"): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  return fallback;
}
