/**
 * Schemas para importação de tarefas via planilha.
 *
 * - `linhaImportSchema`: valida uma linha já normalizada (após mapeamento
 *   de cabeçalhos/status/prioridade) antes de entrar em `linhas[]`.
 * - `loteImportSchema`: valida os metadados do lote de homologação.
 * - `parseLinhasImport`: aplica `safeParse` linha a linha, retornando
 *   `{ validas, erros }` com mensagens no formato "Linha N: <erro>".
 *
 * O mapeamento cru (buscarColuna/mapearStatus/mapearPrioridade) permanece
 * no componente — este schema é a última barreira antes do estado.
 */
import { z } from "zod";
import { emptyToNull } from "./_helpers";
import { WORKFLOW, PRIO } from "@/components/tarefas/lib/workflow";

export const linhaImportSchema = z.object({
  titulo: z.preprocess(
    (v) => {
      if (typeof v !== "string") return v;
      const t = v.trim();
      if (t.length <= 200) return t;
      // Otimiza: preserva início e finaliza com reticências, sem cortar no meio de palavra quando possível.
      const limite = 199;
      const corte = t.slice(0, limite);
      const ultimoEspaco = corte.lastIndexOf(" ");
      const base = ultimoEspaco > 150 ? corte.slice(0, ultimoEspaco) : corte;
      return `${base.trimEnd()}…`;
    },
    z
      .string()
      .trim()
      .min(1, "Título vazio")
      .max(200, "Título deve ter no máximo 200 caracteres"),
  ),
  descricao: z.preprocess(
    emptyToNull,
    z
      .string()
      .max(5000, "Descrição deve ter no máximo 5000 caracteres")
      .nullable(),
  ),
  status: z.enum(WORKFLOW),
  prioridade: z.enum(PRIO),
});

export type LinhaImport = z.infer<typeof linhaImportSchema>;

export const loteImportSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, "Informe o nome do lote")
    .max(120, "Nome do lote deve ter no máximo 120 caracteres"),
  descricao: z.preprocess(
    emptyToNull,
    z
      .string()
      .max(500, "Descrição do lote deve ter no máximo 500 caracteres")
      .nullable(),
  ),
});

export type LoteImport = z.infer<typeof loteImportSchema>;

/**
 * Aplica `linhaImportSchema.safeParse` a cada linha. A numeração dos erros
 * assume cabeçalho na linha 1 da planilha (idx 0 → "Linha 2").
 */
export function parseLinhasImport(
  rows: unknown[],
): { validas: LinhaImport[]; erros: string[] } {
  const validas: LinhaImport[] = [];
  const erros: string[] = [];
  rows.forEach((row, idx) => {
    const parsed = linhaImportSchema.safeParse(row);
    if (parsed.success) {
      validas.push(parsed.data);
      return;
    }
    const msg = parsed.error.issues
      .map((i) => `${i.path.join(".") || "linha"}: ${i.message}`)
      .join("; ");
    erros.push(`Linha ${idx + 2}: ${msg}`);
  });
  return { validas, erros };
}
