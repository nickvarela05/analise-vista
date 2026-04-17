
-- Remove a policy ampla anterior
DROP POLICY IF EXISTS "Fotos de colaborador são públicas" ON storage.objects;

-- Recria limitando a leitura aos arquivos do bucket (sem permitir listagem do diretório raiz)
CREATE POLICY "Leitura pública de arquivos colaborador"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'colaborador-fotos'
  AND (storage.foldername(name))[1] IS NOT NULL
);
