-- Fase C do plano de limpeza (autorizada pelo Nickolas em 26/10/2026): desempenho do banco,
-- sem mudar quem pode o quê. Conferido com uma "foto" de leitura e escrita por perfil (gestor,
-- analista, analista sem colaborador e usuário sem papel) antes e depois.

-- C1: auth.uid() dentro de (select ...) é calculado uma vez por consulta, não uma vez por linha.
ALTER POLICY "Gestor vê auditoria" ON public.audit_log USING (has_role((select auth.uid()), 'gestor'::app_role));
ALTER POLICY "Usuário marca como lida" ON public.aviso_leitura WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Usuário remove sua leitura" ON public.aviso_leitura USING (((select auth.uid()) = user_id));
ALTER POLICY "Usuário vê suas leituras" ON public.aviso_leitura USING ((((select auth.uid()) = user_id) OR has_role((select auth.uid()), 'gestor'::app_role)));
ALTER POLICY "Autenticado cria demanda" ON public.demanda WITH CHECK ((((select auth.uid()) = criado_por) OR has_role((select auth.uid()), 'gestor'::app_role)));
ALTER POLICY "Equipe atualiza demandas" ON public.demanda USING (is_equipe((select auth.uid())));
ALTER POLICY "Gestor deleta demanda" ON public.demanda USING (has_role((select auth.uid()), 'gestor'::app_role));
ALTER POLICY digest_config_write_gestor ON public.email_digest_config USING (has_role((select auth.uid()), 'gestor'::app_role)) WITH CHECK (has_role((select auth.uid()), 'gestor'::app_role));
ALTER POLICY "Gestor apaga email_send_log" ON public.email_send_log USING (has_role((select auth.uid()), 'gestor'::app_role));
ALTER POLICY "Gestor atualiza email_send_log" ON public.email_send_log USING (has_role((select auth.uid()), 'gestor'::app_role)) WITH CHECK (has_role((select auth.uid()), 'gestor'::app_role));
ALTER POLICY "Gestor insere email_send_log" ON public.email_send_log WITH CHECK (has_role((select auth.uid()), 'gestor'::app_role));
ALTER POLICY "Gestor lê email_send_log" ON public.email_send_log USING (has_role((select auth.uid()), 'gestor'::app_role));
ALTER POLICY "Gestor gerencia config google calendar" ON public.google_calendar_config USING (has_role((select auth.uid()), 'gestor'::app_role)) WITH CHECK (has_role((select auth.uid()), 'gestor'::app_role));
ALTER POLICY "Gestor gerencia prompts de IA" ON public.ia_prompt_config USING (has_role((select auth.uid()), 'gestor'::app_role)) WITH CHECK (has_role((select auth.uid()), 'gestor'::app_role));
ALTER POLICY "Gestor gerencia convites" ON public.invite_token USING (has_role((select auth.uid()), 'gestor'::app_role)) WITH CHECK (has_role((select auth.uid()), 'gestor'::app_role));
ALTER POLICY "Gestor deleta notificações" ON public.notificacao USING ((has_role((select auth.uid()), 'gestor'::app_role) OR ((select auth.uid()) = user_id)));
ALTER POLICY "Usuário atualiza suas notificações" ON public.notificacao USING (((select auth.uid()) = user_id));
ALTER POLICY "Usuário vê suas notificações" ON public.notificacao USING ((((select auth.uid()) = user_id) OR has_role((select auth.uid()), 'gestor'::app_role)));
ALTER POLICY "Usuário gerencia suas preferências" ON public.notificacao_preferencia USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY processo_anual_delete_gestor ON public.processo_anual USING (has_role((select auth.uid()), 'gestor'::app_role));
ALTER POLICY processo_anual_insert_equipe ON public.processo_anual WITH CHECK (is_equipe((select auth.uid())));
ALTER POLICY processo_anual_update_equipe ON public.processo_anual USING (is_equipe((select auth.uid()))) WITH CHECK (is_equipe((select auth.uid())));
ALTER POLICY "Equipe vê perfis" ON public.profiles USING ((((select auth.uid()) = user_id) OR is_equipe((select auth.uid()))));
ALTER POLICY "Usuário insere seu próprio profile" ON public.profiles WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Autenticado inativa" ON public.relatorio_inativo WITH CHECK (((select auth.uid()) IS NOT NULL));
ALTER POLICY "Autor ou gestor reativa" ON public.relatorio_inativo USING ((((select auth.uid()) = inativado_por) OR has_role((select auth.uid()), 'gestor'::app_role)));
ALTER POLICY "Usuário lê seu resumo" ON public.resumo_semanal USING ((((select auth.uid()) = user_id) OR has_role((select auth.uid()), 'gestor'::app_role)));
ALTER POLICY "Autenticado cria reunião" ON public.reuniao WITH CHECK (((select auth.uid()) = criado_por));
ALTER POLICY "Equipe atualiza reuniões" ON public.reuniao USING (is_equipe((select auth.uid())));
ALTER POLICY "Gestor deleta reunião" ON public.reuniao USING (has_role((select auth.uid()), 'gestor'::app_role));
ALTER POLICY "Autenticado cria tarefa" ON public.todo WITH CHECK (((select auth.uid()) = criado_por));
ALTER POLICY "Deleta tarefa própria ou gestor" ON public.todo USING ((has_role((select auth.uid()), 'gestor'::app_role) OR ((select auth.uid()) = criado_por)));
ALTER POLICY "Equipe atualiza tarefas" ON public.todo USING (is_equipe((select auth.uid()))) WITH CHECK (is_equipe((select auth.uid())));
ALTER POLICY "Autenticado cria anexo" ON public.todo_anexo WITH CHECK ((((select auth.uid()) IS NOT NULL) AND ((select auth.uid()) = autor_id)));
ALTER POLICY "Autor ou gestor remove anexo" ON public.todo_anexo USING ((((select auth.uid()) = autor_id) OR has_role((select auth.uid()), 'gestor'::app_role)));
ALTER POLICY "Equipe atualiza checklist" ON public.todo_checklist USING (is_equipe((select auth.uid())));
ALTER POLICY "Equipe cria checklist" ON public.todo_checklist WITH CHECK (is_equipe((select auth.uid())));
ALTER POLICY "Equipe remove checklist" ON public.todo_checklist USING (is_equipe((select auth.uid())));
ALTER POLICY "Autenticado cria comentário" ON public.todo_comentario WITH CHECK (((select auth.uid()) = autor_id));
ALTER POLICY "Autor ou gestor remove comentário" ON public.todo_comentario USING ((((select auth.uid()) = autor_id) OR has_role((select auth.uid()), 'gestor'::app_role)));
ALTER POLICY "Equipe cria histórico" ON public.todo_historico WITH CHECK (is_equipe((select auth.uid())));
ALTER POLICY "Autenticado cria lote de importação" ON public.todo_importacao_lote WITH CHECK (((select auth.uid()) = criado_por));
ALTER POLICY "Criador ou gestor atualiza lote" ON public.todo_importacao_lote USING ((has_role((select auth.uid()), 'gestor'::app_role) OR ((select auth.uid()) = criado_por)));
ALTER POLICY "Criador ou gestor deleta lote" ON public.todo_importacao_lote USING ((has_role((select auth.uid()), 'gestor'::app_role) OR ((select auth.uid()) = criado_por)));
ALTER POLICY "Equipe atualiza unidades" ON public.unidades_rede USING (is_equipe((select auth.uid()))) WITH CHECK (is_equipe((select auth.uid())));
ALTER POLICY "Equipe cria unidades" ON public.unidades_rede WITH CHECK (is_equipe((select auth.uid())));
ALTER POLICY "Gestor exclui unidades" ON public.unidades_rede USING (has_role((select auth.uid()), 'gestor'::app_role));
ALTER POLICY "Usuário vê suas roles" ON public.user_roles USING ((((select auth.uid()) = user_id) OR has_role((select auth.uid()), 'gestor'::app_role)));

