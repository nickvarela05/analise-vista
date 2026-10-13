// Observação do teste (T3 da análise de uso, 13/10/2026). Ao marcar "com ressalvas" ou
// "reprovado", a observação passa a ser obrigatória, porque é ela que vai no e-mail do Fechar
// rodada. Fica gravada como comentário da tarefa (sem coluna nova no banco) e o Fechar rodada
// já começa preenchido com ela.

/** Status que exigem observação, com o rótulo usado no comentário. */
export const STATUS_COM_OBSERVACAO: Record<string, string> = {
  aprovado_ressalvas: "Com ressalvas",
  reprovado: "Reprovado",
};

export function exigeObservacao(status: string): boolean {
  return status in STATUS_COM_OBSERVACAO;
}

/** Texto do comentário gravado na tarefa. */
export function comentarioObservacao(status: string, texto: string): string {
  return `Observação do teste (${STATUS_COM_OBSERVACAO[status] ?? status}): ${texto.trim()}`;
}

const PADRAO = /^Observação do teste \((Com ressalvas|Reprovado)\): ([\s\S]+)$/;

/** Lê a observação de um comentário gravado por `comentarioObservacao`; `null` se não for um. */
export function lerObservacao(conteudo: string): string | null {
  const m = PADRAO.exec(conteudo.trim());
  return m ? m[2].trim() : null;
}

/**
 * Observação mais recente por tarefa, a partir dos comentários (mais novo primeiro ou não).
 * Usada para pré-preencher o Fechar rodada.
 */
export function ultimasObservacoes(
  comentarios: readonly { todo_id: string; conteudo: string; created_at: string }[],
): Record<string, string> {
  const out: Record<string, { texto: string; em: string }> = {};
  for (const c of comentarios) {
    const texto = lerObservacao(c.conteudo);
    if (!texto) continue;
    const atual = out[c.todo_id];
    if (!atual || c.created_at > atual.em) out[c.todo_id] = { texto, em: c.created_at };
  }
  return Object.fromEntries(Object.entries(out).map(([id, v]) => [id, v.texto]));
}
