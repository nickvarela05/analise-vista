-- Migração base do NEXUS (fase E3 do plano de limpeza, autorizada pelo Nickolas em 27/10/2026).
-- Substitui as 101 migrações anteriores, guardadas em supabase/migrations_arquivo/.
-- Schema public: pg_dump --schema-only --schema=public --no-owner do banco de produção em 27/10/2026.
-- O que fica fora do public (extensões, Storage, Realtime, pg_cron, trigger em auth.users) está no fim.
-- Em produção ela já está marcada como aplicada; serve para montar um banco novo do zero.

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'gestor',
    'analista'
);

--
-- Name: aviso_tipo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.aviso_tipo AS ENUM (
    'informativo',
    'alerta',
    'critico'
);

--
-- Name: chamado_externo_prioridade; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.chamado_externo_prioridade AS ENUM (
    'baixa',
    'media',
    'alta',
    'critica'
);

--
-- Name: chamado_externo_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.chamado_externo_status AS ENUM (
    'aberto',
    'encaminhado',
    'finalizado'
);

--
-- Name: demanda_categoria; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.demanda_categoria AS ENUM (
    'bug',
    'melhoria',
    'nova_funcionalidade',
    'duvida',
    'documentacao',
    'outro'
);

--
-- Name: demanda_origem; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.demanda_origem AS ENUM (
    'email',
    'reuniao',
    'chamado',
    'whatsapp',
    'outro'
);

--
-- Name: demanda_prioridade; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.demanda_prioridade AS ENUM (
    'baixa',
    'media',
    'alta',
    'critica'
);

--
-- Name: demanda_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.demanda_status AS ENUM (
    'aberta',
    'em_analise',
    'em_andamento',
    'aguardando_cliente',
    'homologacao',
    'concluida',
    'cancelada'
);

--
-- Name: evento_tipo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.evento_tipo AS ENUM (
    'folga',
    'falta',
    'atestado',
    'atraso',
    'ferias_avulso'
);

--
-- Name: local_trabalho; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.local_trabalho AS ENUM (
    'escritorio',
    'rua'
);

--
-- Name: notificacao_canal; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notificacao_canal AS ENUM (
    'in_app',
    'email'
);

--
-- Name: notificacao_tipo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notificacao_tipo AS ENUM (
    'tarefa_atribuida',
    'tarefa_prazo',
    'tarefa_comentario',
    'tarefa_status',
    'demanda_atribuida',
    'demanda_urgente',
    'chamado_sla',
    'aviso_critico',
    'sistema',
    'resumo_semanal',
    'relatorio_novo'
);

--
-- Name: processo_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.processo_status AS ENUM (
    'planejado',
    'em_andamento',
    'concluido',
    'atrasado'
);

--
-- Name: reuniao_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.reuniao_status AS ENUM (
    'agendada',
    'realizada',
    'cancelada'
);

--
-- Name: reuniao_tipo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.reuniao_tipo AS ENUM (
    'interna',
    'cliente',
    'fornecedor',
    'alinhamento',
    'outro'
);

--
-- Name: reuniao_transcricao_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.reuniao_transcricao_status AS ENUM (
    'pendente',
    'processando',
    'concluido',
    'erro',
    'pausado'
);

--
-- Name: todo_prioridade; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.todo_prioridade AS ENUM (
    'baixa',
    'media',
    'alta'
);

--
-- Name: todo_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.todo_status AS ENUM (
    'pendente',
    'em_andamento',
    'concluida',
    'cancelada',
    'aberta',
    'encaminhada',
    'homologacao',
    'producao',
    'reprovada',
    'aprovado',
    'aprovado_ressalvas',
    'encerrada',
    'pre_build',
    'reprovado'
);

