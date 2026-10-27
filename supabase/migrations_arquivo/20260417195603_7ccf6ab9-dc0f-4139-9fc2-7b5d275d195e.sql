-- MODO DEV: liberar leitura anônima nas tabelas operacionais.
-- ATENÇÃO: reverter antes de produção (DROP POLICY ... "Dev anon read ...").

CREATE POLICY "Dev anon read demanda" ON public.demanda
  FOR SELECT TO anon USING (true);

CREATE POLICY "Dev anon read todo" ON public.todo
  FOR SELECT TO anon USING (true);

CREATE POLICY "Dev anon read reuniao" ON public.reuniao
  FOR SELECT TO anon USING (true);

CREATE POLICY "Dev anon read aviso_gestor" ON public.aviso_gestor
  FOR SELECT TO anon USING (true);

CREATE POLICY "Dev anon read colaborador" ON public.colaborador
  FOR SELECT TO anon USING (true);

CREATE POLICY "Dev anon read profiles" ON public.profiles
  FOR SELECT TO anon USING (true);
