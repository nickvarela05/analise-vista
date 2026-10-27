
-- =========================================================
-- FASE 1: ROBUSTEZ E SEGURANÇA
-- =========================================================

-- 1) AUDIT LOG
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name  text NOT NULL,
  record_id   uuid NOT NULL,
  operation   text NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  changed_by  uuid,
  changed_at  timestamptz NOT NULL DEFAULT now(),
  old_data    jsonb,
  new_data    jsonb,
  changed_fields text[]
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON public.audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at   ON public.audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by   ON public.audit_log(changed_by);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gestor vê auditoria" ON public.audit_log;
CREATE POLICY "Gestor vê auditoria"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'::app_role));

-- Sem políticas de INSERT/UPDATE/DELETE: somente o trigger SECURITY DEFINER grava.

-- 2) FUNÇÃO GENÉRICA DE AUDITORIA
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_changed text[];
  v_record_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_new := NULL;
    v_record_id := OLD.id;
  ELSIF TG_OP = 'INSERT' THEN
    v_old := NULL;
    v_new := to_jsonb(NEW);
    v_record_id := NEW.id;
  ELSE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_record_id := NEW.id;
    SELECT array_agg(key)
      INTO v_changed
      FROM jsonb_each(v_new)
     WHERE v_new -> key IS DISTINCT FROM v_old -> key
       AND key NOT IN ('updated_at');
    IF v_changed IS NULL OR array_length(v_changed,1) = 0 THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.audit_log (table_name, record_id, operation, changed_by, old_data, new_data, changed_fields)
  VALUES (TG_TABLE_NAME, v_record_id, TG_OP, auth.uid(), v_old, v_new, v_changed);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- 3) ANEXAR TRIGGERS DE AUDITORIA
-- ---------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'demanda','reuniao','chamado_externo','colaborador',
    'user_roles','invite_token','aviso_gestor','colaborador_ferias'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER audit_%I
         AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.log_audit_event()', t, t);
  END LOOP;
END$$;

-- 4) TRIGGERS updated_at PADRONIZADOS
-- ---------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'aviso_gestor','chamado_externo','colaborador','colaborador_evento',
    'colaborador_ferias','colaborador_galeria','colaborador_horario',
    'demanda','invite_token','profiles','reuniao','todo','todo_checklist'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER set_updated_at_%I
         BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t, t);
  END LOOP;
END$$;

-- 5) RESTRINGIR UPDATE EM chamado_externo
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "Autenticado atualiza chamado externo" ON public.chamado_externo;

CREATE POLICY "Envolvido ou gestor atualiza chamado externo"
  ON public.chamado_externo FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'gestor'::app_role)
    OR auth.uid() = responsavel_id
    OR auth.uid() = ANY(responsaveis_ids)
    OR equipe_toda = true
  );
