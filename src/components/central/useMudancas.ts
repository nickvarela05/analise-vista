import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isAtribuidoA } from "@/lib/domain/atividades";
import type { Mudanca } from "./lib/mudancas";

type Comentario = {
  todo_id: string;
  titulo: string;
  autor: string | null;
  conteudo: string;
  em: string;
};
type Pacote = { id: string; nome: string; total: number; em: string };

export type Mudancas = {
  desde: string;
  historico: Mudanca[];
  pacotes: Pacote[];
  comentarios: Comentario[];
};

const CHAVE_VISITA = ["central", "visita"] as const;

/**
 * Registra a abertura da Central e traz o que outras pessoas mudaram desde a visita anterior.
 * Se a função do banco ainda não existir (prévia antes da migração), devolve `null` e o painel
 * não aparece, em vez de quebrar a Central.
 */
export function useMudancas(userId: string | undefined, meuColabId: string | null) {
  const qc = useQueryClient();

  const visita = useQuery({
    queryKey: [...CHAVE_VISITA, userId],
    enabled: !!userId,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("registrar_visita_central");
      if (error) return null;
      return (data as string | null) ?? null;
    },
  });
  const desde = visita.data ?? null;

  const mudancas = useQuery({
    queryKey: ["tarefas", "mudancas", desde, meuColabId],
    enabled: !!desde && !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<Mudancas> => {
      const [hist, lotes, coments] = await Promise.all([
        supabase
          .from("todo_historico")
          .select("todo_id, campo, valor_novo, autor_id, autor_nome, created_at, todo(titulo)")
          .in("campo", ["status", "liberacao"])
          .gt("created_at", desde!)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("todo_importacao_lote")
          .select("id, nome, total_tarefas, created_at, criado_por")
          .gt("created_at", desde!)
          .order("created_at", { ascending: false }),
        supabase
          .from("todo_comentario")
          .select(
            "todo_id, autor_id, autor_nome, conteudo, created_at, todo(titulo, responsaveis_ids, responsavel_id, equipe_toda)",
          )
          .gt("created_at", desde!)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);
      if (hist.error) throw hist.error;
      if (lotes.error) throw lotes.error;
      if (coments.error) throw coments.error;
      const deOutro = (autor: string | null) => autor !== userId;
      return {
        desde: desde!,
        historico: (hist.data ?? [])
          .filter((h) => deOutro(h.autor_id))
          .map((h) => ({
            todo_id: h.todo_id,
            titulo: (h.todo as { titulo: string } | null)?.titulo ?? "Tarefa",
            campo: h.campo,
            para: h.valor_novo,
            autor: h.autor_nome,
            em: h.created_at,
          })),
        pacotes: (lotes.data ?? [])
          .filter((l) => deOutro(l.criado_por))
          .map((l) => ({ id: l.id, nome: l.nome, total: l.total_tarefas, em: l.created_at })),
        comentarios: (coments.data ?? [])
          .filter((c) => {
            const t = c.todo as Parameters<typeof isAtribuidoA>[0] | null;
            return deOutro(c.autor_id) && !!t && isAtribuidoA(t, meuColabId);
          })
          .map((c) => ({
            todo_id: c.todo_id,
            titulo: (c.todo as { titulo: string } | null)?.titulo ?? "Tarefa",
            autor: c.autor_nome,
            conteudo: c.conteudo,
            em: c.created_at,
          })),
      };
    },
  });

  /** "Marcar como visto": a lista recomeça de agora. */
  const marcarVisto = async () => {
    const { data } = await supabase.rpc("registrar_visita_central", { p_marcar_visto: true });
    qc.setQueryData([...CHAVE_VISITA, userId], (data as string | null) ?? null);
  };

  return { desde, dados: mudancas.data ?? null, carregando: mudancas.isLoading, marcarVisto };
}
