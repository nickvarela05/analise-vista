-- B5 (dados), autorizado pelo Nickolas em 26/10/2026.
-- Log de e-mails: os registros de auditoria eram cópia do próprio log.
DELETE FROM public.audit_log WHERE table_name = 'email_send_log';

-- Reunião: tira dos registros antigos as colunas que deixaram de ser auditadas (a transcrição era
-- a maior parte do espaço). Quem mudou o quê e quando continua no histórico.
UPDATE public.audit_log
   SET old_data = old_data - ARRAY['transcricao','transcricao_status','transcricao_erro','transcricao_partes_feitas','transcricao_partes_total','transcricao_rodadas'],
       new_data = new_data - ARRAY['transcricao','transcricao_status','transcricao_erro','transcricao_partes_feitas','transcricao_partes_total','transcricao_rodadas'],
       changed_fields = ARRAY(SELECT f FROM unnest(changed_fields) f WHERE f NOT LIKE 'transcricao%')
 WHERE table_name = 'reuniao';

-- Registros de reunião que só registravam mudança de transcrição ficaram sem conteúdo.
DELETE FROM public.audit_log
 WHERE table_name = 'reuniao' AND operation = 'UPDATE'
   AND (changed_fields IS NULL OR cardinality(changed_fields) = 0);
