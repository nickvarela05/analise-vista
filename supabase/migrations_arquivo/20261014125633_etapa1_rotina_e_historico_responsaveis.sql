-- Etapa 1 da Avaliação Geral (14/10/2026), parte autorizada pelo Nickolas ("pode desligar").
-- Aplicada em produção em 14/10/2026 (versão 20261014125633), depois de testada numa transação
-- desfeita.
-- 1. desliga a rotina que apagava responsáveis e participantes;
-- 2. o histórico de responsáveis passa a gravar os nomes (antes, só "N pessoa(s)").

-- 1. limpar_atribuicoes_finalizadas (3h, diária) tirava o responsável de tarefas encerradas ou em
-- Produção há 3 dias e os participantes de reuniões passadas (em 14/10: 93 tarefas e 18 reuniões
-- sem ninguém). As telas novas já filtram por status. A função fica, sem agendamento.
SELECT cron.unschedule('limpar-atribuicoes-finalizadas-diario')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'limpar-atribuicoes-finalizadas-diario');

-- 2. Nomes dos responsáveis, gravados pelo banco a partir de qualquer caminho.
CREATE OR REPLACE FUNCTION public.nomes_responsaveis(_ids uuid[], _unico uuid, _equipe boolean)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _equipe THEN 'Equipe toda'
    ELSE NULLIF(
      (SELECT string_agg(c.nome, ', ' ORDER BY c.nome)
         FROM public.colaborador c
        WHERE c.id = ANY (COALESCE(_ids, '{}'::uuid[]) || CASE WHEN _unico IS NULL THEN '{}'::uuid[] ELSE ARRAY[_unico] END)),
      '')
  END
$$;

CREATE OR REPLACE FUNCTION public.todo_registrar_responsaveis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_autor text;
  v_antes text;
  v_depois text;
BEGIN
  v_depois := public.nomes_responsaveis(NEW.responsaveis_ids, NEW.responsavel_id, NEW.equipe_toda);
  IF TG_OP = 'UPDATE' THEN
    v_antes := public.nomes_responsaveis(OLD.responsaveis_ids, OLD.responsavel_id, OLD.equipe_toda);
    IF v_antes IS NOT DISTINCT FROM v_depois THEN
      RETURN NEW;
    END IF;
  ELSIF v_depois IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_uid IS NOT NULL THEN
    SELECT nome INTO v_autor FROM public.profiles WHERE user_id = v_uid;
  END IF;
  PERFORM set_config('nexus.historico_automatico', '1', true);
  INSERT INTO public.todo_historico (todo_id, autor_id, autor_nome, campo, valor_antigo, valor_novo)
  VALUES (NEW.id, v_uid, COALESCE(v_autor, 'Sistema (automático)'), 'responsaveis', v_antes, v_depois);
  PERFORM set_config('nexus.historico_automatico', '', true);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_todo_registrar_responsaveis ON public.todo;
CREATE TRIGGER trg_todo_registrar_responsaveis
  AFTER INSERT OR UPDATE OF responsaveis_ids, responsavel_id, equipe_toda ON public.todo
  FOR EACH ROW EXECUTE FUNCTION public.todo_registrar_responsaveis();

-- A gaveta da tarefa ainda grava "N pessoa(s)": esse registro passa a ser descartado.
CREATE OR REPLACE FUNCTION public.todo_historico_descartar_status_repetido()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('nexus.historico_automatico', true) = '1' THEN
    RETURN NEW;
  END IF;
  IF NEW.campo = 'responsaveis' THEN
    RETURN NULL;
  END IF;
  IF NEW.campo <> 'status' THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.todo_historico h
     WHERE h.todo_id = NEW.todo_id
       AND h.campo = 'status'
       AND h.valor_antigo IS NOT DISTINCT FROM NEW.valor_antigo
       AND h.valor_novo IS NOT DISTINCT FROM NEW.valor_novo
       AND h.created_at > now() - interval '2 minutes'
  ) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Higiene (Avaliação Geral, item 11): funções de gatilho não devem ser chamáveis pela API.
REVOKE EXECUTE ON FUNCTION public.todo_registrar_status() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.todo_registrar_responsaveis() FROM public, anon, authenticated;