--
-- Name: confirmar_liberacao(uuid[], text, boolean, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirmar_liberacao(p_ids uuid[], p_etapa text, p_marcar boolean DEFAULT true, p_objetos text DEFAULT NULL::text, p_dispensada boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

--
-- Name: enqueue_email_imediato(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enqueue_email_imediato() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_email TEXT;
  v_pref_ativo BOOLEAN;
  v_subject TEXT;
BEGIN
  -- só agenda envio imediato para tipos críticos
  IF NEW.tipo NOT IN ('demanda_urgente', 'chamado_sla', 'aviso_critico') THEN
    RETURN NEW;
  END IF;

  -- respeita preferência de e-mail (default = ativo)
  SELECT ativo INTO v_pref_ativo
    FROM public.notificacao_preferencia
   WHERE user_id = NEW.user_id AND evento = NEW.tipo AND canal = 'email';
  IF v_pref_ativo IS FALSE THEN RETURN NEW; END IF;

  SELECT email INTO v_email FROM public.profiles WHERE user_id = NEW.user_id;
  IF v_email IS NULL OR v_email = '' THEN RETURN NEW; END IF;

  v_subject := '[URGENTE] ' || NEW.titulo;

  INSERT INTO public.email_send_log (user_id, recipient_email, subject, body_text, notificacao_ids, status, scheduled_for)
  VALUES (
    NEW.user_id, v_email, v_subject, COALESCE(NEW.mensagem, ''), ARRAY[NEW.id],
    'pending', now()
  );

  RETURN NEW;
END;
$$;

--
-- Name: enqueue_notificacao(uuid, public.notificacao_tipo, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enqueue_notificacao(_user_id uuid, _tipo public.notificacao_tipo, _titulo text, _mensagem text DEFAULT NULL::text, _link text DEFAULT NULL::text, _metadata jsonb DEFAULT NULL::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_id UUID;
  v_ativo BOOLEAN;
  v_destino UUID;
BEGIN
  IF _user_id IS NULL THEN RETURN NULL; END IF;

  -- resolve o destinatário para o ID de login
  SELECT p.user_id INTO v_destino FROM public.profiles p WHERE p.user_id = _user_id;
  IF v_destino IS NULL THEN
    SELECT p.user_id INTO v_destino FROM public.profiles p WHERE p.colaborador_id = _user_id LIMIT 1;
  END IF;
  IF v_destino IS NULL THEN RETURN NULL; END IF;

  -- respeita preferência in-app (default = ativo)
  SELECT ativo INTO v_ativo
    FROM public.notificacao_preferencia
   WHERE user_id = v_destino AND evento = _tipo AND canal = 'in_app';

  IF v_ativo IS FALSE THEN RETURN NULL; END IF;

  INSERT INTO public.notificacao (user_id, tipo, titulo, mensagem, link, metadata)
  VALUES (v_destino, _tipo, _titulo, _mensagem, _link, _metadata)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

--
-- Name: gerar_avisos_processos_proximos(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gerar_avisos_processos_proximos() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  r RECORD;
  v_dias INT;
  v_duracao INT;
  v_tipo aviso_tipo;
  v_titulo TEXT;
  v_msg TEXT;
  v_dest UUID[];
  v_resp TEXT;
  v_inicio_fmt TEXT;
  v_fim_fmt TEXT;
  v_count INT := 0;
  v_cor TEXT;
  v_cor_suave TEXT;
  v_rotulo TEXT;
  v_contagem TEXT;
  v_acao TEXT;
  v_assunto TEXT;
  v_html TEXT;
  v_linhas TEXT;
  v_app TEXT := 'https://nexus.nickvarela127.workers.dev/processos';
BEGIN
  UPDATE public.aviso_gestor a
     SET ativo = false, updated_at = now()
   WHERE a.processo_id IS NOT NULL
     AND a.ativo = true
     AND NOT EXISTS (
       SELECT 1 FROM public.processo_anual p
        WHERE p.id = a.processo_id
          AND p.status IN ('planejado','em_andamento','atrasado')
          AND p.previsto_inicio IS NOT NULL
          AND p.previsto_inicio >= CURRENT_DATE
          AND p.previsto_inicio <= (CURRENT_DATE + (COALESCE(p.alerta_dias_antes, 14) || ' days')::interval)::date
     );

  FOR r IN
    SELECT p.id, p.nome, p.descricao, p.previsto_inicio, p.previsto_fim,
           p.responsaveis_ids, p.equipe_toda
      FROM public.processo_anual p
     WHERE p.status IN ('planejado','em_andamento','atrasado')
       AND p.previsto_inicio IS NOT NULL
       AND p.previsto_inicio >= CURRENT_DATE
       AND p.previsto_inicio <= (CURRENT_DATE + (COALESCE(p.alerta_dias_antes, 14) || ' days')::interval)::date
  LOOP
    v_dias := (r.previsto_inicio - CURRENT_DATE);

    IF v_dias <= 3 THEN
      v_tipo := 'critico'::aviso_tipo;  v_cor := '#dc2626'; v_cor_suave := '#fef2f2'; v_rotulo := 'Crítico';
    ELSIF v_dias <= 7 THEN
      v_tipo := 'alerta'::aviso_tipo;   v_cor := '#d97706'; v_cor_suave := '#fffbeb'; v_rotulo := 'Atenção';
    ELSE
      v_tipo := 'informativo'::aviso_tipo; v_cor := '#2563eb'; v_cor_suave := '#eff6ff'; v_rotulo := 'Informativo';
    END IF;

    v_contagem := CASE
      WHEN v_dias = 0 THEN 'Começa hoje'
      WHEN v_dias = 1 THEN 'Começa amanhã'
      ELSE 'Faltam ' || v_dias || ' dias'
    END;

    v_titulo := CASE
      WHEN v_dias = 0 THEN 'Processo começa hoje: ' || r.nome
      WHEN v_dias = 1 THEN 'Processo começa amanhã: ' || r.nome
      ELSE 'Processo em ' || v_dias || ' dias: ' || r.nome
    END;

    v_inicio_fmt := to_char(r.previsto_inicio, 'DD/MM/YYYY') || ' (' ||
      CASE extract(isodow FROM r.previsto_inicio)
        WHEN 1 THEN 'segunda-feira' WHEN 2 THEN 'terça-feira'
        WHEN 3 THEN 'quarta-feira'  WHEN 4 THEN 'quinta-feira'
        WHEN 5 THEN 'sexta-feira'   WHEN 6 THEN 'sábado'
        ELSE 'domingo'
      END || ')';

    v_fim_fmt := NULL;
    v_duracao := NULL;
    IF r.previsto_fim IS NOT NULL THEN
      v_fim_fmt := to_char(r.previsto_fim, 'DD/MM/YYYY');
      v_duracao := GREATEST((r.previsto_fim - r.previsto_inicio) + 1, 1);
    END IF;

    v_resp := NULL;
    IF NOT r.equipe_toda AND r.responsaveis_ids IS NOT NULL AND array_length(r.responsaveis_ids, 1) > 0 THEN
      SELECT string_agg(c.nome, ', ' ORDER BY c.nome)
        INTO v_resp
        FROM public.colaborador c
       WHERE c.id = ANY (r.responsaveis_ids);
    END IF;

    v_acao := CASE
      WHEN v_dias = 0 THEN 'O processo começa hoje. Iniciem as atividades e registrem o andamento na tela de Processos.'
      WHEN v_dias = 1 THEN 'O processo começa amanhã. Deixem materiais, acessos e pendências prontos hoje.'
      WHEN v_dias <= 3 THEN 'Faltam apenas ' || v_dias || ' dias. Priorizem o preparo: revisem pendências e alinhem as entregas com os responsáveis.'
      WHEN v_dias <= 7 THEN 'Falta 1 semana ou menos. Confirmem o planejamento e antecipem possíveis impedimentos.'
      ELSE 'Faltam ' || v_dias || ' dias. Aproveitem para planejar com calma e alinhar expectativas com a equipe.'
    END;

    v_msg := 'O processo "' || r.nome || '" tem início previsto para ' || v_inicio_fmt || '.'
      || CASE
           WHEN v_fim_fmt IS NOT NULL THEN
             E'\nTérmino previsto: ' || v_fim_fmt || ' — duração estimada de ' || v_duracao ||
             CASE WHEN v_duracao = 1 THEN ' dia.' ELSE ' dias.' END
           ELSE ''
         END
      || COALESCE(E'\n\nSobre o processo: ' || NULLIF(btrim(r.descricao), ''), '')
      || E'\n\n' || CASE
           WHEN r.equipe_toda THEN 'Este processo envolve toda a equipe.'
           WHEN v_resp IS NOT NULL THEN 'Responsáveis: ' || v_resp || '.'
           ELSE 'Nenhum responsável definido no cadastro do processo.'
         END
      || E'\n\n' || v_acao;

    v_assunto := CASE
      WHEN v_dias = 0 THEN 'Hoje: ' || r.nome
      WHEN v_dias = 1 THEN 'Amanhã: ' || r.nome
      ELSE 'Em ' || v_dias || ' dias: ' || r.nome
    END;

    v_linhas :=
      '<tr><td style="padding:10px 0;border-bottom:1px solid #eef1f5;color:#64748b;font-size:13px;width:150px">Início previsto</td>'
      || '<td style="padding:10px 0;border-bottom:1px solid #eef1f5;color:#0f172a;font-size:14px;font-weight:600">'
      || public.html_escape(v_inicio_fmt) || '</td></tr>'
      || CASE WHEN v_fim_fmt IS NOT NULL THEN
           '<tr><td style="padding:10px 0;border-bottom:1px solid #eef1f5;color:#64748b;font-size:13px">Término previsto</td>'
           || '<td style="padding:10px 0;border-bottom:1px solid #eef1f5;color:#0f172a;font-size:14px;font-weight:600">'
           || public.html_escape(v_fim_fmt) || ' · ' || v_duracao
           || CASE WHEN v_duracao = 1 THEN ' dia' ELSE ' dias' END || '</td></tr>'
         ELSE '' END
      || '<tr><td style="padding:10px 0;border-bottom:1px solid #eef1f5;color:#64748b;font-size:13px">Responsáveis</td>'
      || '<td style="padding:10px 0;border-bottom:1px solid #eef1f5;color:#0f172a;font-size:14px;font-weight:600">'
      || CASE
           WHEN r.equipe_toda THEN 'Toda a equipe'
           WHEN v_resp IS NOT NULL THEN public.html_escape(v_resp)
           ELSE '<span style="color:#94a3b8;font-weight:500">Não definido</span>'
         END
      || '</td></tr>';

    v_html :=
      '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">'
      || '<meta name="viewport" content="width=device-width,initial-scale=1">'
      || '<title>' || public.html_escape(v_titulo) || '</title></head>'
      || '<body style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif">'
      || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><td align="center">'
      || '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0">'
      || '<tr><td style="height:6px;background:' || v_cor || '"></td></tr>'
      || '<tr><td style="padding:24px 28px 8px">'
      || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
      || '<td style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:' || v_cor || '">Nexus · Processo anual</td>'
      || '<td align="right"><span style="display:inline-block;background:' || v_cor_suave || ';color:' || v_cor
      || ';font-size:11px;font-weight:700;padding:5px 12px;border-radius:999px">' || v_rotulo || '</span></td>'
      || '</tr></table></td></tr>'
      || '<tr><td style="padding:4px 28px 0">'
      || '<h1 style="margin:8px 0 6px;font-size:21px;line-height:1.3;color:#0f172a">' || public.html_escape(r.nome) || '</h1>'
      || '<p style="margin:0 0 18px;font-size:14px;color:' || v_cor || ';font-weight:700">' || v_contagem || '</p>'
      || '</td></tr>'
      || '<tr><td style="padding:0 28px">'
      || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-top:1px solid #eef1f5">'
      || v_linhas || '</table></td></tr>'
      || CASE WHEN NULLIF(btrim(r.descricao), '') IS NOT NULL THEN
           '<tr><td style="padding:18px 28px 0"><div style="background:#f8fafc;border:1px solid #eef1f5;border-radius:10px;padding:14px 16px">'
           || '<div style="font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#94a3b8;margin-bottom:6px">Sobre o processo</div>'
           || '<div style="font-size:14px;line-height:1.6;color:#334155">'
           || replace(public.html_escape(btrim(r.descricao)), E'\n', '<br>') || '</div></div></td></tr>'
         ELSE '' END
      || '<tr><td style="padding:18px 28px 0"><div style="background:' || v_cor_suave || ';border-left:4px solid ' || v_cor
      || ';border-radius:8px;padding:14px 16px;font-size:14px;line-height:1.6;color:#334155">'
      || public.html_escape(v_acao) || '</div></td></tr>'
      || '<tr><td align="center" style="padding:24px 28px 4px">'
      || '<a href="' || v_app || '" style="display:inline-block;background:' || v_cor
      || ';color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 26px;border-radius:8px">Abrir calendário anual</a>'
      || '</td></tr>'
      || '<tr><td style="padding:22px 28px 26px"><hr style="border:none;border-top:1px solid #eef1f5;margin:0 0 14px">'
      || '<p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8">Aviso automático do Nexus, gerado a partir do calendário de processos anuais. '
      || 'Acompanhe e atualize o andamento diretamente no sistema.</p></td></tr>'
      || '</table></td></tr></table></body></html>';

    IF r.equipe_toda THEN
      v_dest := ARRAY[]::UUID[];
    ELSE
      v_dest := COALESCE(r.responsaveis_ids, ARRAY[]::UUID[]);
    END IF;

    INSERT INTO public.aviso_gestor (titulo, mensagem, tipo, ativo, expira_em, processo_id, colaboradores_ids,
                                     email_assunto, email_html, email_texto)
    VALUES (v_titulo, v_msg, v_tipo, true,
            (r.previsto_inicio + 1)::timestamptz, r.id, v_dest,
            v_assunto, v_html, v_msg)
    ON CONFLICT (processo_id) WHERE processo_id IS NOT NULL
    DO UPDATE SET titulo = EXCLUDED.titulo,
                  mensagem = EXCLUDED.mensagem,
                  tipo = EXCLUDED.tipo,
                  ativo = true,
                  expira_em = EXCLUDED.expira_em,
                  colaboradores_ids = EXCLUDED.colaboradores_ids,
                  email_assunto = EXCLUDED.email_assunto,
                  email_html = EXCLUDED.email_html,
                  email_texto = EXCLUDED.email_texto,
                  updated_at = now();
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

--
-- Name: gerar_notificacoes_prazo(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gerar_notificacoes_prazo() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  r RECORD;
  v_user UUID;
  v_users UUID[];
BEGIN
  FOR r IN
    SELECT id, titulo, data_prevista, responsavel_id, responsaveis_ids
      FROM public.todo
     WHERE status NOT IN ('concluida', 'cancelada')
       AND data_prevista IS NOT NULL
       AND data_prevista::timestamptz BETWEEN now() AND now() + INTERVAL '24 hours'
  LOOP
    v_users := COALESCE(r.responsaveis_ids, ARRAY[]::UUID[]);
    IF r.responsavel_id IS NOT NULL THEN v_users := v_users || r.responsavel_id; END IF;

    FOREACH v_user IN ARRAY (SELECT array_agg(DISTINCT u) FROM unnest(v_users) u WHERE u IS NOT NULL) LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.notificacao
         WHERE user_id = v_user AND tipo = 'tarefa_prazo'
           AND created_at > now() - INTERVAL '23 hours'
           AND metadata->>'tarefa_id' = r.id::text
      ) THEN
        PERFORM public.enqueue_notificacao(
          v_user, 'tarefa_prazo'::notificacao_tipo,
          'Prazo se aproximando',
          r.titulo || ' — vence em ' || to_char(r.data_prevista, 'DD/MM'),
          '/tarefas?id=' || r.id::text,
          jsonb_build_object('tarefa_id', r.id)
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

--
-- Name: get_tarefa_counts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_tarefa_counts() RETURNS TABLE(todo_id uuid, comentarios bigint, checklist_total bigint, checklist_done bigint, anexos bigint)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select x.todo_id, sum(x.c)::bigint, sum(x.kt)::bigint, sum(x.kd)::bigint, sum(x.a)::bigint
  from (
    select todo_id, 1 as c, 0 as kt, 0 as kd, 0 as a from public.todo_comentario
    union all
    select todo_id, 0, 1, (concluido)::int, 0 from public.todo_checklist
    union all
    select todo_id, 0, 0, 0, 1 from public.todo_anexo
  ) x
  group by x.todo_id;
$$;

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  is_first BOOLEAN;
  v_invite RECORD;
  v_role app_role;
  v_admin_created BOOLEAN;
  v_token TEXT;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first;

  IF is_first THEN
    v_role := 'gestor'::app_role;
  ELSE
    v_admin_created := COALESCE((NEW.raw_app_meta_data ->> 'created_by_admin')::boolean, false);

    IF v_admin_created THEN
      BEGIN
        v_role := COALESCE(
          (NEW.raw_app_meta_data ->> 'role')::app_role,
          'analista'::app_role
        );
      EXCEPTION WHEN OTHERS THEN
        v_role := 'analista'::app_role;
      END;
    ELSE
      v_token := NULLIF(trim(NEW.raw_user_meta_data ->> 'invite_token'), '');
      IF v_token IS NULL THEN
        RAISE EXCEPTION 'Cadastro requer convite válido. Solicite ao gestor.'
          USING ERRCODE = 'P0001';
      END IF;

      SELECT * INTO v_invite
        FROM public.invite_token
       WHERE token = v_token
         AND lower(email) = lower(NEW.email)
         AND used_at IS NULL
         AND expires_at > now()
       ORDER BY created_at DESC
       LIMIT 1;

      IF v_invite.id IS NULL THEN
        RAISE EXCEPTION 'Cadastro requer convite válido. Solicite ao gestor.'
          USING ERRCODE = 'P0001';
      END IF;

      v_role := v_invite.role;
      UPDATE public.invite_token SET used_at = now() WHERE id = v_invite.id;
    END IF;
  END IF;

  INSERT INTO public.profiles (user_id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);
  RETURN NEW;
END;
$$;

--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

--
-- Name: html_escape(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.html_escape(_t text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT replace(replace(replace(replace(COALESCE(_t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;')
$$;

--
-- Name: is_equipe(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_equipe(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from public.user_roles where user_id = _user_id);
$$;

--
-- Name: log_audit_event(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_audit_event() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_changed text[];
  v_record_id uuid;
  v_fora text[] := CASE WHEN TG_NARGS > 0 THEN string_to_array(TG_ARGV[0], ',') ELSE ARRAY[]::text[] END;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD) - v_fora;
    v_new := NULL;
    v_record_id := OLD.id;
  ELSIF TG_OP = 'INSERT' THEN
    v_old := NULL;
    v_new := to_jsonb(NEW) - v_fora;
    v_record_id := NEW.id;
  ELSE
    v_old := to_jsonb(OLD) - v_fora;
    v_new := to_jsonb(NEW) - v_fora;
    v_record_id := NEW.id;
    SELECT array_agg(key)
      INTO v_changed
      FROM jsonb_each(v_new)
     WHERE v_new -> key IS DISTINCT FROM v_old -> key
       AND key NOT IN ('updated_at');
    IF v_changed IS NULL OR array_length(v_changed,1) = 0 THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.audit_log (table_name, record_id, operation, changed_by, old_data, new_data, changed_fields)
  VALUES (TG_TABLE_NAME, v_record_id, TG_OP, auth.uid(), v_old, v_new, v_changed);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

--
-- Name: marcar_transcricoes_travadas(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.marcar_transcricoes_travadas() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.reuniao
     SET transcricao_status = 'pausado',
         transcricao_erro = COALESCE(
           'Processamento interrompido — retomando automaticamente'
           || CASE WHEN transcricao_partes_total > 0
                   THEN ' (parte ' || transcricao_partes_feitas || ' de ' || transcricao_partes_total || ')'
                   ELSE '' END, 'Retomando automaticamente')
   WHERE transcricao_status = 'processando'
     AND updated_at < now() - INTERVAL '15 minutes';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

--
-- Name: nomes_responsaveis(uuid[], uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.nomes_responsaveis(_ids uuid[], _unico uuid, _equipe boolean) RETURNS text
    LANGUAGE sql STABLE
    SET search_path TO 'public'
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

--
-- Name: notificar_atribuicao(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notificar_atribuicao(p_destino uuid, p_tarefa_id uuid, p_titulo text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user uuid;
  v_ativo boolean;
  v_id uuid;
  v_ids jsonb;
  v_n int;
BEGIN
  IF p_destino IS NULL THEN RETURN; END IF;

  SELECT p.user_id INTO v_user FROM public.profiles p WHERE p.user_id = p_destino;
  IF v_user IS NULL THEN
    SELECT p.user_id INTO v_user FROM public.profiles p WHERE p.colaborador_id = p_destino LIMIT 1;
  END IF;
  IF v_user IS NULL OR v_user = auth.uid() THEN RETURN; END IF;

  SELECT ativo INTO v_ativo FROM public.notificacao_preferencia
   WHERE user_id = v_user AND evento = 'tarefa_atribuida' AND canal = 'in_app';
  IF v_ativo IS FALSE THEN RETURN; END IF;

  SELECT id, COALESCE(metadata->'tarefa_ids', '[]'::jsonb) INTO v_id, v_ids
    FROM public.notificacao
   WHERE user_id = v_user
     AND tipo = 'tarefa_atribuida'
     AND lida_em IS NULL
     AND created_at > now() - interval '15 minutes'
     AND metadata ? 'tarefa_ids'
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF v_id IS NULL THEN
    INSERT INTO public.notificacao (user_id, tipo, titulo, mensagem, link, metadata)
    VALUES (v_user, 'tarefa_atribuida', 'Nova tarefa atribuída', p_titulo, '/tarefas?id=' || p_tarefa_id,
            jsonb_build_object('tarefa_id', p_tarefa_id, 'tarefa_ids', jsonb_build_array(p_tarefa_id)));
    RETURN;
  END IF;

  IF v_ids ? p_tarefa_id::text THEN RETURN; END IF;
  v_ids := v_ids || to_jsonb(p_tarefa_id::text);
  v_n := jsonb_array_length(v_ids);
  UPDATE public.notificacao SET
    titulo = v_n || ' tarefas atribuídas a você',
    mensagem = 'A última: ' || p_titulo || '. Veja em "Meu dia", na Central.',
    link = '/',
    metadata = metadata || jsonb_build_object('tarefa_ids', v_ids)
  WHERE id = v_id;
END;
$$;

--
-- Name: notify_aviso_critico(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_aviso_critico() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

--
-- Name: notify_demanda_atribuida(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_demanda_atribuida() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

  v_tipo := CASE WHEN NEW.prioridade = 'critica' THEN 'demanda_urgente'::notificacao_tipo ELSE 'demanda_atribuida'::notificacao_tipo END;
  v_titulo := CASE WHEN NEW.prioridade = 'critica' THEN 'Demanda URGENTE atribuída' ELSE 'Nova demanda atribuída' END;

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

--
-- Name: notify_processo_proximo(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_processo_proximo() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  r RECORD;
  v_user UUID;
  v_users UUID[];
  v_dias INT;
  v_tipo notificacao_tipo;
  v_titulo TEXT;
BEGIN
  FOR r IN
    SELECT p.id, p.nome, p.previsto_inicio, p.previsto_fim, p.alerta_dias_antes,
           p.responsaveis_ids, p.equipe_toda, p.status
      FROM public.processo_anual p
     WHERE p.status IN ('planejado','em_andamento','atrasado')
       AND p.previsto_inicio IS NOT NULL
       AND p.previsto_inicio >= CURRENT_DATE
       AND p.previsto_inicio <= (CURRENT_DATE + (COALESCE(p.alerta_dias_antes, 14) || ' days')::interval)::date
  LOOP
    v_dias := (r.previsto_inicio - CURRENT_DATE);

    IF r.equipe_toda = true THEN
      SELECT COALESCE(array_agg(user_id), ARRAY[]::UUID[])
        INTO v_users
        FROM public.profiles
       WHERE email IS NOT NULL AND email <> '';
    ELSE
      -- responsaveis_ids contém colaborador_id; resolver para user_id via profiles
      SELECT COALESCE(array_agg(pr.user_id), ARRAY[]::UUID[])
        INTO v_users
        FROM public.profiles pr
       WHERE pr.colaborador_id = ANY(COALESCE(r.responsaveis_ids, ARRAY[]::UUID[]));
    END IF;

    IF v_users IS NULL OR array_length(v_users, 1) IS NULL THEN
      CONTINUE;
    END IF;

    -- Prioridade: crítico se ≤3 dias, senão informativo
    IF v_dias <= 3 THEN
      v_tipo := 'aviso_critico'::notificacao_tipo;
      v_titulo := 'Processo se aproxima (' || v_dias || 'd)';
    ELSE
      v_tipo := 'sistema'::notificacao_tipo;
      v_titulo := 'Processo previsto em ' || v_dias || ' dias';
    END IF;

    FOREACH v_user IN ARRAY v_users LOOP
      -- Evita duplicar nas últimas 23h
      IF NOT EXISTS (
        SELECT 1 FROM public.notificacao
         WHERE user_id = v_user
           AND created_at > now() - INTERVAL '23 hours'
           AND metadata->>'processo_id' = r.id::text
      ) THEN
        PERFORM public.enqueue_notificacao(
          v_user,
          v_tipo,
          v_titulo,
          r.nome || ' — início previsto ' || to_char(r.previsto_inicio, 'DD/MM/YYYY'),
          '/processos',
          jsonb_build_object('processo_id', r.id, 'dias', v_dias)
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

--
-- Name: notify_tarefa_atribuida(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_tarefa_atribuida() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_resp uuid;
  v_old_set uuid[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_old_set := ARRAY[]::uuid[];
  ELSE
    v_old_set := COALESCE(OLD.responsaveis_ids, ARRAY[]::uuid[]) ||
                 CASE WHEN OLD.responsavel_id IS NOT NULL THEN ARRAY[OLD.responsavel_id] ELSE ARRAY[]::uuid[] END;
  END IF;

  IF NEW.responsavel_id IS NOT NULL AND NOT (NEW.responsavel_id = ANY (v_old_set)) THEN
    PERFORM public.notificar_atribuicao(NEW.responsavel_id, NEW.id, NEW.titulo);
  END IF;

  IF NEW.responsaveis_ids IS NOT NULL THEN
    FOREACH v_resp IN ARRAY NEW.responsaveis_ids LOOP
      IF NOT (v_resp = ANY (v_old_set)) AND v_resp IS DISTINCT FROM NEW.responsavel_id THEN
        PERFORM public.notificar_atribuicao(v_resp, NEW.id, NEW.titulo);
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

--
-- Name: notify_tarefa_comentario(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_tarefa_comentario() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_tarefa RECORD;
  v_destinatarios UUID[];
  v_unicos UUID[];
  v_user UUID;
BEGIN
  SELECT id, titulo, criado_por, responsavel_id, responsaveis_ids
    INTO v_tarefa FROM public.todo WHERE id = NEW.todo_id;
  IF v_tarefa.id IS NULL THEN RETURN NEW; END IF;

  v_destinatarios := COALESCE(v_tarefa.responsaveis_ids, ARRAY[]::UUID[]);
  IF v_tarefa.criado_por IS NOT NULL THEN v_destinatarios := v_destinatarios || v_tarefa.criado_por; END IF;
  IF v_tarefa.responsavel_id IS NOT NULL THEN v_destinatarios := v_destinatarios || v_tarefa.responsavel_id; END IF;

  SELECT COALESCE(array_agg(DISTINCT u), ARRAY[]::UUID[])
    INTO v_unicos
    FROM unnest(v_destinatarios) u
    WHERE u IS NOT NULL AND u <> NEW.autor_id;

  IF array_length(v_unicos, 1) IS NULL THEN RETURN NEW; END IF;

  FOREACH v_user IN ARRAY v_unicos LOOP
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

--
-- Name: receber_pacote_homologacao(text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.receber_pacote_homologacao(p_nome text, p_descricao text, p_itens jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
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

--
-- Name: registrar_visita_central(boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_visita_central(p_marcar_visto boolean DEFAULT false) RETURNS timestamp with time zone
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_atual timestamptz;
  v_anterior timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT central_visita_atual, central_visita_anterior INTO v_atual, v_anterior
    FROM public.profiles WHERE user_id = v_uid;

  IF p_marcar_visto OR v_atual IS NULL THEN
    UPDATE public.profiles SET central_visita_anterior = now(), central_visita_atual = now()
     WHERE user_id = v_uid;
    RETURN CASE WHEN p_marcar_visto THEN now() END;
  END IF;

  IF now() - v_atual > interval '30 minutes' THEN
    v_anterior := v_atual;
  END IF;
  UPDATE public.profiles SET central_visita_anterior = v_anterior, central_visita_atual = now()
   WHERE user_id = v_uid;
  RETURN v_anterior;
END;
$$;

--
-- Name: todo_historico_descartar_status_repetido(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.todo_historico_descartar_status_repetido() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
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

--
-- Name: todo_numero_do_titulo(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.todo_numero_do_titulo(p_titulo text) RETURNS bigint
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT NULLIF(left(COALESCE(
    (regexp_match(p_titulo, '(?:tarefa|task)\s*[:#-]?\s*(\d{2,})', 'i'))[1],
    (regexp_match(p_titulo, '#\s*(\d{2,})'))[1],
    (regexp_match(p_titulo, '^\s*(\d{2,})\M'))[1]
  ), 15), '')::bigint;
$$;

--
-- Name: todo_registrar_responsaveis(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.todo_registrar_responsaveis() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

--
-- Name: todo_registrar_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.todo_registrar_status() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

--
-- Name: todo_regra_liberacao(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.todo_regra_liberacao() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
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

--
-- Name: todo_set_numero_eproject(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.todo_set_numero_eproject() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.numero_eproject := public.todo_numero_do_titulo(NEW.titulo);
  RETURN NEW;
END;
$$;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_name text NOT NULL,
    record_id uuid NOT NULL,
    operation text NOT NULL,
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_fields text[],
    CONSTRAINT audit_log_operation_check CHECK ((operation = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);

--
-- Name: aviso_gestor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aviso_gestor (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo text NOT NULL,
    mensagem text NOT NULL,
    tipo public.aviso_tipo DEFAULT 'informativo'::public.aviso_tipo NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    expira_em timestamp with time zone,
    criado_por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    colaborador_id uuid,
    colaboradores_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    processo_id uuid,
    email_assunto text,
    email_html text,
    email_texto text
);

--
-- Name: aviso_leitura; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aviso_leitura (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aviso_id uuid NOT NULL,
    user_id uuid NOT NULL,
    lido_em timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: colaborador; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.colaborador (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    cargo text,
    bio text,
    foto_url text,
    ordem integer DEFAULT 0 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    local_trabalho public.local_trabalho DEFAULT 'escritorio'::public.local_trabalho NOT NULL
);

--
-- Name: colaborador_evento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.colaborador_evento (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    colaborador_id uuid NOT NULL,
    tipo public.evento_tipo NOT NULL,
    data date NOT NULL,
    hora_inicio time without time zone,
    hora_fim time without time zone,
    observacao text,
    anexo_url text,
    registrado_por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: colaborador_ferias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.colaborador_ferias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    colaborador_id uuid NOT NULL,
    data_inicio date NOT NULL,
    data_fim date NOT NULL,
    observacao text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT colaborador_ferias_check CHECK ((data_fim >= data_inicio))
);

--
-- Name: colaborador_galeria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.colaborador_galeria (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    colaborador_id uuid,
    foto_url text NOT NULL,
    legenda text,
    ordem integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: colaborador_horario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.colaborador_horario (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    colaborador_id uuid NOT NULL,
    dia_semana smallint NOT NULL,
    expediente_inicio time without time zone,
    expediente_fim time without time zone,
    almoco_inicio time without time zone,
    almoco_fim time without time zone,
    local_almoco text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT colaborador_horario_dia_semana_check CHECK (((dia_semana >= 0) AND (dia_semana <= 6)))
);

--
-- Name: demanda; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.demanda (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo text NOT NULL,
    descricao text,
    origem public.demanda_origem DEFAULT 'outro'::public.demanda_origem NOT NULL,
    categoria public.demanda_categoria DEFAULT 'outro'::public.demanda_categoria NOT NULL,
    status public.demanda_status DEFAULT 'aberta'::public.demanda_status NOT NULL,
    prioridade public.demanda_prioridade DEFAULT 'media'::public.demanda_prioridade NOT NULL,
    solicitante text,
    responsavel_id uuid,
    prazo date,
    tags text[],
    criado_por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    responsaveis_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    equipe_toda boolean DEFAULT false NOT NULL
);

--
-- Name: email_digest_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_digest_config (
    id boolean DEFAULT true NOT NULL,
    dias_semana smallint[] DEFAULT ARRAY[(1)::smallint, (2)::smallint, (3)::smallint, (4)::smallint, (5)::smallint] NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT email_digest_config_id_check CHECK ((id = true))
);

--
-- Name: email_send_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_send_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    recipient_email text NOT NULL,
    subject text NOT NULL,
    body_html text,
    body_text text,
    notificacao_ids uuid[],
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    webhook_response jsonb,
    scheduled_for timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: google_calendar_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.google_calendar_config (
    id boolean DEFAULT true NOT NULL,
    google_calendar_id text,
    sync_ativo boolean DEFAULT false NOT NULL,
    dias_horizonte integer DEFAULT 30 NOT NULL,
    ultima_sync_em timestamp with time zone,
    ultimo_erro text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT google_calendar_config_dias_horizonte_check CHECK (((dias_horizonte >= 1) AND (dias_horizonte <= 180))),
    CONSTRAINT google_calendar_config_id_check CHECK ((id = true))
);

--
-- Name: google_calendar_evento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.google_calendar_evento (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fonte text NOT NULL,
    fonte_id uuid NOT NULL,
    google_event_id text NOT NULL,
    google_calendar_id text NOT NULL,
    conteudo_hash text NOT NULL,
    ultima_sync_em timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT google_calendar_evento_fonte_check CHECK ((fonte = ANY (ARRAY['reuniao'::text, 'tarefa'::text, 'demanda'::text, 'chamado'::text])))
);

--
-- Name: google_oauth_conta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.google_oauth_conta (
    id boolean DEFAULT true NOT NULL,
    refresh_token text NOT NULL,
    email text,
    conectado_por uuid,
    conectado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT google_oauth_conta_id_check CHECK (id)
);

--
-- Name: ia_prompt_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ia_prompt_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chave text NOT NULL,
    prompt_sistema text NOT NULL,
    instrucoes_extras text,
    ativo boolean DEFAULT true NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: invite_token; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invite_token (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token text NOT NULL,
    email text NOT NULL,
    role public.app_role DEFAULT 'analista'::public.app_role NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    used_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: notificacao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notificacao (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    tipo public.notificacao_tipo NOT NULL,
    titulo text NOT NULL,
    mensagem text,
    link text,
    metadata jsonb,
    lida_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.notificacao REPLICA IDENTITY FULL;

--
-- Name: notificacao_preferencia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notificacao_preferencia (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    evento public.notificacao_tipo NOT NULL,
    canal public.notificacao_canal NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: processo_anual; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.processo_anual (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ano integer NOT NULL,
    nome text NOT NULL,
    descricao text,
    cor text DEFAULT 'indigo'::text NOT NULL,
    previsto_inicio date,
    previsto_fim date,
    real_inicio date,
    real_fim date,
    responsaveis_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    equipe_toda boolean DEFAULT false NOT NULL,
    status public.processo_status DEFAULT 'planejado'::public.processo_status NOT NULL,
    alerta_dias_antes integer DEFAULT 14 NOT NULL,
    observacoes text,
    criado_por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: processo_anual_vinculo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.processo_anual_vinculo (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    processo_id uuid NOT NULL,
    tipo text NOT NULL,
    ref_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT processo_anual_vinculo_tipo_check CHECK ((tipo = ANY (ARRAY['tarefa'::text, 'demanda'::text])))
);

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    nome text NOT NULL,
    email text NOT NULL,
    avatar_url text,
    cargo text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    colaborador_id uuid,
    must_change_password boolean DEFAULT false NOT NULL,
    telefone text,
    recebe_resumo_diario boolean DEFAULT true NOT NULL,
    central_visita_anterior timestamp with time zone,
    central_visita_atual timestamp with time zone
);

--
-- Name: relatorio_inativo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relatorio_inativo (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    solicitacao_id text NOT NULL,
    inativado_por uuid,
    inativado_por_nome text,
    motivo text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: resumo_semanal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resumo_semanal (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    semana_inicio date NOT NULL,
    semana_fim date NOT NULL,
    conteudo_md text NOT NULL,
    metricas jsonb,
    insights text[],
    modelo text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: reuniao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reuniao (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo text NOT NULL,
    tipo public.reuniao_tipo DEFAULT 'interna'::public.reuniao_tipo NOT NULL,
    status public.reuniao_status DEFAULT 'agendada'::public.reuniao_status NOT NULL,
    data_reuniao timestamp with time zone NOT NULL,
    duracao_min integer,
    participantes text[],
    link_calendario text,
    pauta text,
    resumo text,
    transcricao text,
    proximos_passos text,
    audio_path text,
    audio_size bigint,
    audio_mime text,
    responsavel_id uuid,
    criado_por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    responsaveis_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    equipe_toda boolean DEFAULT false NOT NULL,
    transcricao_status public.reuniao_transcricao_status DEFAULT 'pendente'::public.reuniao_transcricao_status NOT NULL,
    transcricao_erro text,
    decisoes text[],
    participantes_detectados text[],
    transcricao_partes_feitas integer DEFAULT 0 NOT NULL,
    transcricao_partes_total integer DEFAULT 0 NOT NULL,
    transcricao_rodadas integer DEFAULT 0 NOT NULL
);

ALTER TABLE ONLY public.reuniao REPLICA IDENTITY FULL;

--
-- Name: solicitacoes_relatorios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solicitacoes_relatorios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email_id text,
    solicitante_nome text,
    solicitante_email text,
    tipo_base text,
    descricao text,
    prazo date,
    urgencia text,
    justificativa_urgencia text,
    status text DEFAULT 'Pendente'::text,
    responsavel text,
    criado_em timestamp with time zone DEFAULT now(),
    categoria text DEFAULT 'Indefinido'::text,
    detalhes_email text
);

--
-- Name: todo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.todo (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo text NOT NULL,
    descricao text,
    status public.todo_status DEFAULT 'pendente'::public.todo_status NOT NULL,
    prioridade public.todo_prioridade DEFAULT 'media'::public.todo_prioridade NOT NULL,
    responsavel_id uuid,
    data_prevista date,
    concluida_em timestamp with time zone,
    demanda_id uuid,
    criado_por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    responsaveis_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    equipe_toda boolean DEFAULT false NOT NULL,
    lote_importacao_id uuid,
    origem_importacao text,
    em_teste boolean DEFAULT false NOT NULL,
    sistema text,
    link_homologacao text,
    observacao_homologacao text,
    data_homologacao date,
    numero_eproject bigint,
    liberacao_versao_em timestamp with time zone,
    liberacao_versao_por text,
    liberacao_acesso_em timestamp with time zone,
    liberacao_acesso_por text,
    liberacao_acesso_dispensada boolean DEFAULT false NOT NULL,
    liberacao_objetos text,
    liberacao_validada_em timestamp with time zone,
    liberacao_validada_por text
);

ALTER TABLE ONLY public.todo REPLICA IDENTITY FULL;

--
-- Name: COLUMN todo.sistema; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.todo.sistema IS 'Sistema da tarefa no e-mail de homologação (GED, Maed, App - Aluno...).';

--
-- Name: COLUMN todo.link_homologacao; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.todo.link_homologacao IS 'Endereço do ambiente de homologação informado no e-mail.';

--
-- Name: COLUMN todo.observacao_homologacao; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.todo.observacao_homologacao IS 'Observação do desenvolvimento no e-mail de homologação.';

--
-- Name: COLUMN todo.data_homologacao; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.todo.data_homologacao IS 'Data em que a tarefa ficou disponível para teste ("Data de hml" do e-mail).';

--
-- Name: COLUMN todo.numero_eproject; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.todo.numero_eproject IS 'Número da tarefa no E-project, extraído do título. Único: impede card duplicado.';

--
-- Name: COLUMN todo.liberacao_acesso_dispensada; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.todo.liberacao_acesso_dispensada IS 'A tarefa não cria objeto novo: não há acesso a liberar. Conta como confirmação de acesso.';

--
-- Name: COLUMN todo.liberacao_objetos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.todo.liberacao_objetos IS 'Objetos e grupos de usuários liberados em produção (ver "Versões do sistema" no GED e o E-project).';

--
-- Name: todo_anexo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.todo_anexo (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    todo_id uuid NOT NULL,
    autor_id uuid,
    autor_nome text,
    nome_arquivo text NOT NULL,
    storage_path text NOT NULL,
    mime_type text,
    tamanho_bytes bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: todo_checklist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.todo_checklist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    todo_id uuid NOT NULL,
    texto text NOT NULL,
    concluido boolean DEFAULT false NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: todo_comentario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.todo_comentario (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    todo_id uuid NOT NULL,
    autor_id uuid NOT NULL,
    autor_nome text,
    conteudo text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: todo_historico; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.todo_historico (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    todo_id uuid NOT NULL,
    autor_id uuid,
    autor_nome text,
    campo text NOT NULL,
    valor_antigo text,
    valor_novo text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: todo_importacao_lote; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.todo_importacao_lote (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    descricao text,
    tipo text DEFAULT 'homologacao'::text NOT NULL,
    total_tarefas integer DEFAULT 0 NOT NULL,
    criado_por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: unidades_rede; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unidades_rede (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cod_unidade text NOT NULL,
    tipo text NOT NULL,
    nome text NOT NULL,
    zona text,
    endereco text,
    bairro text,
    tecnicos uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    polo text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);

--
-- Name: aviso_gestor aviso_gestor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aviso_gestor
    ADD CONSTRAINT aviso_gestor_pkey PRIMARY KEY (id);

--
-- Name: aviso_leitura aviso_leitura_aviso_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aviso_leitura
    ADD CONSTRAINT aviso_leitura_aviso_id_user_id_key UNIQUE (aviso_id, user_id);

--
-- Name: aviso_leitura aviso_leitura_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aviso_leitura
    ADD CONSTRAINT aviso_leitura_pkey PRIMARY KEY (id);

--
-- Name: colaborador_evento colaborador_evento_colaborador_id_data_tipo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colaborador_evento
    ADD CONSTRAINT colaborador_evento_colaborador_id_data_tipo_key UNIQUE (colaborador_id, data, tipo);

--
-- Name: colaborador_evento colaborador_evento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colaborador_evento
    ADD CONSTRAINT colaborador_evento_pkey PRIMARY KEY (id);

--
-- Name: colaborador_ferias colaborador_ferias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colaborador_ferias
    ADD CONSTRAINT colaborador_ferias_pkey PRIMARY KEY (id);

--
-- Name: colaborador_galeria colaborador_galeria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colaborador_galeria
    ADD CONSTRAINT colaborador_galeria_pkey PRIMARY KEY (id);

--
-- Name: colaborador_horario colaborador_horario_colaborador_id_dia_semana_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colaborador_horario
    ADD CONSTRAINT colaborador_horario_colaborador_id_dia_semana_key UNIQUE (colaborador_id, dia_semana);

--
-- Name: colaborador_horario colaborador_horario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colaborador_horario
    ADD CONSTRAINT colaborador_horario_pkey PRIMARY KEY (id);

--
-- Name: colaborador colaborador_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colaborador
    ADD CONSTRAINT colaborador_pkey PRIMARY KEY (id);

--
-- Name: demanda demanda_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demanda
    ADD CONSTRAINT demanda_pkey PRIMARY KEY (id);

--
-- Name: email_digest_config email_digest_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_digest_config
    ADD CONSTRAINT email_digest_config_pkey PRIMARY KEY (id);

--
-- Name: email_send_log email_send_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_send_log
    ADD CONSTRAINT email_send_log_pkey PRIMARY KEY (id);

--
-- Name: google_calendar_config google_calendar_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_calendar_config
    ADD CONSTRAINT google_calendar_config_pkey PRIMARY KEY (id);

--
-- Name: google_calendar_evento google_calendar_evento_fonte_fonte_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_calendar_evento
    ADD CONSTRAINT google_calendar_evento_fonte_fonte_id_key UNIQUE (fonte, fonte_id);

--
-- Name: google_calendar_evento google_calendar_evento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_calendar_evento
    ADD CONSTRAINT google_calendar_evento_pkey PRIMARY KEY (id);

--
-- Name: google_oauth_conta google_oauth_conta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_oauth_conta
    ADD CONSTRAINT google_oauth_conta_pkey PRIMARY KEY (id);

--
-- Name: ia_prompt_config ia_prompt_config_chave_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ia_prompt_config
    ADD CONSTRAINT ia_prompt_config_chave_key UNIQUE (chave);

--
-- Name: ia_prompt_config ia_prompt_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ia_prompt_config
    ADD CONSTRAINT ia_prompt_config_pkey PRIMARY KEY (id);

--
-- Name: invite_token invite_token_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invite_token
    ADD CONSTRAINT invite_token_pkey PRIMARY KEY (id);

--
-- Name: invite_token invite_token_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invite_token
    ADD CONSTRAINT invite_token_token_key UNIQUE (token);

--
-- Name: notificacao notificacao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificacao
    ADD CONSTRAINT notificacao_pkey PRIMARY KEY (id);

--
-- Name: notificacao_preferencia notificacao_preferencia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificacao_preferencia
    ADD CONSTRAINT notificacao_preferencia_pkey PRIMARY KEY (id);

--
-- Name: notificacao_preferencia notificacao_preferencia_user_id_evento_canal_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificacao_preferencia
    ADD CONSTRAINT notificacao_preferencia_user_id_evento_canal_key UNIQUE (user_id, evento, canal);

--
-- Name: processo_anual processo_anual_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processo_anual
    ADD CONSTRAINT processo_anual_pkey PRIMARY KEY (id);

--
-- Name: processo_anual_vinculo processo_anual_vinculo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processo_anual_vinculo
    ADD CONSTRAINT processo_anual_vinculo_pkey PRIMARY KEY (id);

--
-- Name: processo_anual_vinculo processo_anual_vinculo_processo_id_tipo_ref_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processo_anual_vinculo
    ADD CONSTRAINT processo_anual_vinculo_processo_id_tipo_ref_id_key UNIQUE (processo_id, tipo, ref_id);

--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);

--
-- Name: relatorio_inativo relatorio_inativo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relatorio_inativo
    ADD CONSTRAINT relatorio_inativo_pkey PRIMARY KEY (id);

--
-- Name: relatorio_inativo relatorio_inativo_solicitacao_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relatorio_inativo
    ADD CONSTRAINT relatorio_inativo_solicitacao_id_key UNIQUE (solicitacao_id);

--
-- Name: resumo_semanal resumo_semanal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resumo_semanal
    ADD CONSTRAINT resumo_semanal_pkey PRIMARY KEY (id);

--
-- Name: resumo_semanal resumo_semanal_user_id_semana_inicio_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resumo_semanal
    ADD CONSTRAINT resumo_semanal_user_id_semana_inicio_key UNIQUE (user_id, semana_inicio);

--
-- Name: reuniao reuniao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reuniao
    ADD CONSTRAINT reuniao_pkey PRIMARY KEY (id);

--
-- Name: solicitacoes_relatorios solicitacoes_relatorios_email_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitacoes_relatorios
    ADD CONSTRAINT solicitacoes_relatorios_email_id_key UNIQUE (email_id);

--
-- Name: solicitacoes_relatorios solicitacoes_relatorios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitacoes_relatorios
    ADD CONSTRAINT solicitacoes_relatorios_pkey PRIMARY KEY (id);

--
-- Name: todo_anexo todo_anexo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.todo_anexo
    ADD CONSTRAINT todo_anexo_pkey PRIMARY KEY (id);

--
-- Name: todo_checklist todo_checklist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.todo_checklist
    ADD CONSTRAINT todo_checklist_pkey PRIMARY KEY (id);

--
-- Name: todo_comentario todo_comentario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.todo_comentario
    ADD CONSTRAINT todo_comentario_pkey PRIMARY KEY (id);

--
-- Name: todo_historico todo_historico_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.todo_historico
    ADD CONSTRAINT todo_historico_pkey PRIMARY KEY (id);

--
-- Name: todo_importacao_lote todo_importacao_lote_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.todo_importacao_lote
    ADD CONSTRAINT todo_importacao_lote_pkey PRIMARY KEY (id);

--
-- Name: todo todo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.todo
    ADD CONSTRAINT todo_pkey PRIMARY KEY (id);

--
-- Name: unidades_rede unidades_rede_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unidades_rede
    ADD CONSTRAINT unidades_rede_pkey PRIMARY KEY (id);

--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);

--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);

--
-- Name: aviso_gestor_processo_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX aviso_gestor_processo_id_key ON public.aviso_gestor USING btree (processo_id) WHERE (processo_id IS NOT NULL);

--
-- Name: idx_audit_log_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_changed_at ON public.audit_log USING btree (changed_at DESC);

--
-- Name: idx_audit_log_changed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_changed_by ON public.audit_log USING btree (changed_by);

--
-- Name: idx_audit_log_table_record; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_table_record ON public.audit_log USING btree (table_name, record_id);

--
-- Name: idx_aviso_ativo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aviso_ativo ON public.aviso_gestor USING btree (ativo);

--
-- Name: idx_aviso_gestor_colaborador_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aviso_gestor_colaborador_id ON public.aviso_gestor USING btree (colaborador_id);

--
-- Name: idx_aviso_gestor_criado_por; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aviso_gestor_criado_por ON public.aviso_gestor USING btree (criado_por);

--
-- Name: idx_aviso_leitura_aviso; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aviso_leitura_aviso ON public.aviso_leitura USING btree (aviso_id);

--
-- Name: idx_aviso_leitura_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aviso_leitura_user ON public.aviso_leitura USING btree (user_id);

--
-- Name: idx_colaborador_evento_colab; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_colaborador_evento_colab ON public.colaborador_evento USING btree (colaborador_id);

--
-- Name: idx_colaborador_evento_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_colaborador_evento_data ON public.colaborador_evento USING btree (data);

--
-- Name: idx_colaborador_galeria_colab; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_colaborador_galeria_colab ON public.colaborador_galeria USING btree (colaborador_id, ordem);

--
-- Name: idx_demanda_categoria; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_demanda_categoria ON public.demanda USING btree (categoria);

--
-- Name: idx_demanda_criado_por; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_demanda_criado_por ON public.demanda USING btree (criado_por);

--
-- Name: idx_demanda_responsavel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_demanda_responsavel ON public.demanda USING btree (responsavel_id);

--
-- Name: idx_demanda_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_demanda_status ON public.demanda USING btree (status);

--
-- Name: idx_email_send_log_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_send_log_status ON public.email_send_log USING btree (status, scheduled_for);

--
-- Name: idx_email_send_log_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_send_log_user ON public.email_send_log USING btree (user_id, created_at DESC);

--
-- Name: idx_gcal_evento_fonte; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gcal_evento_fonte ON public.google_calendar_evento USING btree (fonte, fonte_id);

--
-- Name: idx_invite_token_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invite_token_email ON public.invite_token USING btree (lower(email));

--
-- Name: idx_invite_token_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invite_token_token ON public.invite_token USING btree (token);

--
-- Name: idx_notificacao_user_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notificacao_user_unread ON public.notificacao USING btree (user_id, lida_em, created_at DESC);

--
-- Name: idx_processo_anual_ano; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_processo_anual_ano ON public.processo_anual USING btree (ano);

--
-- Name: idx_processo_anual_previsto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_processo_anual_previsto ON public.processo_anual USING btree (previsto_inicio, previsto_fim);

--
-- Name: idx_processo_vinculo_processo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_processo_vinculo_processo ON public.processo_anual_vinculo USING btree (processo_id);

--
-- Name: idx_relatorio_inativo_solic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_relatorio_inativo_solic ON public.relatorio_inativo USING btree (solicitacao_id);

--
-- Name: idx_resumo_semanal_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resumo_semanal_user ON public.resumo_semanal USING btree (user_id, semana_inicio DESC);

--
-- Name: idx_reuniao_criado_por; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reuniao_criado_por ON public.reuniao USING btree (criado_por);

--
-- Name: idx_reuniao_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reuniao_data ON public.reuniao USING btree (data_reuniao);

--
-- Name: idx_reuniao_responsavel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reuniao_responsavel ON public.reuniao USING btree (responsavel_id);

--
-- Name: idx_todo_anexo_todo_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_todo_anexo_todo_id ON public.todo_anexo USING btree (todo_id);

--
-- Name: idx_todo_checklist_todo_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_todo_checklist_todo_id ON public.todo_checklist USING btree (todo_id);

--
-- Name: idx_todo_comentario_todo_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_todo_comentario_todo_id ON public.todo_comentario USING btree (todo_id);

--
-- Name: idx_todo_created_at_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_todo_created_at_desc ON public.todo USING btree (created_at DESC);

--
-- Name: idx_todo_criado_por; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_todo_criado_por ON public.todo USING btree (criado_por);

--
-- Name: idx_todo_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_todo_data ON public.todo USING btree (data_prevista);

--
-- Name: idx_todo_demanda_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_todo_demanda_id ON public.todo USING btree (demanda_id);

--
-- Name: idx_todo_em_teste; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_todo_em_teste ON public.todo USING btree (em_teste) WHERE (em_teste = true);

--
-- Name: idx_todo_historico_todo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_todo_historico_todo ON public.todo_historico USING btree (todo_id);

--
-- Name: idx_todo_lote_importacao; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_todo_lote_importacao ON public.todo USING btree (lote_importacao_id);

--
-- Name: idx_todo_origem_importacao; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_todo_origem_importacao ON public.todo USING btree (origem_importacao);

--
-- Name: idx_todo_responsavel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_todo_responsavel ON public.todo USING btree (responsavel_id);

--
-- Name: idx_todo_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_todo_status ON public.todo USING btree (status);

--
-- Name: idx_todo_status_not_encerrada; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_todo_status_not_encerrada ON public.todo USING btree (status) WHERE (status <> 'encerrada'::public.todo_status);

--
-- Name: idx_unidades_rede_bairro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_unidades_rede_bairro ON public.unidades_rede USING btree (bairro);

--
-- Name: idx_unidades_rede_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_unidades_rede_tipo ON public.unidades_rede USING btree (tipo);

--
-- Name: idx_unidades_rede_zona; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_unidades_rede_zona ON public.unidades_rede USING btree (zona);

--
-- Name: profiles_colaborador_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profiles_colaborador_id_unique ON public.profiles USING btree (colaborador_id) WHERE (colaborador_id IS NOT NULL);

--
-- Name: profiles_telefone_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profiles_telefone_unique ON public.profiles USING btree (telefone) WHERE (telefone IS NOT NULL);

--
-- Name: todo_numero_eproject_unico; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX todo_numero_eproject_unico ON public.todo USING btree (numero_eproject) WHERE (numero_eproject IS NOT NULL);

--
-- Name: aviso_gestor audit_aviso_gestor; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_aviso_gestor AFTER INSERT OR DELETE OR UPDATE ON public.aviso_gestor FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

--
-- Name: colaborador audit_colaborador; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_colaborador AFTER INSERT OR DELETE OR UPDATE ON public.colaborador FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

--
-- Name: colaborador_ferias audit_colaborador_ferias; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_colaborador_ferias AFTER INSERT OR DELETE OR UPDATE ON public.colaborador_ferias FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

--
-- Name: demanda audit_demanda; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_demanda AFTER INSERT OR DELETE OR UPDATE ON public.demanda FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

--
-- Name: invite_token audit_invite_token; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_invite_token AFTER INSERT OR DELETE OR UPDATE ON public.invite_token FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

--
-- Name: reuniao audit_reuniao; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_reuniao AFTER INSERT OR DELETE OR UPDATE ON public.reuniao FOR EACH ROW EXECUTE FUNCTION public.log_audit_event('transcricao,transcricao_status,transcricao_erro,transcricao_partes_feitas,transcricao_partes_total,transcricao_rodadas');

--
-- Name: user_roles audit_user_roles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_user_roles AFTER INSERT OR DELETE OR UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

--
-- Name: aviso_gestor set_updated_at_aviso_gestor; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_aviso_gestor BEFORE UPDATE ON public.aviso_gestor FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

--
-- Name: colaborador set_updated_at_colaborador; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_colaborador BEFORE UPDATE ON public.colaborador FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

--
-- Name: colaborador_evento set_updated_at_colaborador_evento; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_colaborador_evento BEFORE UPDATE ON public.colaborador_evento FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

--
-- Name: colaborador_ferias set_updated_at_colaborador_ferias; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_colaborador_ferias BEFORE UPDATE ON public.colaborador_ferias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

--
-- Name: colaborador_galeria set_updated_at_colaborador_galeria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_colaborador_galeria BEFORE UPDATE ON public.colaborador_galeria FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

--
-- Name: colaborador_horario set_updated_at_colaborador_horario; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_colaborador_horario BEFORE UPDATE ON public.colaborador_horario FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

--
-- Name: demanda set_updated_at_demanda; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_demanda BEFORE UPDATE ON public.demanda FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

--
-- Name: invite_token set_updated_at_invite_token; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_invite_token BEFORE UPDATE ON public.invite_token FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

--
-- Name: profiles set_updated_at_profiles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

--
-- Name: reuniao set_updated_at_reuniao; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_reuniao BEFORE UPDATE ON public.reuniao FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

--
-- Name: todo set_updated_at_todo; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_todo BEFORE UPDATE ON public.todo FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

--
-- Name: todo_checklist set_updated_at_todo_checklist; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_todo_checklist BEFORE UPDATE ON public.todo_checklist FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

--
-- Name: aviso_gestor trg_aviso_gestor_notify; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_aviso_gestor_notify AFTER INSERT OR UPDATE ON public.aviso_gestor FOR EACH ROW EXECUTE FUNCTION public.notify_aviso_critico();

--
-- Name: email_send_log trg_email_send_log_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_email_send_log_updated_at BEFORE UPDATE ON public.email_send_log FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

--
-- Name: google_calendar_config trg_google_calendar_config_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_google_calendar_config_updated BEFORE UPDATE ON public.google_calendar_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

--
-- Name: notificacao_preferencia trg_notif_pref_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notif_pref_updated_at BEFORE UPDATE ON public.notificacao_preferencia FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

--
-- Name: notificacao trg_notificacao_email_imediato; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notificacao_email_imediato AFTER INSERT ON public.notificacao FOR EACH ROW EXECUTE FUNCTION public.enqueue_email_imediato();

--
-- Name: demanda trg_notify_demanda_atribuida; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_demanda_atribuida AFTER INSERT OR UPDATE OF responsavel_id, responsaveis_ids, prioridade ON public.demanda FOR EACH ROW EXECUTE FUNCTION public.notify_demanda_atribuida();

--
-- Name: todo trg_notify_tarefa_atribuida; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_tarefa_atribuida AFTER INSERT OR UPDATE OF responsavel_id, responsaveis_ids ON public.todo FOR EACH ROW EXECUTE FUNCTION public.notify_tarefa_atribuida();

--
-- Name: todo_comentario trg_notify_tarefa_comentario; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_tarefa_comentario AFTER INSERT ON public.todo_comentario FOR EACH ROW EXECUTE FUNCTION public.notify_tarefa_comentario();

--
-- Name: processo_anual trg_processo_anual_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_processo_anual_updated_at BEFORE UPDATE ON public.processo_anual FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

--
-- Name: todo_historico trg_todo_historico_descartar_repetido; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_todo_historico_descartar_repetido BEFORE INSERT ON public.todo_historico FOR EACH ROW EXECUTE FUNCTION public.todo_historico_descartar_status_repetido();

--
-- Name: todo trg_todo_numero_eproject; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_todo_numero_eproject BEFORE INSERT OR UPDATE OF titulo ON public.todo FOR EACH ROW EXECUTE FUNCTION public.todo_set_numero_eproject();

--
-- Name: todo trg_todo_registrar_responsaveis; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_todo_registrar_responsaveis AFTER INSERT OR UPDATE OF responsaveis_ids, responsavel_id, equipe_toda ON public.todo FOR EACH ROW EXECUTE FUNCTION public.todo_registrar_responsaveis();

--
-- Name: todo trg_todo_registrar_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_todo_registrar_status AFTER INSERT OR UPDATE OF status ON public.todo FOR EACH ROW EXECUTE FUNCTION public.todo_registrar_status();

--
-- Name: todo trg_todo_regra_liberacao; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_todo_regra_liberacao BEFORE UPDATE OF status ON public.todo FOR EACH ROW EXECUTE FUNCTION public.todo_regra_liberacao();

--
-- Name: unidades_rede trg_unidades_rede_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_unidades_rede_updated_at BEFORE UPDATE ON public.unidades_rede FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

--
-- Name: ia_prompt_config update_ia_prompt_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ia_prompt_config_updated_at BEFORE UPDATE ON public.ia_prompt_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

--
-- Name: todo_importacao_lote update_todo_importacao_lote_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_todo_importacao_lote_updated_at BEFORE UPDATE ON public.todo_importacao_lote FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

--
-- Name: aviso_gestor aviso_gestor_colaborador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aviso_gestor
    ADD CONSTRAINT aviso_gestor_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES public.colaborador(id) ON DELETE SET NULL;

--
-- Name: aviso_gestor aviso_gestor_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aviso_gestor
    ADD CONSTRAINT aviso_gestor_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: aviso_gestor aviso_gestor_processo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aviso_gestor
    ADD CONSTRAINT aviso_gestor_processo_id_fkey FOREIGN KEY (processo_id) REFERENCES public.processo_anual(id) ON DELETE CASCADE;

--
-- Name: aviso_leitura aviso_leitura_aviso_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aviso_leitura
    ADD CONSTRAINT aviso_leitura_aviso_id_fkey FOREIGN KEY (aviso_id) REFERENCES public.aviso_gestor(id) ON DELETE CASCADE;

--
-- Name: colaborador_evento colaborador_evento_colaborador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colaborador_evento
    ADD CONSTRAINT colaborador_evento_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES public.colaborador(id) ON DELETE CASCADE;

--
-- Name: colaborador_ferias colaborador_ferias_colaborador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colaborador_ferias
    ADD CONSTRAINT colaborador_ferias_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES public.colaborador(id) ON DELETE CASCADE;

--
-- Name: colaborador_horario colaborador_horario_colaborador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colaborador_horario
    ADD CONSTRAINT colaborador_horario_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES public.colaborador(id) ON DELETE CASCADE;

--
-- Name: demanda demanda_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demanda
    ADD CONSTRAINT demanda_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: demanda demanda_responsavel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demanda
    ADD CONSTRAINT demanda_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: google_oauth_conta google_oauth_conta_conectado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_oauth_conta
    ADD CONSTRAINT google_oauth_conta_conectado_por_fkey FOREIGN KEY (conectado_por) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: processo_anual processo_anual_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processo_anual
    ADD CONSTRAINT processo_anual_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: processo_anual_vinculo processo_anual_vinculo_processo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processo_anual_vinculo
    ADD CONSTRAINT processo_anual_vinculo_processo_id_fkey FOREIGN KEY (processo_id) REFERENCES public.processo_anual(id) ON DELETE CASCADE;

--
-- Name: profiles profiles_colaborador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES public.colaborador(id) ON DELETE SET NULL;

--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: reuniao reuniao_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reuniao
    ADD CONSTRAINT reuniao_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: reuniao reuniao_responsavel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reuniao
    ADD CONSTRAINT reuniao_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: todo_anexo todo_anexo_todo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.todo_anexo
    ADD CONSTRAINT todo_anexo_todo_id_fkey FOREIGN KEY (todo_id) REFERENCES public.todo(id) ON DELETE CASCADE;

--
-- Name: todo_checklist todo_checklist_todo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.todo_checklist
    ADD CONSTRAINT todo_checklist_todo_id_fkey FOREIGN KEY (todo_id) REFERENCES public.todo(id) ON DELETE CASCADE;

--
-- Name: todo_comentario todo_comentario_todo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.todo_comentario
    ADD CONSTRAINT todo_comentario_todo_id_fkey FOREIGN KEY (todo_id) REFERENCES public.todo(id) ON DELETE CASCADE;

--
-- Name: todo todo_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.todo
    ADD CONSTRAINT todo_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: todo todo_demanda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.todo
    ADD CONSTRAINT todo_demanda_id_fkey FOREIGN KEY (demanda_id) REFERENCES public.demanda(id) ON DELETE SET NULL;

--
-- Name: todo_historico todo_historico_todo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.todo_historico
    ADD CONSTRAINT todo_historico_todo_id_fkey FOREIGN KEY (todo_id) REFERENCES public.todo(id) ON DELETE CASCADE;

--
-- Name: todo todo_lote_importacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.todo
    ADD CONSTRAINT todo_lote_importacao_id_fkey FOREIGN KEY (lote_importacao_id) REFERENCES public.todo_importacao_lote(id) ON DELETE SET NULL;

--
-- Name: todo todo_responsavel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.todo
    ADD CONSTRAINT todo_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: todo_anexo Autenticado cria anexo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Autenticado cria anexo" ON public.todo_anexo FOR INSERT TO authenticated WITH CHECK (((( SELECT auth.uid() AS uid) IS NOT NULL) AND (( SELECT auth.uid() AS uid) = autor_id)));

--
-- Name: todo_comentario Autenticado cria comentário; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Autenticado cria comentário" ON public.todo_comentario FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = autor_id));

--
-- Name: demanda Autenticado cria demanda; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Autenticado cria demanda" ON public.demanda FOR INSERT TO authenticated WITH CHECK (((( SELECT auth.uid() AS uid) = criado_por) OR public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role)));

--
-- Name: todo_importacao_lote Autenticado cria lote de importação; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Autenticado cria lote de importação" ON public.todo_importacao_lote FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = criado_por));

--
-- Name: reuniao Autenticado cria reunião; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Autenticado cria reunião" ON public.reuniao FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = criado_por));

--
-- Name: todo Autenticado cria tarefa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Autenticado cria tarefa" ON public.todo FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = criado_por));

--
-- Name: relatorio_inativo Autenticado inativa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Autenticado inativa" ON public.relatorio_inativo FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));

--
-- Name: google_calendar_evento Autenticados leem mapa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Autenticados leem mapa" ON public.google_calendar_evento FOR SELECT TO authenticated USING (true);

--
-- Name: relatorio_inativo Autor ou gestor reativa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Autor ou gestor reativa" ON public.relatorio_inativo FOR DELETE TO authenticated USING (((( SELECT auth.uid() AS uid) = inativado_por) OR public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role)));

--
-- Name: todo_anexo Autor ou gestor remove anexo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Autor ou gestor remove anexo" ON public.todo_anexo FOR DELETE TO authenticated USING (((( SELECT auth.uid() AS uid) = autor_id) OR public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role)));

--
-- Name: todo_comentario Autor ou gestor remove comentário; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Autor ou gestor remove comentário" ON public.todo_comentario FOR DELETE TO authenticated USING (((( SELECT auth.uid() AS uid) = autor_id) OR public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role)));

--
-- Name: todo_importacao_lote Criador ou gestor atualiza lote; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Criador ou gestor atualiza lote" ON public.todo_importacao_lote FOR UPDATE TO authenticated USING ((public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role) OR (( SELECT auth.uid() AS uid) = criado_por)));

--
-- Name: todo_importacao_lote Criador ou gestor deleta lote; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Criador ou gestor deleta lote" ON public.todo_importacao_lote FOR DELETE TO authenticated USING ((public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role) OR (( SELECT auth.uid() AS uid) = criado_por)));

--
-- Name: todo Deleta tarefa própria ou gestor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Deleta tarefa própria ou gestor" ON public.todo FOR DELETE TO authenticated USING ((public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role) OR (( SELECT auth.uid() AS uid) = criado_por)));

--
-- Name: processo_anual_vinculo Equipe apaga vínculos de processo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe apaga vínculos de processo" ON public.processo_anual_vinculo FOR DELETE TO authenticated USING (public.is_equipe(( SELECT auth.uid() AS uid)));

--
-- Name: todo_checklist Equipe atualiza checklist; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe atualiza checklist" ON public.todo_checklist FOR UPDATE TO authenticated USING (public.is_equipe(( SELECT auth.uid() AS uid)));

--
-- Name: demanda Equipe atualiza demandas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe atualiza demandas" ON public.demanda FOR UPDATE TO authenticated USING (public.is_equipe(( SELECT auth.uid() AS uid)));

--
-- Name: reuniao Equipe atualiza reuniões; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe atualiza reuniões" ON public.reuniao FOR UPDATE TO authenticated USING (public.is_equipe(( SELECT auth.uid() AS uid)));

--
-- Name: todo Equipe atualiza tarefas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe atualiza tarefas" ON public.todo FOR UPDATE TO authenticated USING (public.is_equipe(( SELECT auth.uid() AS uid))) WITH CHECK (public.is_equipe(( SELECT auth.uid() AS uid)));

--
-- Name: unidades_rede Equipe atualiza unidades; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe atualiza unidades" ON public.unidades_rede FOR UPDATE TO authenticated USING (public.is_equipe(( SELECT auth.uid() AS uid))) WITH CHECK (public.is_equipe(( SELECT auth.uid() AS uid)));

--
-- Name: processo_anual_vinculo Equipe atualiza vínculos de processo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe atualiza vínculos de processo" ON public.processo_anual_vinculo FOR UPDATE TO authenticated USING (public.is_equipe(( SELECT auth.uid() AS uid))) WITH CHECK (public.is_equipe(( SELECT auth.uid() AS uid)));

--
-- Name: todo_checklist Equipe cria checklist; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe cria checklist" ON public.todo_checklist FOR INSERT TO authenticated WITH CHECK (public.is_equipe(( SELECT auth.uid() AS uid)));

--
-- Name: todo_historico Equipe cria histórico; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe cria histórico" ON public.todo_historico FOR INSERT TO authenticated WITH CHECK (public.is_equipe(( SELECT auth.uid() AS uid)));

--
-- Name: unidades_rede Equipe cria unidades; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe cria unidades" ON public.unidades_rede FOR INSERT TO authenticated WITH CHECK (public.is_equipe(( SELECT auth.uid() AS uid)));

--
-- Name: processo_anual_vinculo Equipe cria vínculos de processo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe cria vínculos de processo" ON public.processo_anual_vinculo FOR INSERT TO authenticated WITH CHECK (public.is_equipe(( SELECT auth.uid() AS uid)));

--
-- Name: todo_checklist Equipe remove checklist; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe remove checklist" ON public.todo_checklist FOR DELETE TO authenticated USING (public.is_equipe(( SELECT auth.uid() AS uid)));

--
-- Name: todo_anexo Equipe vê anexos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe vê anexos" ON public.todo_anexo FOR SELECT TO authenticated USING (true);

--
-- Name: aviso_gestor Equipe vê avisos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe vê avisos" ON public.aviso_gestor FOR SELECT TO authenticated USING (true);

--
-- Name: todo_checklist Equipe vê checklist; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe vê checklist" ON public.todo_checklist FOR SELECT TO authenticated USING (true);

--
-- Name: todo_comentario Equipe vê comentários; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe vê comentários" ON public.todo_comentario FOR SELECT TO authenticated USING (true);

--
-- Name: demanda Equipe vê demandas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe vê demandas" ON public.demanda FOR SELECT TO authenticated USING (true);

--
-- Name: colaborador_evento Equipe vê eventos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe vê eventos" ON public.colaborador_evento FOR SELECT TO authenticated USING (true);

--
-- Name: colaborador_ferias Equipe vê ferias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe vê ferias" ON public.colaborador_ferias FOR SELECT TO authenticated USING (true);

--
-- Name: colaborador_galeria Equipe vê galeria; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe vê galeria" ON public.colaborador_galeria FOR SELECT TO authenticated USING (true);

--
-- Name: todo_historico Equipe vê histórico; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe vê histórico" ON public.todo_historico FOR SELECT TO authenticated USING (true);

--
-- Name: colaborador_horario Equipe vê horarios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe vê horarios" ON public.colaborador_horario FOR SELECT TO authenticated USING (true);

--
-- Name: relatorio_inativo Equipe vê inativações; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe vê inativações" ON public.relatorio_inativo FOR SELECT TO authenticated USING (true);

--
-- Name: todo_importacao_lote Equipe vê lotes de importação; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe vê lotes de importação" ON public.todo_importacao_lote FOR SELECT TO authenticated USING (true);

--
-- Name: profiles Equipe vê perfis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe vê perfis" ON public.profiles FOR SELECT TO authenticated USING (((( SELECT auth.uid() AS uid) = user_id) OR public.is_equipe(( SELECT auth.uid() AS uid))));

--
-- Name: reuniao Equipe vê reuniões; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe vê reuniões" ON public.reuniao FOR SELECT TO authenticated USING (true);

--
-- Name: todo Equipe vê tarefas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe vê tarefas" ON public.todo FOR SELECT TO authenticated USING (true);

--
-- Name: unidades_rede Equipe vê unidades; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe vê unidades" ON public.unidades_rede FOR SELECT TO authenticated USING (true);

--
-- Name: aviso_gestor Gestor apaga avisos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestor apaga avisos" ON public.aviso_gestor FOR DELETE TO authenticated USING (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: colaborador Gestor apaga colaboradores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestor apaga colaboradores" ON public.colaborador FOR DELETE TO authenticated USING (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: email_send_log Gestor apaga email_send_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestor apaga email_send_log" ON public.email_send_log FOR DELETE TO authenticated USING (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: colaborador_evento Gestor apaga eventos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestor apaga eventos" ON public.colaborador_evento FOR DELETE TO authenticated USING (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: colaborador_ferias Gestor apaga ferias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestor apaga ferias" ON public.colaborador_ferias FOR DELETE TO authenticated USING (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: colaborador_galeria Gestor apaga galeria; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestor apaga galeria" ON public.colaborador_galeria FOR DELETE TO authenticated USING (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: colaborador_horario Gestor apaga horarios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestor apaga horarios" ON public.colaborador_horario FOR DELETE TO authenticated USING (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: user_roles Gestor apaga roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestor apaga roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: aviso_gestor Gestor atualiza avisos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestor atualiza avisos" ON public.aviso_gestor FOR UPDATE TO authenticated USING (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role)) WITH CHECK (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: colaborador Gestor atualiza colaboradores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestor atualiza colaboradores" ON public.colaborador FOR UPDATE TO authenticated USING (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role)) WITH CHECK (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: email_send_log Gestor atualiza email_send_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestor atualiza email_send_log" ON public.email_send_log FOR UPDATE TO authenticated USING (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role)) WITH CHECK (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: colaborador_evento Gestor atualiza eventos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestor atualiza eventos" ON public.colaborador_evento FOR UPDATE TO authenticated USING (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role)) WITH CHECK (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: colaborador_ferias Gestor atualiza ferias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestor atualiza ferias" ON public.colaborador_ferias FOR UPDATE TO authenticated USING (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role)) WITH CHECK (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: colaborador_galeria Gestor atualiza galeria; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestor atualiza galeria" ON public.colaborador_galeria FOR UPDATE TO authenticated USING (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role)) WITH CHECK (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: colaborador_horario Gestor atualiza horarios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestor atualiza horarios" ON public.colaborador_horario FOR UPDATE TO authenticated USING (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role)) WITH CHECK (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: user_roles Gestor atualiza roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestor atualiza roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role)) WITH CHECK (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: aviso_gestor Gestor cria avisos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestor cria avisos" ON public.aviso_gestor FOR INSERT TO authenticated WITH CHECK (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: colaborador Gestor cria colaboradores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestor cria colaboradores" ON public.colaborador FOR INSERT TO authenticated WITH CHECK (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: colaborador_evento Gestor cria eventos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestor cria eventos" ON public.colaborador_evento FOR INSERT TO authenticated WITH CHECK (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: colaborador_ferias Gestor cria ferias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestor cria ferias" ON public.colaborador_ferias FOR INSERT TO authenticated WITH CHECK (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: colaborador_galeria Gestor cria galeria; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestor cria galeria" ON public.colaborador_galeria FOR INSERT TO authenticated WITH CHECK (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: colaborador_horario Gestor cria horarios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestor cria horarios" ON public.colaborador_horario FOR INSERT TO authenticated WITH CHECK (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: user_roles Gestor cria roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestor cria roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: demanda Gestor deleta demanda; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestor deleta demanda" ON public.demanda FOR DELETE TO authenticated USING (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: notificacao Gestor deleta notificações; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestor deleta notificações" ON public.notificacao FOR DELETE TO authenticated USING ((public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role) OR (( SELECT auth.uid() AS uid) = user_id)));

--
-- Name: reuniao Gestor deleta reunião; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestor deleta reunião" ON public.reuniao FOR DELETE TO authenticated USING (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: unidades_rede Gestor exclui unidades; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestor exclui unidades" ON public.unidades_rede FOR DELETE TO authenticated USING (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: google_calendar_config Gestor gerencia config google calendar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestor gerencia config google calendar" ON public.google_calendar_config TO authenticated USING (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role)) WITH CHECK (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: invite_token Gestor gerencia convites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestor gerencia convites" ON public.invite_token TO authenticated USING (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role)) WITH CHECK (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: ia_prompt_config Gestor gerencia prompts de IA; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestor gerencia prompts de IA" ON public.ia_prompt_config TO authenticated USING (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role)) WITH CHECK (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: email_send_log Gestor insere email_send_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestor insere email_send_log" ON public.email_send_log FOR INSERT TO authenticated WITH CHECK (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: email_send_log Gestor lê email_send_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestor lê email_send_log" ON public.email_send_log FOR SELECT TO authenticated USING (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: audit_log Gestor vê auditoria; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestor vê auditoria" ON public.audit_log FOR SELECT TO authenticated USING (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: colaborador Todos veem colaboradores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Todos veem colaboradores" ON public.colaborador FOR SELECT TO authenticated USING (true);

--
-- Name: notificacao Usuário atualiza suas notificações; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuário atualiza suas notificações" ON public.notificacao FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));

--
-- Name: notificacao_preferencia Usuário gerencia suas preferências; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuário gerencia suas preferências" ON public.notificacao_preferencia TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

--
-- Name: profiles Usuário insere seu próprio profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuário insere seu próprio profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

--
-- Name: resumo_semanal Usuário lê seu resumo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuário lê seu resumo" ON public.resumo_semanal FOR SELECT TO authenticated USING (((( SELECT auth.uid() AS uid) = user_id) OR public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role)));

--
-- Name: aviso_leitura Usuário marca como lida; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuário marca como lida" ON public.aviso_leitura FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

--
-- Name: profiles Usuário ou gestor atualiza profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuário ou gestor atualiza profile" ON public.profiles FOR UPDATE TO authenticated USING (((( SELECT auth.uid() AS uid) = user_id) OR public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role)));

--
-- Name: aviso_leitura Usuário remove sua leitura; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuário remove sua leitura" ON public.aviso_leitura FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));

--
-- Name: aviso_leitura Usuário vê suas leituras; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuário vê suas leituras" ON public.aviso_leitura FOR SELECT TO authenticated USING (((( SELECT auth.uid() AS uid) = user_id) OR public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role)));

--
-- Name: notificacao Usuário vê suas notificações; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuário vê suas notificações" ON public.notificacao FOR SELECT TO authenticated USING (((( SELECT auth.uid() AS uid) = user_id) OR public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role)));

--
-- Name: user_roles Usuário vê suas roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuário vê suas roles" ON public.user_roles FOR SELECT TO authenticated USING (((( SELECT auth.uid() AS uid) = user_id) OR public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role)));

--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: aviso_gestor; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.aviso_gestor ENABLE ROW LEVEL SECURITY;

--
-- Name: aviso_leitura; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.aviso_leitura ENABLE ROW LEVEL SECURITY;

--
-- Name: colaborador; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.colaborador ENABLE ROW LEVEL SECURITY;

--
-- Name: colaborador_evento; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.colaborador_evento ENABLE ROW LEVEL SECURITY;

--
-- Name: colaborador_ferias; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.colaborador_ferias ENABLE ROW LEVEL SECURITY;

--
-- Name: colaborador_galeria; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.colaborador_galeria ENABLE ROW LEVEL SECURITY;

--
-- Name: colaborador_horario; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.colaborador_horario ENABLE ROW LEVEL SECURITY;

--
-- Name: demanda; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.demanda ENABLE ROW LEVEL SECURITY;

--
-- Name: email_digest_config digest_config_write_gestor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY digest_config_write_gestor ON public.email_digest_config TO authenticated USING (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role)) WITH CHECK (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: email_digest_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_digest_config ENABLE ROW LEVEL SECURITY;

--
-- Name: email_send_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

--
-- Name: google_calendar_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.google_calendar_config ENABLE ROW LEVEL SECURITY;

--
-- Name: google_calendar_evento; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.google_calendar_evento ENABLE ROW LEVEL SECURITY;

--
-- Name: google_oauth_conta; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.google_oauth_conta ENABLE ROW LEVEL SECURITY;

--
-- Name: ia_prompt_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ia_prompt_config ENABLE ROW LEVEL SECURITY;

--
-- Name: invite_token; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invite_token ENABLE ROW LEVEL SECURITY;

--
-- Name: notificacao; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notificacao ENABLE ROW LEVEL SECURITY;

--
-- Name: notificacao_preferencia; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notificacao_preferencia ENABLE ROW LEVEL SECURITY;

--
-- Name: processo_anual; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.processo_anual ENABLE ROW LEVEL SECURITY;

--
-- Name: processo_anual processo_anual_delete_gestor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY processo_anual_delete_gestor ON public.processo_anual FOR DELETE TO authenticated USING (public.has_role(( SELECT auth.uid() AS uid), 'gestor'::public.app_role));

--
-- Name: processo_anual processo_anual_insert_equipe; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY processo_anual_insert_equipe ON public.processo_anual FOR INSERT TO authenticated WITH CHECK (public.is_equipe(( SELECT auth.uid() AS uid)));

--
-- Name: processo_anual processo_anual_select_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY processo_anual_select_auth ON public.processo_anual FOR SELECT TO authenticated USING (true);

--
-- Name: processo_anual processo_anual_update_equipe; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY processo_anual_update_equipe ON public.processo_anual FOR UPDATE TO authenticated USING (public.is_equipe(( SELECT auth.uid() AS uid))) WITH CHECK (public.is_equipe(( SELECT auth.uid() AS uid)));

--
-- Name: processo_anual_vinculo; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.processo_anual_vinculo ENABLE ROW LEVEL SECURITY;

--
-- Name: processo_anual_vinculo processo_vinculo_select_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY processo_vinculo_select_auth ON public.processo_anual_vinculo FOR SELECT TO authenticated USING (true);

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: relatorio_inativo; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.relatorio_inativo ENABLE ROW LEVEL SECURITY;

--
-- Name: resumo_semanal; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.resumo_semanal ENABLE ROW LEVEL SECURITY;

--
-- Name: reuniao; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reuniao ENABLE ROW LEVEL SECURITY;

--
-- Name: solicitacoes_relatorios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.solicitacoes_relatorios ENABLE ROW LEVEL SECURITY;

--
-- Name: todo; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.todo ENABLE ROW LEVEL SECURITY;

--
-- Name: todo_anexo; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.todo_anexo ENABLE ROW LEVEL SECURITY;

--
-- Name: todo_checklist; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.todo_checklist ENABLE ROW LEVEL SECURITY;

--
-- Name: todo_comentario; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.todo_comentario ENABLE ROW LEVEL SECURITY;

--
-- Name: todo_historico; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.todo_historico ENABLE ROW LEVEL SECURITY;

--
-- Name: todo_importacao_lote; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.todo_importacao_lote ENABLE ROW LEVEL SECURITY;

--
-- Name: unidades_rede; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.unidades_rede ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

--
-- Name: FUNCTION confirmar_liberacao(p_ids uuid[], p_etapa text, p_marcar boolean, p_objetos text, p_dispensada boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.confirmar_liberacao(p_ids uuid[], p_etapa text, p_marcar boolean, p_objetos text, p_dispensada boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.confirmar_liberacao(p_ids uuid[], p_etapa text, p_marcar boolean, p_objetos text, p_dispensada boolean) TO authenticated;
GRANT ALL ON FUNCTION public.confirmar_liberacao(p_ids uuid[], p_etapa text, p_marcar boolean, p_objetos text, p_dispensada boolean) TO service_role;

--
-- Name: FUNCTION enqueue_email_imediato(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enqueue_email_imediato() FROM PUBLIC;
GRANT ALL ON FUNCTION public.enqueue_email_imediato() TO service_role;

--
-- Name: FUNCTION enqueue_notificacao(_user_id uuid, _tipo public.notificacao_tipo, _titulo text, _mensagem text, _link text, _metadata jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enqueue_notificacao(_user_id uuid, _tipo public.notificacao_tipo, _titulo text, _mensagem text, _link text, _metadata jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.enqueue_notificacao(_user_id uuid, _tipo public.notificacao_tipo, _titulo text, _mensagem text, _link text, _metadata jsonb) TO service_role;

--
-- Name: FUNCTION gerar_avisos_processos_proximos(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.gerar_avisos_processos_proximos() FROM PUBLIC;
GRANT ALL ON FUNCTION public.gerar_avisos_processos_proximos() TO service_role;

--
-- Name: FUNCTION gerar_notificacoes_prazo(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.gerar_notificacoes_prazo() FROM PUBLIC;
GRANT ALL ON FUNCTION public.gerar_notificacoes_prazo() TO service_role;

--
-- Name: FUNCTION get_tarefa_counts(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_tarefa_counts() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_tarefa_counts() TO anon;
GRANT ALL ON FUNCTION public.get_tarefa_counts() TO authenticated;
GRANT ALL ON FUNCTION public.get_tarefa_counts() TO service_role;

--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;

--
-- Name: FUNCTION has_role(_user_id uuid, _role public.app_role); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) FROM PUBLIC;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO authenticated;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO service_role;

--
-- Name: FUNCTION html_escape(_t text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.html_escape(_t text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.html_escape(_t text) TO anon;
GRANT ALL ON FUNCTION public.html_escape(_t text) TO authenticated;
GRANT ALL ON FUNCTION public.html_escape(_t text) TO service_role;

--
-- Name: FUNCTION is_equipe(_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_equipe(_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_equipe(_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_equipe(_user_id uuid) TO service_role;

--
-- Name: FUNCTION log_audit_event(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.log_audit_event() FROM PUBLIC;
GRANT ALL ON FUNCTION public.log_audit_event() TO service_role;

--
-- Name: FUNCTION marcar_transcricoes_travadas(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.marcar_transcricoes_travadas() FROM PUBLIC;
GRANT ALL ON FUNCTION public.marcar_transcricoes_travadas() TO service_role;

--
-- Name: FUNCTION nomes_responsaveis(_ids uuid[], _unico uuid, _equipe boolean); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.nomes_responsaveis(_ids uuid[], _unico uuid, _equipe boolean) TO anon;
GRANT ALL ON FUNCTION public.nomes_responsaveis(_ids uuid[], _unico uuid, _equipe boolean) TO authenticated;
GRANT ALL ON FUNCTION public.nomes_responsaveis(_ids uuid[], _unico uuid, _equipe boolean) TO service_role;

--
-- Name: FUNCTION notificar_atribuicao(p_destino uuid, p_tarefa_id uuid, p_titulo text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notificar_atribuicao(p_destino uuid, p_tarefa_id uuid, p_titulo text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.notificar_atribuicao(p_destino uuid, p_tarefa_id uuid, p_titulo text) TO service_role;

--
-- Name: FUNCTION notify_aviso_critico(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_aviso_critico() FROM PUBLIC;
GRANT ALL ON FUNCTION public.notify_aviso_critico() TO service_role;

--
-- Name: FUNCTION notify_demanda_atribuida(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_demanda_atribuida() FROM PUBLIC;
GRANT ALL ON FUNCTION public.notify_demanda_atribuida() TO service_role;

--
-- Name: FUNCTION notify_processo_proximo(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_processo_proximo() FROM PUBLIC;
GRANT ALL ON FUNCTION public.notify_processo_proximo() TO service_role;

--
-- Name: FUNCTION notify_tarefa_atribuida(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_tarefa_atribuida() FROM PUBLIC;
GRANT ALL ON FUNCTION public.notify_tarefa_atribuida() TO service_role;

--
-- Name: FUNCTION notify_tarefa_comentario(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_tarefa_comentario() FROM PUBLIC;
GRANT ALL ON FUNCTION public.notify_tarefa_comentario() TO service_role;

--
-- Name: FUNCTION receber_pacote_homologacao(p_nome text, p_descricao text, p_itens jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.receber_pacote_homologacao(p_nome text, p_descricao text, p_itens jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.receber_pacote_homologacao(p_nome text, p_descricao text, p_itens jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.receber_pacote_homologacao(p_nome text, p_descricao text, p_itens jsonb) TO service_role;

--
-- Name: FUNCTION registrar_visita_central(p_marcar_visto boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.registrar_visita_central(p_marcar_visto boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.registrar_visita_central(p_marcar_visto boolean) TO authenticated;
GRANT ALL ON FUNCTION public.registrar_visita_central(p_marcar_visto boolean) TO service_role;

--
-- Name: FUNCTION todo_historico_descartar_status_repetido(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.todo_historico_descartar_status_repetido() TO anon;
GRANT ALL ON FUNCTION public.todo_historico_descartar_status_repetido() TO authenticated;
GRANT ALL ON FUNCTION public.todo_historico_descartar_status_repetido() TO service_role;

--
-- Name: FUNCTION todo_numero_do_titulo(p_titulo text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.todo_numero_do_titulo(p_titulo text) TO anon;
GRANT ALL ON FUNCTION public.todo_numero_do_titulo(p_titulo text) TO authenticated;
GRANT ALL ON FUNCTION public.todo_numero_do_titulo(p_titulo text) TO service_role;

--
-- Name: FUNCTION todo_registrar_responsaveis(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.todo_registrar_responsaveis() FROM PUBLIC;
GRANT ALL ON FUNCTION public.todo_registrar_responsaveis() TO service_role;

--
-- Name: FUNCTION todo_registrar_status(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.todo_registrar_status() FROM PUBLIC;
GRANT ALL ON FUNCTION public.todo_registrar_status() TO service_role;

--
-- Name: FUNCTION todo_regra_liberacao(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.todo_regra_liberacao() TO anon;
GRANT ALL ON FUNCTION public.todo_regra_liberacao() TO authenticated;
GRANT ALL ON FUNCTION public.todo_regra_liberacao() TO service_role;

--
-- Name: FUNCTION todo_set_numero_eproject(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.todo_set_numero_eproject() TO anon;
GRANT ALL ON FUNCTION public.todo_set_numero_eproject() TO authenticated;
GRANT ALL ON FUNCTION public.todo_set_numero_eproject() TO service_role;

--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;

--
-- Name: TABLE audit_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.audit_log TO anon;
GRANT ALL ON TABLE public.audit_log TO authenticated;
GRANT ALL ON TABLE public.audit_log TO service_role;

--
-- Name: TABLE aviso_gestor; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.aviso_gestor TO anon;
GRANT ALL ON TABLE public.aviso_gestor TO authenticated;
GRANT ALL ON TABLE public.aviso_gestor TO service_role;

--
-- Name: TABLE aviso_leitura; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.aviso_leitura TO anon;
GRANT ALL ON TABLE public.aviso_leitura TO authenticated;
GRANT ALL ON TABLE public.aviso_leitura TO service_role;

--
-- Name: TABLE colaborador; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.colaborador TO anon;
GRANT ALL ON TABLE public.colaborador TO authenticated;
GRANT ALL ON TABLE public.colaborador TO service_role;

--
-- Name: TABLE colaborador_evento; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.colaborador_evento TO anon;
GRANT ALL ON TABLE public.colaborador_evento TO authenticated;
GRANT ALL ON TABLE public.colaborador_evento TO service_role;

--
-- Name: TABLE colaborador_ferias; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.colaborador_ferias TO anon;
GRANT ALL ON TABLE public.colaborador_ferias TO authenticated;
GRANT ALL ON TABLE public.colaborador_ferias TO service_role;

--
-- Name: TABLE colaborador_galeria; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.colaborador_galeria TO anon;
GRANT ALL ON TABLE public.colaborador_galeria TO authenticated;
GRANT ALL ON TABLE public.colaborador_galeria TO service_role;

--
-- Name: TABLE colaborador_horario; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.colaborador_horario TO anon;
GRANT ALL ON TABLE public.colaborador_horario TO authenticated;
GRANT ALL ON TABLE public.colaborador_horario TO service_role;

--
-- Name: TABLE demanda; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.demanda TO anon;
GRANT ALL ON TABLE public.demanda TO authenticated;
GRANT ALL ON TABLE public.demanda TO service_role;

--
-- Name: TABLE email_digest_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.email_digest_config TO anon;
GRANT ALL ON TABLE public.email_digest_config TO authenticated;
GRANT ALL ON TABLE public.email_digest_config TO service_role;

--
-- Name: TABLE email_send_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.email_send_log TO anon;
GRANT ALL ON TABLE public.email_send_log TO authenticated;
GRANT ALL ON TABLE public.email_send_log TO service_role;

--
-- Name: TABLE google_calendar_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.google_calendar_config TO anon;
GRANT ALL ON TABLE public.google_calendar_config TO authenticated;
GRANT ALL ON TABLE public.google_calendar_config TO service_role;

--
-- Name: TABLE google_calendar_evento; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.google_calendar_evento TO anon;
GRANT ALL ON TABLE public.google_calendar_evento TO authenticated;
GRANT ALL ON TABLE public.google_calendar_evento TO service_role;

--
-- Name: TABLE google_oauth_conta; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.google_oauth_conta TO service_role;

--
-- Name: TABLE ia_prompt_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ia_prompt_config TO anon;
GRANT ALL ON TABLE public.ia_prompt_config TO authenticated;
GRANT ALL ON TABLE public.ia_prompt_config TO service_role;

--
-- Name: TABLE invite_token; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.invite_token TO anon;
GRANT ALL ON TABLE public.invite_token TO authenticated;
GRANT ALL ON TABLE public.invite_token TO service_role;

--
-- Name: TABLE notificacao; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notificacao TO anon;
GRANT ALL ON TABLE public.notificacao TO authenticated;
GRANT ALL ON TABLE public.notificacao TO service_role;

--
-- Name: TABLE notificacao_preferencia; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notificacao_preferencia TO anon;
GRANT ALL ON TABLE public.notificacao_preferencia TO authenticated;
GRANT ALL ON TABLE public.notificacao_preferencia TO service_role;

--
-- Name: TABLE processo_anual; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.processo_anual TO anon;
GRANT ALL ON TABLE public.processo_anual TO authenticated;
GRANT ALL ON TABLE public.processo_anual TO service_role;

--
-- Name: TABLE processo_anual_vinculo; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.processo_anual_vinculo TO anon;
GRANT ALL ON TABLE public.processo_anual_vinculo TO authenticated;
GRANT ALL ON TABLE public.processo_anual_vinculo TO service_role;

--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;

--
-- Name: TABLE relatorio_inativo; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.relatorio_inativo TO anon;
GRANT ALL ON TABLE public.relatorio_inativo TO authenticated;
GRANT ALL ON TABLE public.relatorio_inativo TO service_role;

--
-- Name: TABLE resumo_semanal; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.resumo_semanal TO anon;
GRANT ALL ON TABLE public.resumo_semanal TO authenticated;
GRANT ALL ON TABLE public.resumo_semanal TO service_role;

--
-- Name: TABLE reuniao; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.reuniao TO anon;
GRANT ALL ON TABLE public.reuniao TO authenticated;
GRANT ALL ON TABLE public.reuniao TO service_role;

--
-- Name: TABLE solicitacoes_relatorios; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.solicitacoes_relatorios TO anon;
GRANT ALL ON TABLE public.solicitacoes_relatorios TO authenticated;
GRANT ALL ON TABLE public.solicitacoes_relatorios TO service_role;

--
-- Name: TABLE todo; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.todo TO anon;
GRANT ALL ON TABLE public.todo TO authenticated;
GRANT ALL ON TABLE public.todo TO service_role;

--
-- Name: TABLE todo_anexo; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.todo_anexo TO anon;
GRANT ALL ON TABLE public.todo_anexo TO authenticated;
GRANT ALL ON TABLE public.todo_anexo TO service_role;

--
-- Name: TABLE todo_checklist; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.todo_checklist TO anon;
GRANT ALL ON TABLE public.todo_checklist TO authenticated;
GRANT ALL ON TABLE public.todo_checklist TO service_role;

--
-- Name: TABLE todo_comentario; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.todo_comentario TO anon;
GRANT ALL ON TABLE public.todo_comentario TO authenticated;
GRANT ALL ON TABLE public.todo_comentario TO service_role;

--
-- Name: TABLE todo_historico; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.todo_historico TO anon;
GRANT ALL ON TABLE public.todo_historico TO authenticated;
GRANT ALL ON TABLE public.todo_historico TO service_role;

--
-- Name: TABLE todo_importacao_lote; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.todo_importacao_lote TO anon;
GRANT ALL ON TABLE public.todo_importacao_lote TO authenticated;
GRANT ALL ON TABLE public.todo_importacao_lote TO service_role;

--
-- Name: TABLE unidades_rede; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.unidades_rede TO anon;
GRANT ALL ON TABLE public.unidades_rede TO authenticated;
GRANT ALL ON TABLE public.unidades_rede TO service_role;

--
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_roles TO anon;
GRANT ALL ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;

--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;

--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

--
-- PostgreSQL database dump complete
--

-- ============================================================================
-- Fora do schema public (o pg_dump do public não leva). Gerado do catálogo em 27/10/2026.
-- ============================================================================

-- Extensões usadas pelo app (as demais já vêm no projeto Supabase).
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- Perfil criado junto com o usuário.
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Buckets do Storage.
INSERT INTO storage.buckets (id, name, public) VALUES ('assets', 'assets', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('colaborador-eventos', 'colaborador-eventos', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('colaborador-fotos', 'colaborador-fotos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('reuniao-audios', 'reuniao-audios', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('tarefa-anexos', 'tarefa-anexos', false) ON CONFLICT (id) DO NOTHING;

-- Políticas do Storage.
CREATE POLICY "Autenticado atualiza áudio próprio" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((bucket_id = 'reuniao-audios'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
CREATE POLICY "Autenticado faz upload de áudio" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'reuniao-audios'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
CREATE POLICY "Autor ou gestor remove anexo de tarefa" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'tarefa-anexos'::text) AND (public.has_role(auth.uid(), 'gestor'::public.app_role) OR (EXISTS ( SELECT 1
   FROM public.todo_anexo a
  WHERE ((a.storage_path = objects.name) AND (a.autor_id = auth.uid())))))));
CREATE POLICY "Gestor apaga anexos de eventos" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'colaborador-eventos'::text) AND public.has_role(auth.uid(), 'gestor'::public.app_role)));
CREATE POLICY "Gestor atualiza anexos de eventos" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((bucket_id = 'colaborador-eventos'::text) AND public.has_role(auth.uid(), 'gestor'::public.app_role)));
CREATE POLICY "Gestor atualiza foto colaborador" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((bucket_id = 'colaborador-fotos'::text) AND public.has_role(auth.uid(), 'gestor'::public.app_role)));
CREATE POLICY "Gestor deleta foto colaborador" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'colaborador-fotos'::text) AND public.has_role(auth.uid(), 'gestor'::public.app_role)));
CREATE POLICY "Gestor deleta áudios" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'reuniao-audios'::text) AND public.has_role(auth.uid(), 'gestor'::public.app_role)));
CREATE POLICY "Gestor envia anexos de eventos" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'colaborador-eventos'::text) AND public.has_role(auth.uid(), 'gestor'::public.app_role)));
CREATE POLICY "Gestor faz upload de foto colaborador" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'colaborador-fotos'::text) AND public.has_role(auth.uid(), 'gestor'::public.app_role)));
CREATE POLICY "Gestor lê anexos de eventos" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'colaborador-eventos'::text) AND public.has_role(auth.uid(), 'gestor'::public.app_role)));
CREATE POLICY "Participante faz upload em tarefa-anexos" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'tarefa-anexos'::text) AND (EXISTS ( SELECT 1
   FROM public.todo t
  WHERE (((t.id)::text = (storage.foldername(objects.name))[1]) AND (public.has_role(auth.uid(), 'gestor'::public.app_role) OR (t.criado_por = auth.uid()) OR (t.responsavel_id = auth.uid()) OR (auth.uid() = ANY (t.responsaveis_ids)) OR (t.equipe_toda = true)))))));
CREATE POLICY "Participante lê áudios de reunião" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'reuniao-audios'::text) AND (EXISTS ( SELECT 1
   FROM public.reuniao r
  WHERE ((r.audio_path = objects.name) AND (public.has_role(auth.uid(), 'gestor'::public.app_role) OR (r.criado_por = auth.uid()) OR (r.responsavel_id = auth.uid()) OR (auth.uid() = ANY (r.responsaveis_ids)) OR (r.equipe_toda = true)))))));
CREATE POLICY "Participante vê anexos de tarefa" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'tarefa-anexos'::text) AND (public.has_role(auth.uid(), 'gestor'::public.app_role) OR (EXISTS ( SELECT 1
   FROM public.todo t
  WHERE (((t.id)::text = (storage.foldername(objects.name))[1]) AND ((t.criado_por = auth.uid()) OR (t.responsavel_id = auth.uid()) OR (auth.uid() = ANY (t.responsaveis_ids)) OR (t.equipe_toda = true))))))));
CREATE POLICY "Usuário atualiza próprio avatar" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((bucket_id = 'avatars'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
CREATE POLICY "Usuário envia próprio avatar" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'avatars'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
CREATE POLICY "Usuário remove próprio avatar" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'avatars'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

-- Realtime.
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacao;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reuniao;
ALTER PUBLICATION supabase_realtime ADD TABLE public.todo;

-- Rotinas agendadas. As que chamam funções leem o segredo CRON_SECRET do Vault, que precisa
-- ser criado à mão num ambiente novo (o valor não fica no repositório). As URLs apontam
-- para produção: num ambiente de teste, ajuste antes de ativar.
SELECT cron.schedule('dispatch-email-imediato', '*/5 * * * *', $cron$
  SELECT net.http_post(
    url := 'https://toatihyfgqnrxwgotwrn.supabase.co/functions/v1/dispatch-email-digest',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)),
    body := '{"mode": "imediato"}'::jsonb);
$cron$);
SELECT cron.schedule('gerar-avisos-processos-proximos', '0 10 * * *', $cron$SELECT public.gerar_avisos_processos_proximos();$cron$);
SELECT cron.schedule('gerar-notificacoes-prazo', '*/15 * * * *', $cron$SELECT public.gerar_notificacoes_prazo();$cron$);
SELECT cron.schedule('gerar-resumo-semanal', '0 10 * * 1', $cron$
  SELECT net.http_post(
    url := 'https://toatihyfgqnrxwgotwrn.supabase.co/functions/v1/gerar-resumo-semanal',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)),
    body := '{}'::jsonb);
$cron$);
SELECT cron.schedule('limpar-audios-reuniao', '0 6 * * *', $cron$
  SELECT net.http_post(
    url := 'https://toatihyfgqnrxwgotwrn.supabase.co/functions/v1/limpar-audios-reuniao',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)),
    body := '{}'::jsonb);
  $cron$);
SELECT cron.schedule('limpar-historico-rotinas', '30 3 * * *', $cron$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '14 days'$cron$);
SELECT cron.schedule('marcar-transcricoes-travadas', '*/10 * * * *', $cron$SELECT public.marcar_transcricoes_travadas();$cron$);
SELECT cron.schedule('notify-processo-proximo-diario', '0 10 * * *', $cron$SELECT public.notify_processo_proximo();$cron$);
SELECT cron.schedule('resumo-diario-10h-brt', '0 13 * * *', $cron$
  SELECT net.http_post(
    url := 'https://toatihyfgqnrxwgotwrn.supabase.co/functions/v1/dispatch-email-digest',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)),
    body := '{"mode": "resumo_diario"}'::jsonb);
$cron$);
SELECT cron.schedule('retomar-transcricoes', '*/5 * * * *', $cron$
  SELECT net.http_post(
    url := 'https://toatihyfgqnrxwgotwrn.supabase.co/functions/v1/transcrever-reuniao',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)),
    body := jsonb_build_object('reuniao_id', r.id, 'audio_path', r.audio_path, 'retomar', true))
  FROM (
    SELECT id, audio_path FROM public.reuniao
     WHERE transcricao_status IN ('processando', 'pausado')
       AND updated_at < now() - interval '10 minutes'
       AND audio_path IS NOT NULL
     ORDER BY updated_at
     LIMIT 5
  ) r;
$cron$);
SELECT cron.schedule('sync-google-agenda-15min', '*/15 * * * *', $cron$
  select net.http_post(
    url := 'https://nexus.nickvarela127.workers.dev/api/public/hooks/sync-google-calendar',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'CRON_SECRET' limit 1)),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000);
  $cron$);
