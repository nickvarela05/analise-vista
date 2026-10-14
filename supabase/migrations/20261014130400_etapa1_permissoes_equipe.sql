-- Etapa 1 (14/10/2026, autorizado pelo Nickolas): papéis reais.
-- Felipe, Matheus, Hugo e Pietro passam a analista. Regra combinada:
--   equipe toda (quem tem papel) faz o dia a dia — tarefas, testes, distribuição,
--   reuniões, demandas, processos, unidades, chamados — e vê o nome de todos;
--   só gestor administra (usuários, convites, colaboradores, avisos, configurações,
--   auditoria) e exclui registros de outras pessoas.

create or replace function public.is_equipe(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id);
$$;
revoke execute on function public.is_equipe(uuid) from public, anon;
grant execute on function public.is_equipe(uuid) to authenticated;

-- Tarefas: qualquer membro move/edita; excluir segue criador ou gestor.
drop policy if exists "Update tarefa por gestor, criador ou responsavel" on public.todo;
create policy "Equipe atualiza tarefas" on public.todo
  for update to authenticated
  using (public.is_equipe(auth.uid()))
  with check (public.is_equipe(auth.uid()));

drop policy if exists "Envolvido cria checklist" on public.todo_checklist;
drop policy if exists "Envolvido atualiza checklist" on public.todo_checklist;
drop policy if exists "Envolvido remove checklist" on public.todo_checklist;
create policy "Equipe cria checklist" on public.todo_checklist
  for insert to authenticated with check (public.is_equipe(auth.uid()));
create policy "Equipe atualiza checklist" on public.todo_checklist
  for update to authenticated using (public.is_equipe(auth.uid()));
create policy "Equipe remove checklist" on public.todo_checklist
  for delete to authenticated using (public.is_equipe(auth.uid()));

drop policy if exists "Envolvido cria histórico" on public.todo_historico;
create policy "Equipe cria histórico" on public.todo_historico
  for insert to authenticated with check (public.is_equipe(auth.uid()));

-- Demandas e reuniões: edição pela equipe; excluir segue só gestor.
drop policy if exists "Atualiza demanda própria ou gestor" on public.demanda;
create policy "Equipe atualiza demandas" on public.demanda
  for update to authenticated using (public.is_equipe(auth.uid()));

drop policy if exists "Atualiza reunião própria ou gestor" on public.reuniao;
create policy "Equipe atualiza reuniões" on public.reuniao
  for update to authenticated using (public.is_equipe(auth.uid()));

-- Chamados externos (relatórios): atualização pela equipe; excluir segue só gestor.
drop policy if exists "Envolvido ou gestor atualiza chamado externo" on public.chamado_externo;
create policy "Equipe atualiza chamado externo" on public.chamado_externo
  for update to authenticated using (public.is_equipe(auth.uid()));

-- Processos anuais: criar/editar pela equipe; excluir processo só gestor.
drop policy if exists "processo_anual_insert_gestor" on public.processo_anual;
drop policy if exists "processo_anual_update_gestor" on public.processo_anual;
create policy "processo_anual_insert_equipe" on public.processo_anual
  for insert to authenticated with check (public.is_equipe(auth.uid()));
create policy "processo_anual_update_equipe" on public.processo_anual
  for update to authenticated
  using (public.is_equipe(auth.uid()))
  with check (public.is_equipe(auth.uid()));

-- Vínculos processo↔tarefa/demanda: a edição do processo apaga e recria os vínculos.
drop policy if exists "processo_vinculo_write_gestor" on public.processo_anual_vinculo;
create policy "processo_vinculo_write_equipe" on public.processo_anual_vinculo
  for all to authenticated
  using (public.is_equipe(auth.uid()))
  with check (public.is_equipe(auth.uid()));

-- Unidades: criar/editar pela equipe; excluir só gestor.
drop policy if exists "Gestor gerencia unidades" on public.unidades_rede;
create policy "Equipe cria unidades" on public.unidades_rede
  for insert to authenticated with check (public.is_equipe(auth.uid()));
create policy "Equipe atualiza unidades" on public.unidades_rede
  for update to authenticated
  using (public.is_equipe(auth.uid()))
  with check (public.is_equipe(auth.uid()));
create policy "Gestor exclui unidades" on public.unidades_rede
  for delete to authenticated using (public.has_role(auth.uid(), 'gestor'::app_role));

-- Perfis: a equipe vê o nome de todos (edição continua: o próprio ou gestor).
drop policy if exists "Usuário vê seu próprio profile" on public.profiles;
create policy "Equipe vê perfis" on public.profiles
  for select to authenticated
  using ((auth.uid() = user_id) or public.is_equipe(auth.uid()));
