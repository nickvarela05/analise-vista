-- =========================================================================
-- FASE 2: Notificações in-app
-- =========================================================================

-- Enum de tipos
DO $$ BEGIN
  CREATE TYPE public.notificacao_tipo AS ENUM (
    'tarefa_atribuida',
    'tarefa_prazo',
    'tarefa_comentario',
    'tarefa_status',
    'demanda_atribuida',
    'demanda_urgente',
    'chamado_sla',
    'aviso_critico',
    'sistema'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notificacao_canal AS ENUM ('in_app', 'email');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================================
-- Tabela: notificacao
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.notificacao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tipo notificacao_tipo NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT,
  link TEXT,
  metadata JSONB,
  lida_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notificacao_user_unread
  ON public.notificacao (user_id, lida_em, created_at DESC);

ALTER TABLE public.notificacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuário vê suas notificações" ON public.notificacao;
CREATE POLICY "Usuário vê suas notificações"
  ON public.notificacao FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'gestor'::app_role));

DROP POLICY IF EXISTS "Usuário atualiza suas notificações" ON public.notificacao;
CREATE POLICY "Usuário atualiza suas notificações"
  ON public.notificacao FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Gestor deleta notificações" ON public.notificacao;
CREATE POLICY "Gestor deleta notificações"
  ON public.notificacao FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'gestor'::app_role) OR auth.uid() = user_id);

-- INSERT só via SECURITY DEFINER função (sem policy → bloqueado a clientes)

-- =========================================================================
-- Tabela: notificacao_preferencia
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.notificacao_preferencia (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  evento notificacao_tipo NOT NULL,
  canal notificacao_canal NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, evento, canal)
);

