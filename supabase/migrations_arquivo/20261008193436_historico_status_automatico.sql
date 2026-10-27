-- Histórico de status gravado pelo próprio banco (autorizado pelo Nickolas em 08/10/2026).
--
-- Antes, cada tela gravava o histórico depois de mudar o status, e algumas não gravavam:
-- a mudança em lote em Tarefas (as 26 tarefas em Pré-build e as 59 de Produção → Encerrada
-- ficaram sem registro) e o Kanban gravava sem o nome do autor. Agora toda mudança de status,
-- venha de onde vier, gera uma linha em todo_historico, com o autor da sessão.
--
-- Também grava a criação (valor_antigo nulo), que é a entrada da tarefa no primeiro status:
-- é o início do teste das tarefas recebidas por pacote, usado pelo Painel da gestão.

-- 1. Gatilho em todo -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.todo_registrar_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER  -- grava mesmo quando a política de insert de todo_historico não deixaria
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_autor text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF current_setting('nexus.autor_sistema', true) = '1' THEN
    v_autor := 'Sistema (encerramento automático)';
    v_uid := NULL;
  ELSIF v_uid IS NOT NULL THEN
    SELECT nome INTO v_autor FROM public.profiles WHERE user_id = v_uid;
  END IF;

  -- Marca a gravação como automática para o filtro de duplicadas (item 2) deixar passar.
  PERFORM set_config('nexus.historico_automatico', '1', true);
  INSERT INTO public.todo_historico (todo_id, autor_id, autor_nome, campo, valor_antigo, valor_novo)
  VALUES (
    NEW.id,
    v_uid,
    COALESCE(v_autor, CASE WHEN v_uid IS NULL THEN 'Sistema (automático)' END),
    'status',
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.status::text END,
    NEW.status::text
  );
  PERFORM set_config('nexus.historico_automatico', '', true);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_todo_registrar_status ON public.todo;
CREATE TRIGGER trg_todo_registrar_status
  AFTER INSERT OR UPDATE OF status ON public.todo
  FOR EACH ROW EXECUTE FUNCTION public.todo_registrar_status();

-- 2. Filtro de duplicadas em todo_historico ----------------------------------------------------
-- As telas publicadas antes desta migração (e a função receber_pacote_homologacao) ainda gravam
-- o status por conta própria logo depois do update. Esse registro repete o do gatilho e é
-- descartado: mesma tarefa, mesma mudança, nos últimos 2 minutos.
CREATE OR REPLACE FUNCTION public.todo_historico_descartar_status_repetido()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.campo <> 'status' OR current_setting('nexus.historico_automatico', true) = '1' THEN
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
    RETURN NULL;  -- descarta
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_todo_historico_descartar_repetido ON public.todo_historico;
CREATE TRIGGER trg_todo_historico_descartar_repetido
  BEFORE INSERT ON public.todo_historico
  FOR EACH ROW EXECUTE FUNCTION public.todo_historico_descartar_status_repetido();

-- 3. Encerramento automático (tarefas com mais de 5 meses) ------------------------------------
-- A função roda com a sessão de quem abriu a tela de Tarefas; sem esta marca, o histórico
-- diria que essa pessoa encerrou as tarefas.
CREATE OR REPLACE FUNCTION public.auto_encerrar_tarefas_antigas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  PERFORM set_config('nexus.autor_sistema', '1', true);
  UPDATE public.todo
     SET status = 'encerrada'
   WHERE created_at < now() - INTERVAL '5 months'
     AND status IN (
       'aberta','em_andamento','homologacao','aprovado',
       'aprovado_ressalvas','reprovado','pendente','encaminhada'
     );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM set_config('nexus.autor_sistema', '', true);
  RETURN v_count;
END;
$function$;
