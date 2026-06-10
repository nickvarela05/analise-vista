
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
SECURITY INVOKER
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
