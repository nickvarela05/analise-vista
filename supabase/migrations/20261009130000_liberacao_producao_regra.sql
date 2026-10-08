-- Liberação em produção, parte 2: a regra (aplicar só no merge do PR #15, depois da
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

