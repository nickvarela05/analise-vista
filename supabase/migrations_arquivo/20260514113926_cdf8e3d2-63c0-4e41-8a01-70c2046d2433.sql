
-- 1. Remover políticas dev anon (idempotente)
DROP POLICY IF EXISTS "Dev anon read colaborador_evento" ON public.colaborador_evento;
DROP POLICY IF EXISTS "Dev anon read todo_comentario" ON public.todo_comentario;
DROP POLICY IF EXISTS "Dev anon read todo_historico" ON public.todo_historico;
DROP POLICY IF EXISTS "Dev anon read todo_checklist" ON public.todo_checklist;
DROP POLICY IF EXISTS "Dev anon read todo_anexo" ON public.todo_anexo;

-- 2. Profiles: restringir SELECT ao próprio usuário (ou gestor)
DROP POLICY IF EXISTS "Profiles visíveis para autenticados" ON public.profiles;
CREATE POLICY "Usuário vê seu próprio profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'gestor'::app_role));

-- 3. Remover coluna email da tabela colaborador
ALTER TABLE public.colaborador DROP COLUMN IF EXISTS email;

-- 4. Storage: tarefa-anexos upload restrito a participantes da tarefa
DROP POLICY IF EXISTS "Autenticado faz upload em tarefa-anexos" ON storage.objects;
CREATE POLICY "Participante faz upload em tarefa-anexos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'tarefa-anexos'
    AND EXISTS (
      SELECT 1 FROM public.todo t
      WHERE t.id::text = (storage.foldername(name))[1]
        AND (
          public.has_role(auth.uid(), 'gestor'::app_role)
          OR t.criado_por = auth.uid()
          OR t.responsavel_id = auth.uid()
          OR auth.uid() = ANY (t.responsaveis_ids)
          OR t.equipe_toda = true
        )
    )
  );

-- 5. Storage: reuniao-audios SELECT restrito a participantes da reunião
DROP POLICY IF EXISTS "Autenticado lê áudios de reunião" ON storage.objects;
CREATE POLICY "Participante lê áudios de reunião"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'reuniao-audios'
    AND EXISTS (
      SELECT 1 FROM public.reuniao r
      WHERE r.audio_path = name
        AND (
          public.has_role(auth.uid(), 'gestor'::app_role)
          OR r.criado_por = auth.uid()
          OR r.responsavel_id = auth.uid()
          OR auth.uid() = ANY (r.responsaveis_ids)
          OR r.equipe_toda = true
        )
    )
  );

-- 6. Realtime: bloquear broadcast/presence (app só usa postgres_changes que respeita RLS das tabelas)
DROP POLICY IF EXISTS "Block realtime broadcast/presence select" ON realtime.messages;
CREATE POLICY "Block realtime broadcast/presence select"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "Block realtime broadcast/presence insert" ON realtime.messages;
CREATE POLICY "Block realtime broadcast/presence insert"
  ON realtime.messages FOR INSERT
  TO authenticated
  WITH CHECK (false);
