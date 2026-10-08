-- Liberação em produção (proposta do Nickolas em 08/10/2026, refinada pelo Claude).
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

-- 2. Regra: só entra em Produção com as três confirmações ---------------------------------------
-- Vale para qualquer caminho (Kanban, mudança em lote, gaveta da tarefa). Ao voltar para
-- Homologação (nova rodada, nova versão), as confirmações são zeradas.
CREATE OR REPLACE FUNCTION public.todo_regra_liberacao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_falta text[] := '{}';
BEGIN
  IF NEW.status = 'producao' AND OLD.status IS DISTINCT FROM 'producao' THEN
    IF NEW.liberacao_versao_em IS NULL THEN v_falta := array_append(v_falta, 'versão publicada'); END IF;
    IF NEW.liberacao_acesso_em IS NULL THEN v_falta := array_append(v_falta, 'acessos liberados'); END IF;
    IF NEW.liberacao_validada_em IS NULL THEN v_falta := array_append(v_falta, 'validada em produção'); END IF;
    IF array_length(v_falta, 1) > 0 THEN
      RAISE EXCEPTION 'A tarefa % só vai para Produção depois de confirmar: %. Abra a tarefa e use "Liberação em produção".',
        COALESCE(NEW.numero_eproject::text, left(NEW.titulo, 40)), array_to_string(v_falta, ', ')
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NEW.status = 'homologacao' AND OLD.status IS DISTINCT FROM 'homologacao' THEN
    NEW.liberacao_versao_em := NULL;  NEW.liberacao_versao_por := NULL;
    NEW.liberacao_acesso_em := NULL;  NEW.liberacao_acesso_por := NULL;
    NEW.liberacao_acesso_dispensada := false;
    NEW.liberacao_objetos := NULL;
    NEW.liberacao_validada_em := NULL; NEW.liberacao_validada_por := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_todo_regra_liberacao ON public.todo;
CREATE TRIGGER trg_todo_regra_liberacao
  BEFORE UPDATE OF status ON public.todo
  FOR EACH ROW EXECUTE FUNCTION public.todo_regra_liberacao();

-- 3. Confirmar (ou desfazer) uma etapa ---------------------------------------------------------
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
         CASE WHEN p_marcar THEN v_rotulo || COALESCE(': ' || NULLIF(btrim(p_objetos), ''), '') END
    FROM public.todo t
   WHERE t.id = ANY (p_ids) AND t.status IN ('pre_build', 'producao');

  -- Completou as três: vai para Produção (a regra do item 2 confere de novo).
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
