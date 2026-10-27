-- Remove a regra de encerrar tarefas com mais de 5 meses (decisão do Nickolas em 14/10/2026,
-- opção A). Herdada da Lovable, nunca funcionou: a tela chamava a função sem ter permissão.
-- No fluxo atual, a tarefa termina em Produção, depois das três confirmações da Liberação em
-- produção; encerrar sozinha uma tarefa Aprovada ou em Homologação esconderia trabalho.
DROP FUNCTION IF EXISTS public.auto_encerrar_tarefas_antigas();
