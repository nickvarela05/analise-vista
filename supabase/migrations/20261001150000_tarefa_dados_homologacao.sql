-- Dados do e-mail de homologação que antes se perdiam na importação (01/10/2026).
-- O e-mail "Segue as tarefas disponíveis para testes em homologação" traz, por tarefa:
-- Sistema, Observação, Link do ambiente e Data de hml. A importação passa a guardá-los.
-- Colunas opcionais: tarefas antigas ficam com NULL e nada muda para elas.
ALTER TABLE public.todo
  ADD COLUMN IF NOT EXISTS sistema text,
  ADD COLUMN IF NOT EXISTS link_homologacao text,
  ADD COLUMN IF NOT EXISTS observacao_homologacao text,
  ADD COLUMN IF NOT EXISTS data_homologacao date;

COMMENT ON COLUMN public.todo.sistema IS 'Sistema da tarefa no e-mail de homologação (GED, Maed, App - Aluno...).';
COMMENT ON COLUMN public.todo.link_homologacao IS 'Endereço do ambiente de homologação informado no e-mail.';
COMMENT ON COLUMN public.todo.observacao_homologacao IS 'Observação do desenvolvimento no e-mail de homologação.';
COMMENT ON COLUMN public.todo.data_homologacao IS 'Data em que a tarefa ficou disponível para teste (coluna "Data de hml" do e-mail).';
