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

const PRIORIDADE_LABEL: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
  urgente: "Urgente",
};

/**
 * @description Rótulo em português (com acento) para o valor de prioridade gravado no banco.
 * Substitui o `capitalize` do CSS, que exibia "Media" e "Critica".
 * @param p Valor do banco (`baixa`, `media`, `alta`, `critica`, `urgente`).
 * @returns Rótulo de exibição; valores desconhecidos voltam como vieram.
 * @example
 * prioridadeLabel("media") // => "Média"
 */
export function prioridadeLabel(p: string | null | undefined): string {
  if (!p) return "";
  return PRIORIDADE_LABEL[p] ?? p;
}

/**
 * @description Iniciais do avatar: primeira letra do primeiro e do último nome.
 * Aceita nome ("Nickolas Brussolo Varela") ou e-mail ("nickolas.varela@..."), para o avatar
 * mostrar as mesmas iniciais no topo, no menu, no perfil e em Configurações.
 * @param texto Nome completo ou e-mail.
 * @returns Duas letras maiúsculas; "?" se vazio.
 * @example
 * iniciais("nickolas.varela@sisteplan.com.br") // => "NV"
 */
export function iniciais(texto: string | null | undefined): string {
  const partes = (texto ?? "").split("@")[0].split(/[\s._-]+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
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
