CREATE POLICY "Gestor insere email_send_log" ON public.email_send_log
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Gestor atualiza email_send_log" ON public.email_send_log
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestor'::app_role));