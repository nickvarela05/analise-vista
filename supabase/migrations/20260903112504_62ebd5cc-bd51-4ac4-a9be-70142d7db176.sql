REVOKE EXECUTE ON FUNCTION public.gerar_avisos_processos_proximos() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gerar_avisos_processos_proximos() TO service_role;