-- Recebimento de pacotes de homologação pelo e-mail (decisões do Nickolas em 01/10/2026).
--
-- 1. Guarda no card o que o e-mail traz e antes se perdia: sistema, link do ambiente,
--    observação do desenvolvimento e data de homologação.
-- 2. Trava contra tarefa duplicada: cada card passa a ter o número do E-project em coluna
--    própria, com índice único. O número é extraído do título pela mesma regra do app
--    (src/components/tarefas/lib/taskNumber.ts).
-- 3. Recebimento "tudo ou nada": a função receber_pacote_homologacao cria o lote, as tarefas
--    novas e as movimentações numa transação só. Antes, um erro no meio deixava lote vazio.
--
-- PRÉ-REQUISITO: não pode haver dois cards com o mesmo número (em 01/10/2026 havia três:
-- 7217, 7596 e 9031). Se houver, a criação do índice único falha e nada é aplicado.

ALTER TABLE public.todo
  ADD COLUMN IF NOT EXISTS sistema text,
  ADD COLUMN IF NOT EXISTS link_homologacao text,
  ADD COLUMN IF NOT EXISTS observacao_homologacao text,
  ADD COLUMN IF NOT EXISTS data_homologacao date,
  ADD COLUMN IF NOT EXISTS numero_eproject bigint;

COMMENT ON COLUMN public.todo.sistema IS 'Sistema da tarefa no e-mail de homologação (GED, Maed, App - Aluno...).';
COMMENT ON COLUMN public.todo.link_homologacao IS 'Endereço do ambiente de homologação informado no e-mail.';
COMMENT ON COLUMN public.todo.observacao_homologacao IS 'Observação do desenvolvimento no e-mail de homologação.';
COMMENT ON COLUMN public.todo.data_homologacao IS 'Data em que a tarefa ficou disponível para teste ("Data de hml" do e-mail).';
COMMENT ON COLUMN public.todo.numero_eproject IS 'Número da tarefa no E-project, extraído do título. Único: impede card duplicado.';

-- Mesma regra de extractTaskNumber: "Tarefa 123", "#123" ou número no começo do título.
CREATE OR REPLACE FUNCTION public.todo_numero_do_titulo(p_titulo text)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(left(COALESCE(
    (regexp_match(p_titulo, '(?:tarefa|task)\s*[:#-]?\s*(\d{2,})', 'i'))[1],
    (regexp_match(p_titulo, '#\s*(\d{2,})'))[1],
    (regexp_match(p_titulo, '^\s*(\d{2,})\M'))[1]
  ), 15), '')::bigint;
$$;

CREATE OR REPLACE FUNCTION public.todo_set_numero_eproject()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.numero_eproject := public.todo_numero_do_titulo(NEW.titulo);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_todo_numero_eproject ON public.todo;
CREATE TRIGGER trg_todo_numero_eproject
  BEFORE INSERT OR UPDATE OF titulo ON public.todo
  FOR EACH ROW EXECUTE FUNCTION public.todo_set_numero_eproject();

-- Preenchimento das tarefas existentes com os gatilhos desligados: sem isso, o gatilho de
-- updated_at marcaria as ~8.900 tarefas como alteradas hoje (distorce histórico e a regra de
-- encerrar tarefas antigas), e o de notificação seria avaliado à toa.
ALTER TABLE public.todo DISABLE TRIGGER USER;
UPDATE public.todo
   SET numero_eproject = public.todo_numero_do_titulo(titulo)
 WHERE numero_eproject IS DISTINCT FROM public.todo_numero_do_titulo(titulo);
ALTER TABLE public.todo ENABLE TRIGGER USER;

CREATE UNIQUE INDEX IF NOT EXISTS todo_numero_eproject_unico
  ON public.todo (numero_eproject)
  WHERE numero_eproject IS NOT NULL;

-- Recebe um pacote. p_itens: [{ acao, numero, id?, titulo?, sistema?, link?, observacao?, data? }]
--   acao = 'criar'  -> card novo em Homologação, marcado "em teste"
--   acao = 'mover'  -> card existente (id) vai para Homologação neste lote
--   acao = 'dados'  -> card existente (id) só recebe sistema/link/observação/data
-- Roda com as permissões de quem chama (RLS vale). Qualquer erro desfaz tudo.
CREATE OR REPLACE FUNCTION public.receber_pacote_homologacao(
  p_nome text,
  p_descricao text,
  p_itens jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
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
  IF COALESCE(btrim(p_nome), '') = '' THEN
    RAISE EXCEPTION 'Informe o nome do lote.';
  END IF;

  SELECT nome INTO v_autor FROM public.profiles WHERE user_id = v_uid;

  SELECT count(*) INTO v_no_lote
    FROM jsonb_array_elements(p_itens) i
   WHERE i->>'acao' IN ('criar', 'mover');

  IF v_no_lote > 0 THEN
    INSERT INTO public.todo_importacao_lote (nome, descricao, tipo, total_tarefas, criado_por)
    VALUES (btrim(p_nome), NULLIF(btrim(COALESCE(p_descricao, '')), ''), 'homologacao', v_no_lote, v_uid)
    RETURNING id INTO v_lote;
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

  RETURN jsonb_build_object(
    'lote_id', v_lote,
    'criadas', v_criadas,
    'movidas', v_movidas,
    'atualizadas', v_dados
  );
END;
$$;

REVOKE ALL ON FUNCTION public.receber_pacote_homologacao(text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receber_pacote_homologacao(text, text, jsonb) TO authenticated;