-- C2: regras sobrepostas. Uma regra "FOR ALL" de escrita somava-se à regra de leitura, e o
-- Postgres avaliava as duas em toda leitura. A leitura já é coberta pela outra regra (que vale
-- para todos, inclusive o gestor), então a de escrita vira INSERT/UPDATE/DELETE.
DO $$
DECLARE
  -- tabela, regra "FOR ALL" antiga, prefixo do nome novo, condição
  r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('aviso_gestor', 'Gestor gerencia avisos', 'Gestor', 'avisos', 'has_role((select auth.uid()), ''gestor''::app_role)'),
    ('colaborador', 'Gestor gerencia colaboradores', 'Gestor', 'colaboradores', 'has_role((select auth.uid()), ''gestor''::app_role)'),
    ('colaborador_evento', 'Gestor gerencia eventos', 'Gestor', 'eventos', 'has_role((select auth.uid()), ''gestor''::app_role)'),
    ('colaborador_ferias', 'Gestor gerencia ferias', 'Gestor', 'ferias', 'has_role((select auth.uid()), ''gestor''::app_role)'),
    ('colaborador_galeria', 'Gestor gerencia galeria', 'Gestor', 'galeria', 'has_role((select auth.uid()), ''gestor''::app_role)'),
    ('colaborador_horario', 'Gestor gerencia horarios', 'Gestor', 'horarios', 'has_role((select auth.uid()), ''gestor''::app_role)'),
    ('user_roles', 'Gestor gerencia roles', 'Gestor', 'roles', 'has_role((select auth.uid()), ''gestor''::app_role)'),
    ('processo_anual_vinculo', 'processo_vinculo_write_equipe', 'Equipe', 'vínculos de processo', 'is_equipe((select auth.uid()))')
  ) AS v(tabela, antiga, quem, oque, cond) LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.antiga, r.tabela);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)', r.quem || ' cria ' || r.oque, r.tabela, r.cond);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', r.quem || ' atualiza ' || r.oque, r.tabela, r.cond, r.cond);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (%s)', r.quem || ' apaga ' || r.oque, r.tabela, r.cond);
  END LOOP;
