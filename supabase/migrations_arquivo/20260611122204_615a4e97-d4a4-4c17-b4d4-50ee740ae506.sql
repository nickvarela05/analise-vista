-- Corrige política de UPDATE da tabela todo para permitir que membros do array
-- responsaveis_ids (múltiplos responsáveis) também possam atualizar a tarefa.
-- Antes: apenas gestor, criador ou responsavel_id (campo único) conseguiam.
-- Sintoma: analista arrastava no kanban, UPDATE atingia 0 linhas (RLS),
-- PostgREST não retornava erro, e ao recarregar o status voltava ao anterior.

DROP POLICY IF EXISTS "Atualiza tarefa própria ou gestor" ON public.todo;

CREATE POLICY "Atualiza tarefa própria ou gestor"
ON public.todo
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'gestor'::app_role)
  OR auth.uid() = criado_por
  OR auth.uid() = responsavel_id
  OR (responsaveis_ids IS NOT NULL AND auth.uid() = ANY (responsaveis_ids))
  OR equipe_toda = true
);