ALTER TABLE public.notificacao_preferencia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuário gerencia suas preferências" ON public.notificacao_preferencia;
CREATE POLICY "Usuário gerencia suas preferências"
  ON public.notificacao_preferencia FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_notif_pref_updated_at
  BEFORE UPDATE ON public.notificacao_preferencia
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- Função: enqueue_notificacao (SECURITY DEFINER)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.enqueue_notificacao(
  _user_id UUID,
  _tipo notificacao_tipo,
  _titulo TEXT,
  _mensagem TEXT DEFAULT NULL,
  _link TEXT DEFAULT NULL,
  _metadata JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_ativo BOOLEAN;
BEGIN
  IF _user_id IS NULL THEN RETURN NULL; END IF;

  -- respeita preferência in-app (default = ativo)
  SELECT ativo INTO v_ativo
    FROM public.notificacao_preferencia
   WHERE user_id = _user_id AND evento = _tipo AND canal = 'in_app';

  IF v_ativo IS FALSE THEN RETURN NULL; END IF;

  INSERT INTO public.notificacao (user_id, tipo, titulo, mensagem, link, metadata)
  VALUES (_user_id, _tipo, _titulo, _mensagem, _link, _metadata)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enqueue_notificacao(UUID, notificacao_tipo, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;

-- =========================================================================
-- Trigger: tarefa atribuída
-- =========================================================================
CREATE OR REPLACE FUNCTION public.notify_tarefa_atribuida()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_resp UUID;
  v_old_set UUID[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_old_set := ARRAY[]::UUID[];
  ELSE
    v_old_set := COALESCE(OLD.responsaveis_ids, ARRAY[]::UUID[]) ||
                 CASE WHEN OLD.responsavel_id IS NOT NULL THEN ARRAY[OLD.responsavel_id] ELSE ARRAY[]::UUID[] END;
  END IF;

  -- responsavel_id principal
  IF NEW.responsavel_id IS NOT NULL AND NOT (NEW.responsavel_id = ANY(v_old_set)) AND NEW.responsavel_id <> COALESCE(NEW.criado_por, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    PERFORM public.enqueue_notificacao(
      NEW.responsavel_id, 'tarefa_atribuida'::notificacao_tipo,
      'Nova tarefa atribuída', NEW.titulo, '/tarefas?id=' || NEW.id::text,
      jsonb_build_object('tarefa_id', NEW.id)
    );
  END IF;

  -- responsaveis_ids (múltiplos)
  IF NEW.responsaveis_ids IS NOT NULL THEN
    FOREACH v_resp IN ARRAY NEW.responsaveis_ids LOOP
      IF NOT (v_resp = ANY(v_old_set)) AND v_resp <> COALESCE(NEW.criado_por, '00000000-0000-0000-0000-000000000000'::uuid) THEN
        PERFORM public.enqueue_notificacao(
          v_resp, 'tarefa_atribuida'::notificacao_tipo,
          'Nova tarefa atribuída', NEW.titulo, '/tarefas?id=' || NEW.id::text,
          jsonb_build_object('tarefa_id', NEW.id)
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_tarefa_atribuida ON public.todo;
CREATE TRIGGER trg_notify_tarefa_atribuida
  AFTER INSERT OR UPDATE OF responsavel_id, responsaveis_ids ON public.todo
  FOR EACH ROW EXECUTE FUNCTION public.notify_tarefa_atribuida();

-- =========================================================================
-- Trigger: comentário em tarefa
-- =========================================================================
CREATE OR REPLACE FUNCTION public.notify_tarefa_comentario()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tarefa RECORD;
  v_destinatarios UUID[];
  v_user UUID;
BEGIN
  SELECT id, titulo, criado_por, responsavel_id, responsaveis_ids
    INTO v_tarefa FROM public.todo WHERE id = NEW.todo_id;
  IF v_tarefa.id IS NULL THEN RETURN NEW; END IF;

  v_destinatarios := COALESCE(v_tarefa.responsaveis_ids, ARRAY[]::UUID[]);
  IF v_tarefa.criado_por IS NOT NULL THEN v_destinatarios := v_destinatarios || v_tarefa.criado_por; END IF;
  IF v_tarefa.responsavel_id IS NOT NULL THEN v_destinatarios := v_destinatarios || v_tarefa.responsavel_id; END IF;

  FOREACH v_user IN ARRAY (SELECT array_agg(DISTINCT u) FROM unnest(v_destinatarios) u WHERE u IS NOT NULL AND u <> NEW.autor_id) LOOP
    PERFORM public.enqueue_notificacao(
      v_user, 'tarefa_comentario'::notificacao_tipo,
      'Novo comentário em "' || v_tarefa.titulo || '"',
      COALESCE(NEW.autor_nome, 'Alguém') || ': ' || left(NEW.conteudo, 140),
      '/tarefas?id=' || v_tarefa.id::text,
      jsonb_build_object('tarefa_id', v_tarefa.id, 'comentario_id', NEW.id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_tarefa_comentario ON public.todo_comentario;
CREATE TRIGGER trg_notify_tarefa_comentario
  AFTER INSERT ON public.todo_comentario
  FOR EACH ROW EXECUTE FUNCTION public.notify_tarefa_comentario();

-- =========================================================================
-- Trigger: demanda atribuída
-- =========================================================================
CREATE OR REPLACE FUNCTION public.notify_demanda_atribuida()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_resp UUID;
  v_old_set UUID[];
  v_tipo notificacao_tipo;
  v_titulo TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_old_set := ARRAY[]::UUID[];
  ELSE
    v_old_set := COALESCE(OLD.responsaveis_ids, ARRAY[]::UUID[]) ||
                 CASE WHEN OLD.responsavel_id IS NOT NULL THEN ARRAY[OLD.responsavel_id] ELSE ARRAY[]::UUID[] END;
  END IF;

  v_tipo := CASE WHEN NEW.prioridade = 'urgente' THEN 'demanda_urgente'::notificacao_tipo ELSE 'demanda_atribuida'::notificacao_tipo END;
  v_titulo := CASE WHEN NEW.prioridade = 'urgente' THEN 'Demanda URGENTE atribuída' ELSE 'Nova demanda atribuída' END;

  IF NEW.responsavel_id IS NOT NULL AND NOT (NEW.responsavel_id = ANY(v_old_set)) AND NEW.responsavel_id <> COALESCE(NEW.criado_por, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    PERFORM public.enqueue_notificacao(NEW.responsavel_id, v_tipo, v_titulo, NEW.titulo, '/demandas?id=' || NEW.id::text, jsonb_build_object('demanda_id', NEW.id));
  END IF;

  IF NEW.responsaveis_ids IS NOT NULL THEN
    FOREACH v_resp IN ARRAY NEW.responsaveis_ids LOOP
      IF NOT (v_resp = ANY(v_old_set)) AND v_resp <> COALESCE(NEW.criado_por, '00000000-0000-0000-0000-000000000000'::uuid) THEN
        PERFORM public.enqueue_notificacao(v_resp, v_tipo, v_titulo, NEW.titulo, '/demandas?id=' || NEW.id::text, jsonb_build_object('demanda_id', NEW.id));
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_demanda_atribuida ON public.demanda;
CREATE TRIGGER trg_notify_demanda_atribuida
  AFTER INSERT OR UPDATE OF responsavel_id, responsaveis_ids, prioridade ON public.demanda
  FOR EACH ROW EXECUTE FUNCTION public.notify_demanda_atribuida();

-- =========================================================================
-- Trigger: aviso crítico → notifica destinatários
-- =========================================================================
CREATE OR REPLACE FUNCTION public.notify_aviso_critico()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID;
  v_user_id UUID;
BEGIN
  IF NEW.tipo NOT IN ('critico', 'alerta') THEN RETURN NEW; END IF;
  IF NEW.ativo IS NOT TRUE THEN RETURN NEW; END IF;

  -- destinatários explícitos: colaboradores_ids → mapeia para user_id via profiles
  IF NEW.colaboradores_ids IS NOT NULL AND array_length(NEW.colaboradores_ids, 1) > 0 THEN
    FOR v_user IN SELECT user_id FROM public.profiles WHERE colaborador_id = ANY(NEW.colaboradores_ids) LOOP
      PERFORM public.enqueue_notificacao(
        v_user,
        CASE WHEN NEW.tipo = 'critico' THEN 'aviso_critico'::notificacao_tipo ELSE 'sistema'::notificacao_tipo END,
        '[' || upper(NEW.tipo::text) || '] ' || NEW.titulo,
        left(NEW.mensagem, 200), '/avisos',
        jsonb_build_object('aviso_id', NEW.id)
      );
    END LOOP;
  ELSE
    -- broadcast: todos os usuários autenticados
    FOR v_user_id IN SELECT user_id FROM public.profiles LOOP
      PERFORM public.enqueue_notificacao(
        v_user_id,
        CASE WHEN NEW.tipo = 'critico' THEN 'aviso_critico'::notificacao_tipo ELSE 'sistema'::notificacao_tipo END,
        '[' || upper(NEW.tipo::text) || '] ' || NEW.titulo,
        left(NEW.mensagem, 200), '/avisos',
        jsonb_build_object('aviso_id', NEW.id)
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_aviso_critico ON public.aviso_gestor;
CREATE TRIGGER trg_notify_aviso_critico
  AFTER INSERT ON public.aviso_gestor
  FOR EACH ROW EXECUTE FUNCTION public.notify_aviso_critico();

-- =========================================================================
-- Realtime
-- =========================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacao;
ALTER TABLE public.notificacao REPLICA IDENTITY FULL;