-- Liberação em produção, parte 1: estrutura (proposta do Nickolas em 08/10/2026, refinada pelo Claude).
--
-- Problema: depois que a versão sobe, é preciso liberar o acesso dos usuários em produção
-- (objetos vinculados aos grupos de usuários, conforme "Versões do sistema" no GED e o
-- E-project). Não havia controle disso além de arrastar o card de Pré-build para Produção.
--
-- Agora cada tarefa tem três confirmações, com quem confirmou e quando:
--   1. Versão publicada;
--   2. Acessos liberados (com os objetos/grupos anotados, ou "não precisa liberar");
--   3. Validada em produção.
-- A tarefa só entra em Produção com as três, e entra sozinha quando a terceira é confirmada.
-- Qualquer usuário do Nexus pode confirmar (decisão do Nickolas em 08/10/2026).

-- Parte 1 de 2 (aplicada em 09/10/2026 com autorização do Nickolas, antes do teste da prévia):
-- só cria colunas vazias e a função de confirmar; não muda nada no sistema em uso.
-- A regra que bloqueia a entrada em Produção está na parte 2, aplicada só no merge.

-- 1. Colunas -----------------------------------------------------------------------------------
ALTER TABLE public.todo
  ADD COLUMN IF NOT EXISTS liberacao_versao_em timestamptz,
  ADD COLUMN IF NOT EXISTS liberacao_versao_por text,
  ADD COLUMN IF NOT EXISTS liberacao_acesso_em timestamptz,
  ADD COLUMN IF NOT EXISTS liberacao_acesso_por text,
  ADD COLUMN IF NOT EXISTS liberacao_acesso_dispensada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS liberacao_objetos text,
  ADD COLUMN IF NOT EXISTS liberacao_validada_em timestamptz,
  ADD COLUMN IF NOT EXISTS liberacao_validada_por text;

COMMENT ON COLUMN public.todo.liberacao_objetos IS
  'Objetos e grupos de usuários liberados em produção (ver "Versões do sistema" no GED e o E-project).';
COMMENT ON COLUMN public.todo.liberacao_acesso_dispensada IS
  'A tarefa não cria objeto novo: não há acesso a liberar. Conta como confirmação de acesso.';

-- 2. Confirmar (ou desfazer) uma etapa ---------------------------------------------------------
-- SECURITY DEFINER porque qualquer usuário confirma, inclusive quem não é gestor nem
-- responsável pela tarefa (a política de update de todo não deixaria). Mexe só nos campos de
-- liberação e, ao completar as três etapas de uma tarefa em Pré-build, no status.
--
-- p_etapa: 'versao' | 'acesso' | 'validacao'
-- p_marcar: true confirma; false desfaz
-- p_objetos / p_dispensada: só para 'acesso'
CREATE OR REPLACE FUNCTION public.confirmar_liberacao(
  p_ids uuid[],
  p_etapa text,
  p_marcar boolean DEFAULT true,
  p_objetos text DEFAULT NULL,
  p_dispensada boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_autor text;
  v_agora timestamptz := now();
  v_rotulo text;
  v_atualizadas int := 0;
  v_em_producao int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sessão expirada. Entre de novo e repita.';
  END IF;
  SELECT nome INTO v_autor FROM public.profiles WHERE user_id = v_uid;
  IF v_autor IS NULL THEN
    RAISE EXCEPTION 'Usuário sem perfil no Nexus.';
  END IF;
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Nenhuma tarefa selecionada.';
  END IF;
  IF p_etapa = 'acesso' AND p_marcar AND NOT p_dispensada AND COALESCE(btrim(p_objetos), '') = '' THEN
    RAISE EXCEPTION 'Anote os objetos e grupos liberados, ou marque que a tarefa não precisa de liberação.';
  END IF;

  IF p_etapa = 'versao' THEN
    v_rotulo := 'Versão publicada';
    UPDATE public.todo SET
      liberacao_versao_em = CASE WHEN p_marcar THEN v_agora END,
      liberacao_versao_por = CASE WHEN p_marcar THEN v_autor END
    WHERE id = ANY (p_ids) AND status IN ('pre_build', 'producao');
  ELSIF p_etapa = 'acesso' THEN
    v_rotulo := CASE WHEN p_dispensada THEN 'Acessos: não precisa liberar' ELSE 'Acessos liberados' END;
    UPDATE public.todo SET
      liberacao_acesso_em = CASE WHEN p_marcar THEN v_agora END,
      liberacao_acesso_por = CASE WHEN p_marcar THEN v_autor END,
      liberacao_acesso_dispensada = p_marcar AND p_dispensada,
      liberacao_objetos = CASE WHEN p_marcar AND NOT p_dispensada THEN btrim(p_objetos) END
    WHERE id = ANY (p_ids) AND status IN ('pre_build', 'producao');
  ELSIF p_etapa = 'validacao' THEN
    v_rotulo := 'Validada em produção';
    UPDATE public.todo SET
      liberacao_validada_em = CASE WHEN p_marcar THEN v_agora END,
      liberacao_validada_por = CASE WHEN p_marcar THEN v_autor END
    WHERE id = ANY (p_ids) AND status IN ('pre_build', 'producao');
  ELSE
    RAISE EXCEPTION 'Etapa desconhecida: %', p_etapa;
  END IF;
  GET DIAGNOSTICS v_atualizadas = ROW_COUNT;

  INSERT INTO public.todo_historico (todo_id, autor_id, autor_nome, campo, valor_antigo, valor_novo)
  SELECT t.id, v_uid, v_autor, 'liberacao',
         CASE WHEN p_marcar THEN NULL ELSE v_rotulo END,
         CASE WHEN p_marcar THEN v_rotulo || CASE WHEN p_etapa = 'acesso' AND NOT p_dispensada
                                             THEN ': ' || btrim(p_objetos) ELSE '' END END
    FROM public.todo t
   WHERE t.id = ANY (p_ids) AND t.status IN ('pre_build', 'producao');

  -- Completou as três: vai para Produção (a regra da parte 2, quando aplicada, confere de novo).
  UPDATE public.todo SET status = 'producao', concluida_em = v_agora
   WHERE id = ANY (p_ids)
     AND status = 'pre_build'
     AND liberacao_versao_em IS NOT NULL
     AND liberacao_acesso_em IS NOT NULL
     AND liberacao_validada_em IS NOT NULL;
  GET DIAGNOSTICS v_em_producao = ROW_COUNT;

  RETURN jsonb_build_object('atualizadas', v_atualizadas, 'em_producao', v_em_producao);
END;
$$;

REVOKE ALL ON FUNCTION public.confirmar_liberacao(uuid[], text, boolean, text, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.confirmar_liberacao(uuid[], text, boolean, text, boolean) TO authenticated;
