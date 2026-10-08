// Liberação em produção (09/10/2026): três confirmações por tarefa antes de ela entrar em
// Produção. A regra vale no banco (trg_todo_regra_liberacao); aqui só a leitura para a tela.
import { supabase } from "@/integrations/supabase/client";
import type { TarefaRow } from "@/lib/db-types";

export type EtapaLiberacao = "versao" | "acesso" | "validacao";

type Campos = Pick<
  TarefaRow,
  | "liberacao_versao_em"
  | "liberacao_versao_por"
  | "liberacao_acesso_em"
  | "liberacao_acesso_por"
  | "liberacao_acesso_dispensada"
  | "liberacao_objetos"
  | "liberacao_validada_em"
  | "liberacao_validada_por"
>;

export type EstadoEtapa = {
  etapa: EtapaLiberacao;
  rotulo: string;
  feita: boolean;
  por: string | null;
  em: string | null;
};

export const ROTULO_ETAPA: Record<EtapaLiberacao, string> = {
  versao: "Versão publicada",
  acesso: "Acessos liberados",
  validacao: "Validada em produção",
};

/** As três etapas, na ordem em que acontecem. */
export function etapasLiberacao(t: Partial<Campos>): EstadoEtapa[] {
  return [
    {
      etapa: "versao",
      rotulo: ROTULO_ETAPA.versao,
      feita: !!t.liberacao_versao_em,
      por: t.liberacao_versao_por ?? null,
      em: t.liberacao_versao_em ?? null,
    },
    {
      etapa: "acesso",
      rotulo: t.liberacao_acesso_dispensada ? "Acessos: não precisa liberar" : ROTULO_ETAPA.acesso,
      feita: !!t.liberacao_acesso_em,
      por: t.liberacao_acesso_por ?? null,
      em: t.liberacao_acesso_em ?? null,
    },
    {
      etapa: "validacao",
      rotulo: ROTULO_ETAPA.validacao,
      feita: !!t.liberacao_validada_em,
      por: t.liberacao_validada_por ?? null,
      em: t.liberacao_validada_em ?? null,
    },
  ];
}

/** O que falta, em texto curto ("falta: acesso, validação"); vazio quando está tudo confirmado. */
export function faltaLiberacao(t: Partial<Campos>): string[] {
  const curto: Record<EtapaLiberacao, string> = {
    versao: "versão",
    acesso: "acesso",
    validacao: "validação",
  };
  return etapasLiberacao(t)
    .filter((e) => !e.feita)
    .map((e) => curto[e.etapa]);
}

/**
 * Chama `confirmar_liberacao` e atualiza as telas. Quando a terceira etapa é confirmada, o banco
 * move a tarefa de Pré-build para Produção sozinho.
 */
export async function confirmarLiberacao(
  ids: string[],
  etapa: EtapaLiberacao,
  opcoes: { marcar?: boolean; objetos?: string; dispensada?: boolean } = {},
) {
  const { data, error } = await supabase.rpc("confirmar_liberacao", {
    p_ids: ids,
    p_etapa: etapa,
    p_marcar: opcoes.marcar ?? true,
    p_objetos: opcoes.objetos,
    p_dispensada: opcoes.dispensada ?? false,
  });
  if (error) throw error;
  return data as { atualizadas: number; em_producao: number };
}