END $$;

-- Leitura repetida: a regra "FOR ALL" do gestor já cobre a leitura com a mesma condição.
DROP POLICY digest_config_select_gestor ON public.email_digest_config;
DROP POLICY "Gestor lê prompts de IA" ON public.ia_prompt_config;

-- Perfis: duas regras de atualização viram uma (a própria pessoa ou o gestor).
DROP POLICY "Gestor pode atualizar profiles" ON public.profiles;
DROP POLICY "Usuário atualiza seu próprio profile" ON public.profiles;
CREATE POLICY "Usuário ou gestor atualiza profile" ON public.profiles FOR UPDATE TO authenticated
  USING ((((select auth.uid()) = user_id) OR has_role((select auth.uid()), 'gestor'::app_role)));

-- C3: índices duplicados (fica o *_todo_id) e índices nas chaves estrangeiras das tabelas que crescem.
DROP INDEX IF EXISTS public.idx_todo_anexo_todo;
DROP INDEX IF EXISTS public.idx_todo_checklist_todo;
DROP INDEX IF EXISTS public.idx_todo_comentario_todo;

CREATE INDEX IF NOT EXISTS idx_todo_demanda_id ON public.todo (demanda_id);
CREATE INDEX IF NOT EXISTS idx_todo_criado_por ON public.todo (criado_por);
CREATE INDEX IF NOT EXISTS idx_demanda_criado_por ON public.demanda (criado_por);
CREATE INDEX IF NOT EXISTS idx_reuniao_criado_por ON public.reuniao (criado_por);
CREATE INDEX IF NOT EXISTS idx_aviso_gestor_colaborador_id ON public.aviso_gestor (colaborador_id);
CREATE INDEX IF NOT EXISTS idx_aviso_gestor_criado_por ON public.aviso_gestor (criado_por);

-- C4: os índices "nunca usados" ficam. Com o volume atual, o Postgres prefere ler a tabela
-- inteira; eles passam a valer quando as tabelas crescerem. Os das tabelas apagadas já saíram.
