ALTER TABLE public.aviso_gestor ADD COLUMN IF NOT EXISTS processo_id uuid REFERENCES public.processo_anual(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS aviso_gestor_processo_id_key ON public.aviso_gestor(processo_id) WHERE processo_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.gerar_avisos_processos_proximos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_dias INT;
  v_tipo aviso_tipo;
  v_titulo TEXT;
  v_msg TEXT;
  v_dest UUID[];
  v_count INT := 0;
BEGIN
  -- Desativa avisos de processos que já iniciaram, foram concluídos ou saíram da janela
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

    v_msg := 'Início previsto em ' || to_char(r.previsto_inicio, 'DD/MM/YYYY')
      || COALESCE(' · término previsto ' || to_char(r.previsto_fim, 'DD/MM/YYYY'), '')
      || COALESCE(' — ' || NULLIF(btrim(r.descricao), ''), '');

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
$$;

SELECT cron.unschedule('gerar-avisos-processos-proximos')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gerar-avisos-processos-proximos');

SELECT cron.schedule('gerar-avisos-processos-proximos', '0 10 * * *', $$ SELECT public.gerar_avisos_processos_proximos(); $$);
