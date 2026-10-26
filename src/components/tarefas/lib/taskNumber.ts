/**
 * Extrai o "número da tarefa" a partir do título.
 * Exemplos aceitos:
 *   "Tarefa 12345 - Ajuste no relatório" -> "12345"
 *   "Tarefa: 987"                        -> "987"
 *   "#4210 revisar layout"               -> "4210"
 *   "12345 - Assunto"                    -> "12345"
 * Retorna null quando não encontra um número relevante (>= 2 dígitos).
 */
export function extractTaskNumber(titulo: string | null | undefined): string | null {
  const s = String(titulo ?? "");
  const m =
    s.match(/(?:tarefa|task)\s*[:#-]?\s*(\d{2,})/i) ??
    s.match(/#\s*(\d{2,})/) ??
    s.match(/^\s*(\d{2,})\b/);
  return m ? m[1] : null;
}

/** Normalização usada como fallback quando não há número na tarefa. */
export function normalizeTitle(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Chave de deduplicação: prefere o número da tarefa. Se não houver,
 * usa o título normalizado como fallback.
 */
export function taskDedupKey(titulo: string | null | undefined): string | null {
  const num = extractTaskNumber(titulo);
  if (num) return `n:${num}`;
  const t = normalizeTitle(titulo);
  return t ? `t:${t}` : null;
}

/**
 * Padrão de nome das tarefas (decisão do Nickolas, 26/10/2026): "Tarefa 9092 - título", o mesmo
 * que o "Receber pacote" grava e que ~8.900 tarefas já usam. Corrige "9092 - título",
 * "tarefa: 9092 título", espaços e tabulações sobrando; título sem número fica como está.
 */
export function padronizarTitulo(titulo: string): string {
  const t = titulo.replace(/\s+/g, " ").trim();
  const m =
    t.match(/^(?:tarefa|task)\s*[:#-]?\s*(\d{2,})\s*[-–:]?\s*(.*)$/i) ??
    t.match(/^#?\s*(\d{3,})\s*[-–:]\s*(.*)$/);
  if (!m) return t;
  const [, numero, resto] = m;
  return resto ? `Tarefa ${numero} - ${resto}` : `Tarefa ${numero}`;
}
