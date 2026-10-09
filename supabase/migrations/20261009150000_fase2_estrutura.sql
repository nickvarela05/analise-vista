-- Fase 2 do layout, parte 1: estrutura (09/10/2026). Não muda nada no sistema em uso.
--
-- "O que mudou desde a sua última visita" na Central. A visita fica no banco, e não no
-- navegador, porque o Nickolas troca de máquina.
--
-- Duas marcas por pessoa: a visita atual e a anterior. A Central mostra o que mudou desde a
-- anterior. Enquanto a pessoa usa o Nexus (intervalos de até 30 min entre aberturas da Central),
-- só a atual anda, então recarregar a página não apaga a lista. Passados 30 min sem abrir, a
-- atual vira a anterior.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS central_visita_anterior timestamptz,
  ADD COLUMN IF NOT EXISTS central_visita_atual timestamptz;

-- Registra a abertura da Central e devolve desde quando mostrar as mudanças (nulo na primeira).
-- p_marcar_visto: "Marcar como visto" — a lista recomeça de agora.
CREATE OR REPLACE FUNCTION public.registrar_visita_central(p_marcar_visto boolean DEFAULT false)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_atual timestamptz;
  v_anterior timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT central_visita_atual, central_visita_anterior INTO v_atual, v_anterior
    FROM public.profiles WHERE user_id = v_uid;

  IF p_marcar_visto OR v_atual IS NULL THEN
    UPDATE public.profiles SET central_visita_anterior = now(), central_visita_atual = now()
     WHERE user_id = v_uid;
    RETURN CASE WHEN p_marcar_visto THEN now() END;
  END IF;

  IF now() - v_atual > interval '30 minutes' THEN
    v_anterior := v_atual;
  END IF;
  UPDATE public.profiles SET central_visita_anterior = v_anterior, central_visita_atual = now()
   WHERE user_id = v_uid;
  RETURN v_anterior;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_visita_central(boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.registrar_visita_central(boolean) TO authenticated;
