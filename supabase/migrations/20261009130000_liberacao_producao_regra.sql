-- Liberação em produção, parte 2: a regra e um ajuste da confirmação (aplicar só no merge do PR #15, depois da
-- aprovação do Nickolas na prévia). Ver a parte 1 para o contexto.
--
-- A partir daqui, a tarefa só entra em Produção com as três confirmações, por qualquer
-- caminho (Kanban, lote, gaveta). Vale também para as 26 tarefas que estavam em Pré-build
-- (decisão do Nickolas em 09/10/2026: regra nova para todas).

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

-- 3. Confirmar duas vezes não regrava ----------------------------------------------------------
-- No teste da prévia (08/10), a "Versão publicada" da 9408 foi confirmada duas vezes seguidas: a
-- segunda regravava data e autor e duplicava o histórico. Agora só muda a tarefa cuja etapa
-- ainda está no estado oposto, e o histórico registra só as que mudaram.
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
  v_mudadas uuid[];
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
    WITH m AS (
      UPDATE public.todo SET
        liberacao_versao_em = CASE WHEN p_marcar THEN v_agora END,
        liberacao_versao_por = CASE WHEN p_marcar THEN v_autor END
      WHERE id = ANY (p_ids) AND status IN ('pre_build', 'producao')
        AND (liberacao_versao_em IS NULL) = p_marcar
      RETURNING id)
    SELECT array_agg(id) INTO v_mudadas FROM m;
  ELSIF p_etapa = 'acesso' THEN
    v_rotulo := CASE WHEN p_dispensada THEN 'Acessos: não precisa liberar' ELSE 'Acessos liberados' END;
    WITH m AS (
      UPDATE public.todo SET
        liberacao_acesso_em = CASE WHEN p_marcar THEN v_agora END,
        liberacao_acesso_por = CASE WHEN p_marcar THEN v_autor END,
        liberacao_acesso_dispensada = p_marcar AND p_dispensada,
        liberacao_objetos = CASE WHEN p_marcar AND NOT p_dispensada THEN btrim(p_objetos) END
      WHERE id = ANY (p_ids) AND status IN ('pre_build', 'producao')
        AND (liberacao_acesso_em IS NULL) = p_marcar
      RETURNING id)
    SELECT array_agg(id) INTO v_mudadas FROM m;
  ELSIF p_etapa = 'validacao' THEN
    v_rotulo := 'Validada em produção';
    WITH m AS (
      UPDATE public.todo SET
        liberacao_validada_em = CASE WHEN p_marcar THEN v_agora END,
        liberacao_validada_por = CASE WHEN p_marcar THEN v_autor END
      WHERE id = ANY (p_ids) AND status IN ('pre_build', 'producao')
        AND (liberacao_validada_em IS NULL) = p_marcar
      RETURNING id)
    SELECT array_agg(id) INTO v_mudadas FROM m;
  ELSE
    RAISE EXCEPTION 'Etapa desconhecida: %', p_etapa;
  END IF;

  INSERT INTO public.todo_historico (todo_id, autor_id, autor_nome, campo, valor_antigo, valor_novo)
  SELECT id, v_uid, v_autor, 'liberacao',
         CASE WHEN p_marcar THEN NULL ELSE v_rotulo END,
         CASE WHEN p_marcar THEN v_rotulo || CASE WHEN p_etapa = 'acesso' AND NOT p_dispensada
                                             THEN ': ' || btrim(p_objetos) ELSE '' END END
    FROM unnest(COALESCE(v_mudadas, '{}')) AS id;

  UPDATE public.todo SET status = 'producao', concluida_em = v_agora
   WHERE id = ANY (p_ids)
     AND status = 'pre_build'
     AND liberacao_versao_em IS NOT NULL
     AND liberacao_acesso_em IS NOT NULL
     AND liberacao_validada_em IS NOT NULL;
  GET DIAGNOSTICS v_em_producao = ROW_COUNT;

  RETURN jsonb_build_object('atualizadas', COALESCE(array_length(v_mudadas, 1), 0), 'em_producao', v_em_producao);
END;
$$;
