-- get_tarefa_counts mais rápido (23/10/2026, autorizado pelo Nickolas): parte das tabelas de
-- comentários, checklist e anexos em vez de percorrer as ~8.900 tarefas. Mesmo resultado
-- (comparado linha a linha antes de aplicar); de ~92 ms para ~0,5 ms. Assinatura e permissões iguais.
create or replace function public.get_tarefa_counts()
returns table(todo_id uuid, comentarios bigint, checklist_total bigint, checklist_done bigint, anexos bigint)
language sql
stable
set search_path to 'public'
as $$
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
