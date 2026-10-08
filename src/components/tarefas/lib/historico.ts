import { supabase } from "@/integrations/supabase/client";

/**
 * Grava em `todo_historico` a mudança de status de várias tarefas.
 *
 * Até 08/10/2026 a mudança de status em lote (Tarefas → Selecionar) não gravava histórico:
 * as 26 tarefas em Pré-build naquele dia não tinham registro de quando entraram lá, e a Central
 * não conseguia dizer há quantos dias esperam produção. Toda mudança de status em lote passa
 * por aqui.
 *
 * @returns o erro do insert, se houver (o status já foi mudado; o histórico é complementar).
 */
export async function registrarMudancaStatus(
  user: { id: string; email?: string | null },
  mudancas: readonly { id: string; de: string | null }[],
  para: string,
) {
  const alteradas = mudancas.filter((m) => m.de !== para);
  if (alteradas.length === 0) return null;
  const { data: perfil } = await supabase
    .from("profiles")
    .select("nome")
    .eq("user_id", user.id)
    .maybeSingle();
  const { error } = await supabase.from("todo_historico").insert(
    alteradas.map((m) => ({
      todo_id: m.id,
      autor_id: user.id,
      autor_nome: perfil?.nome ?? user.email ?? null,
      campo: "status",
      valor_antigo: m.de,
      valor_novo: para,
    })),
  );
  return error;
}
