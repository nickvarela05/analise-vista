DROP POLICY IF EXISTS "Gestor apaga email_send_log" ON public.email_send_log;
CREATE POLICY "Gestor apaga email_send_log" ON public.email_send_log
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'::app_role));