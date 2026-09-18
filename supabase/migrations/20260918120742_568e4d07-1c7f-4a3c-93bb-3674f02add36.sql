CREATE OR REPLACE FUNCTION public.gerar_avisos_processos_proximos()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      v_tipo := 'critico'::aviso_tipo;
    ELSIF v_dias <= 7 THEN
      v_tipo := 'alerta'::aviso_tipo;
    ELSE
      v_tipo := 'informativo'::aviso_tipo;
    END IF;

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
      || E'\n\n' || CASE
           WHEN v_dias = 0 THEN 'O processo começa hoje. Iniciem as atividades e registrem o andamento na tela de Processos.'
           WHEN v_dias = 1 THEN 'O processo começa amanhã. Deixem materiais, acessos e pendências prontos hoje.'
           WHEN v_dias <= 3 THEN 'Faltam apenas ' || v_dias || ' dias. Priorizem o preparo: revisem pendências e alinhem as entregas com os responsáveis.'
           WHEN v_dias <= 7 THEN 'Falta 1 semana ou menos. Confirmem o planejamento e antecipem possíveis impedimentos.'
           ELSE 'Faltam ' || v_dias || ' dias. Aproveitem para planejar com calma e alinhar expectativas com a equipe.'
         END;

    IF r.equipe_toda THEN
      v_dest := ARRAY[]::UUID[];
    ELSE
      v_dest := COALESCE(r.responsaveis_ids, ARRAY[]::UUID[]);
    END IF;

    INSERT INTO public.aviso_gestor (titulo, mensagem, tipo, ativo, expira_em, processo_id, colaboradores_ids)
    VALUES (v_titulo, v_msg, v_tipo, true,
            (r.previsto_inicio + 1)::timestamptz, r.id, v_dest)
    ON CONFLICT (processo_id) WHERE processo_id IS NOT NULL
    DO UPDATE SET titulo = EXCLUDED.titulo,
                  mensagem = EXCLUDED.mensagem,
                  tipo = EXCLUDED.tipo,
                  ativo = true,
                  expira_em = EXCLUDED.expira_em,
                  colaboradores_ids = EXCLUDED.colaboradores_ids,
                  updated_at = now();
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

SELECT public.gerar_avisos_processos_proximos();