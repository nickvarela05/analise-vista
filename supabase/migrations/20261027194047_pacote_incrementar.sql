-- Receber pacote: opção de adicionar as tarefas a um pacote que já existe, porque o
-- desenvolvimento manda mais tarefas do mesmo pacote nos dias seguintes. Autorizado pelo
-- Nickolas em 27/10/2026. Só a função muda; nenhuma tabela nem dado.
-- Sem p_lote_id, o comportamento é o de antes (cria um pacote novo).
DROP FUNCTION IF EXISTS public.receber_pacote_homologacao(text, text, jsonb);

CREATE FUNCTION public.receber_pacote_homologacao(
  p_nome text,
  p_descricao text,
  p_itens jsonb,
  p_lote_id uuid DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_autor text;
  v_lote uuid;
  v_item jsonb;
  v_acao text;
  v_id uuid;
  v_antigo text;
  v_no_lote int;
  v_criadas int := 0;
  v_movidas int := 0;
  v_dados int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sessão expirada. Entre de novo e repita.';
  END IF;
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Nenhuma tarefa para receber.';
  END IF;
  IF p_lote_id IS NULL AND COALESCE(btrim(p_nome), '') = '' THEN
    RAISE EXCEPTION 'Informe o nome do lote.';
  END IF;

  SELECT nome INTO v_autor FROM public.profiles WHERE user_id = v_uid;

  SELECT count(*) INTO v_no_lote
    FROM jsonb_array_elements(p_itens) i
   WHERE i->>'acao' IN ('criar', 'mover');

  IF v_no_lote > 0 THEN
    IF p_lote_id IS NOT NULL THEN
      SELECT id INTO v_lote FROM public.todo_importacao_lote
       WHERE id = p_lote_id AND tipo = 'homologacao';
      IF v_lote IS NULL THEN
        RAISE EXCEPTION 'Pacote não encontrado. Nada foi gravado.';
      END IF;
    ELSE
      INSERT INTO public.todo_importacao_lote (nome, descricao, tipo, total_tarefas, criado_por)
      VALUES (btrim(p_nome), NULLIF(btrim(COALESCE(p_descricao, '')), ''), 'homologacao', v_no_lote, v_uid)
      RETURNING id INTO v_lote;
    END IF;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_acao := v_item->>'acao';

    IF v_acao = 'criar' THEN
      BEGIN
        INSERT INTO public.todo (
          titulo, status, prioridade, responsaveis_ids, equipe_toda, criado_por,
          lote_importacao_id, origem_importacao, em_teste,
          sistema, link_homologacao, observacao_homologacao, data_homologacao
        ) VALUES (
          left(v_item->>'titulo', 200), 'homologacao', 'media', '{}', false, v_uid,
          v_lote, 'homologacao', true,
          NULLIF(v_item->>'sistema', ''), NULLIF(v_item->>'link', ''),
          NULLIF(v_item->>'observacao', ''), NULLIF(v_item->>'data', '')::date
        );
      EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'A tarefa % já existe no Nexus. Nada foi gravado: feche, abra de novo e confira.',
          v_item->>'numero';
      END;
      v_criadas := v_criadas + 1;

    ELSIF v_acao = 'mover' THEN
      v_id := (v_item->>'id')::uuid;
      SELECT status::text INTO v_antigo FROM public.todo WHERE id = v_id FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'A tarefa % não foi encontrada. Nada foi gravado.', v_item->>'numero';
      END IF;
      UPDATE public.todo SET
        status = 'homologacao',
        em_teste = true,
        origem_importacao = 'homologacao',
        lote_importacao_id = v_lote,
        concluida_em = NULL,
        sistema = COALESCE(NULLIF(v_item->>'sistema', ''), sistema),
        link_homologacao = COALESCE(NULLIF(v_item->>'link', ''), link_homologacao),
        observacao_homologacao = COALESCE(NULLIF(v_item->>'observacao', ''), observacao_homologacao),
        data_homologacao = COALESCE(NULLIF(v_item->>'data', '')::date, data_homologacao)
      WHERE id = v_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Sem permissão para mover a tarefa %. Nada foi gravado.', v_item->>'numero';
      END IF;
      IF v_antigo IS DISTINCT FROM 'homologacao' THEN
        INSERT INTO public.todo_historico (todo_id, autor_id, autor_nome, campo, valor_antigo, valor_novo)
        VALUES (v_id, v_uid, v_autor, 'status', v_antigo, 'homologacao');
      END IF;
      v_movidas := v_movidas + 1;

    ELSIF v_acao = 'dados' THEN
      UPDATE public.todo SET
        sistema = COALESCE(NULLIF(v_item->>'sistema', ''), sistema),
        link_homologacao = COALESCE(NULLIF(v_item->>'link', ''), link_homologacao),
        observacao_homologacao = COALESCE(NULLIF(v_item->>'observacao', ''), observacao_homologacao),
        data_homologacao = COALESCE(NULLIF(v_item->>'data', '')::date, data_homologacao)
      WHERE id = (v_item->>'id')::uuid;
      IF FOUND THEN
        v_dados := v_dados + 1;
      END IF;

    ELSE
      RAISE EXCEPTION 'Ação desconhecida: %', v_acao;
    END IF;
  END LOOP;

  -- Pacote existente: o total passa a ser o número real de tarefas nele. A regra de acesso só
  -- deixa o criador ou um gestor atualizar o pacote; para os demais o total fica como estava,
  -- e as tarefas entram do mesmo jeito.
  IF p_lote_id IS NOT NULL AND v_lote IS NOT NULL THEN
    UPDATE public.todo_importacao_lote
       SET total_tarefas = (SELECT count(*) FROM public.todo WHERE lote_importacao_id = v_lote)
     WHERE id = v_lote;
  END IF;

  RETURN jsonb_build_object(
    'lote_id', v_lote,
    'criadas', v_criadas,
    'movidas', v_movidas,
    'atualizadas', v_dados
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.receber_pacote_homologacao(text, text, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receber_pacote_homologacao(text, text, jsonb, uuid) TO authenticated, service_role;
