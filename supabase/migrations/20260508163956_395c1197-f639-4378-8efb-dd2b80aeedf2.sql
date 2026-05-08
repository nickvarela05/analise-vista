
CREATE OR REPLACE FUNCTION public.executar_busca_natural(_sql TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_norm TEXT;
BEGIN
  v_norm := lower(trim(_sql));
  IF v_norm NOT LIKE 'select %' THEN
    RAISE EXCEPTION 'Apenas SELECT é permitido';
  END IF;
  IF v_norm ~ '\b(insert|update|delete|drop|alter|truncate|grant|revoke|create|do|call|comment|set\s+role|listen|notify)\b' THEN
    RAISE EXCEPTION 'Comando proibido detectado';
  END IF;
  IF position(';' in _sql) > 0 THEN
    RAISE EXCEPTION 'Múltiplas queries não são permitidas';
  END IF;

  EXECUTE format('SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (%s) t', _sql)
    INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.executar_busca_natural(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.executar_busca_natural(TEXT) TO authenticated;
