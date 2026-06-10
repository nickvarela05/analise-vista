
-- Índices para acelerar a tela de Tarefas
CREATE INDEX IF NOT EXISTS idx_todo_status_not_encerrada
  ON public.todo (status) WHERE status <> 'encerrada';
CREATE INDEX IF NOT EXISTS idx_todo_created_at_desc
  ON public.todo (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_todo_comentario_todo_id
  ON public.todo_comentario (todo_id);
CREATE INDEX IF NOT EXISTS idx_todo_checklist_todo_id
  ON public.todo_checklist (todo_id);
CREATE INDEX IF NOT EXISTS idx_todo_anexo_todo_id
  ON public.todo_anexo (todo_id);

-- RPC: retorna contagens agregadas (comentários, checklist, anexos) por tarefa
-- em uma única chamada — substitui 3 SELECTs que baixavam todas as linhas.
CREATE OR REPLACE FUNCTION public.get_tarefa_counts()
RETURNS TABLE (
  todo_id uuid,
  comentarios bigint,
  checklist_total bigint,
  checklist_done bigint,
  anexos bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH c AS (
    SELECT todo_id, count(*) AS n FROM public.todo_comentario GROUP BY todo_id
  ),
  k AS (
    SELECT todo_id,
           count(*) AS total,
           count(*) FILTER (WHERE concluido) AS done
      FROM public.todo_checklist GROUP BY todo_id
  ),
  a AS (
    SELECT todo_id, count(*) AS n FROM public.todo_anexo GROUP BY todo_id
  )
  SELECT t.id AS todo_id,
         COALESCE(c.n, 0)     AS comentarios,
         COALESCE(k.total, 0) AS checklist_total,
         COALESCE(k.done, 0)  AS checklist_done,
         COALESCE(a.n, 0)     AS anexos
    FROM public.todo t
    LEFT JOIN c ON c.todo_id = t.id
    LEFT JOIN k ON k.todo_id = t.id
    LEFT JOIN a ON a.todo_id = t.id
   WHERE COALESCE(c.n, 0) + COALESCE(k.total, 0) + COALESCE(a.n, 0) > 0;
$$;

GRANT EXECUTE ON FUNCTION public.get_tarefa_counts() TO authenticated, service_role;

-- Função para encerrar tarefas antigas (>5 meses) — pode ser chamada por job/cron
-- em vez de rodar a cada abertura da tela.
CREATE OR REPLACE FUNCTION public.auto_encerrar_tarefas_antigas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.todo
     SET status = 'encerrada'
   WHERE created_at < now() - INTERVAL '5 months'
     AND status IN (
       'aberta','em_andamento','homologacao','aprovado',
       'aprovado_ressalvas','reprovado','pendente','encaminhada'
     );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_encerrar_tarefas_antigas() TO service_role;
