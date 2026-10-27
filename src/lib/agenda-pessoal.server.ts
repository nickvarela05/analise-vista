/**
 * Agenda pessoal do Nickolas no MemorIA (27/10/2026, pedido dele): o MemorIA lê daqui as reuniões e os
 * processos anuais em que ele é responsável, ou que são da equipe toda. Só leitura e só o mínimo:
 * título, data, hora, duração e status. Pauta, resumo, transcrição e descrição não saem do NEXUS.
 */

export type ReuniaoAgenda = {
  id: string;
  titulo: string;
  data_reuniao: string;
  duracao_min: number | null;
  status: string;
  equipe_toda: boolean;
  responsavel_id: string | null;
  responsaveis_ids: string[] | null;
};
export type ProcessoAgenda = {
  id: string;
  nome: string;
  previsto_inicio: string | null;
  previsto_fim: string | null;
  status: string;
  equipe_toda: boolean;
  responsaveis_ids: string[] | null;
};

/** É do colaborador: responsável (único ou na lista) ou item da equipe toda. */
export function ehDoColaborador(
  item: { equipe_toda: boolean; responsavel_id?: string | null; responsaveis_ids: string[] | null },
  colaboradorId: string,
) {
  return (
    item.equipe_toda ||
    item.responsavel_id === colaboradorId ||
    (item.responsaveis_ids ?? []).includes(colaboradorId)
  );
}

/** Corta as colunas para o mínimo combinado (o que sai do NEXUS). */
export function paraAgenda(
  reunioes: ReuniaoAgenda[],
  processos: ProcessoAgenda[],
  colaboradorId: string,
) {
  return {
    reunioes: reunioes
      .filter((r) => r.status !== "cancelada" && ehDoColaborador(r, colaboradorId))
      .map((r) => ({
        id: r.id,
        titulo: r.titulo,
        inicio: r.data_reuniao,
        duracaoMin: r.duracao_min,
        status: r.status,
      })),
    processos: processos
      .filter((p) => p.status !== "concluido" && ehDoColaborador(p, colaboradorId))
      .map((p) => ({
        id: p.id,
        nome: p.nome,
        inicio: p.previsto_inicio,
        fim: p.previsto_fim,
        status: p.status,
      })),
  };
}

const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Lê a janela pedida (no máximo 120 dias) para o colaborador do e-mail configurado. */
export async function lerAgendaPessoal(de: string, ate: string) {
  if (!DIA.test(de) || !DIA.test(ate) || de > ate) throw new Error("período inválido");
  if ((Date.parse(ate) - Date.parse(de)) / 86_400_000 > 120)
    throw new Error("período longo demais");
  const email = process.env.AGENDA_PESSOAL_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error("AGENDA_PESSOAL_EMAIL não configurado");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: perfil, error: erroPerfil } = await supabaseAdmin
    .from("profiles")
    .select("colaborador_id")
    .ilike("email", email)
    .maybeSingle();
  if (erroPerfil) throw new Error(erroPerfil.message);
  if (!perfil?.colaborador_id) throw new Error("colaborador do e-mail não encontrado");

  // data_reuniao é timestamp: a janela vai de 00:00 de "de" a 23:59 de "ate" em Brasília (UTC−3).
  const [reunioes, processos] = await Promise.all([
    supabaseAdmin
      .from("reuniao")
      .select(
        "id, titulo, data_reuniao, duracao_min, status, equipe_toda, responsavel_id, responsaveis_ids",
      )
      .gte("data_reuniao", `${de}T03:00:00Z`)
      .lt("data_reuniao", new Date(Date.parse(`${ate}T03:00:00Z`) + 86_400_000).toISOString()),
    supabaseAdmin
      .from("processo_anual")
      .select("id, nome, previsto_inicio, previsto_fim, status, equipe_toda, responsaveis_ids")
      .lte("previsto_inicio", ate)
      // sem fim previsto, vale só o início dentro da janela
      .or(`previsto_fim.gte.${de},and(previsto_fim.is.null,previsto_inicio.gte.${de})`),
  ]);
  if (reunioes.error) throw new Error(reunioes.error.message);
  if (processos.error) throw new Error(processos.error.message);
  return paraAgenda(reunioes.data ?? [], processos.data ?? [], perfil.colaborador_id);
}
