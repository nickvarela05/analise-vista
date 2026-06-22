
DROP TRIGGER IF EXISTS trg_chamado_externo_email ON public.chamado_externo;
CREATE TRIGGER trg_chamado_externo_email
AFTER INSERT ON public.chamado_externo
FOR EACH ROW EXECUTE FUNCTION public.notify_chamado_externo_criado();

DROP TRIGGER IF EXISTS trg_aviso_gestor_notify ON public.aviso_gestor;
CREATE TRIGGER trg_aviso_gestor_notify
AFTER INSERT OR UPDATE ON public.aviso_gestor
FOR EACH ROW EXECUTE FUNCTION public.notify_aviso_critico();

DROP TRIGGER IF EXISTS trg_todo_atribuida ON public.todo;
CREATE TRIGGER trg_todo_atribuida
AFTER INSERT OR UPDATE OF responsavel_id, responsaveis_ids ON public.todo
FOR EACH ROW EXECUTE FUNCTION public.notify_tarefa_atribuida();

DROP TRIGGER IF EXISTS trg_demanda_atribuida ON public.demanda;
CREATE TRIGGER trg_demanda_atribuida
AFTER INSERT OR UPDATE OF responsavel_id, responsaveis_ids ON public.demanda
FOR EACH ROW EXECUTE FUNCTION public.notify_demanda_atribuida();

DROP TRIGGER IF EXISTS trg_notificacao_email_imediato ON public.notificacao;
CREATE TRIGGER trg_notificacao_email_imediato
AFTER INSERT ON public.notificacao
FOR EACH ROW EXECUTE FUNCTION public.enqueue_email_imediato();
