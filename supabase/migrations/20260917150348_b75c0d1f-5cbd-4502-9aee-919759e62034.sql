alter table public.todo replica identity full;
alter publication supabase_realtime add table public.todo;