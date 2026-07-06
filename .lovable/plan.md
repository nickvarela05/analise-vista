# Schema #11 — UploadAudioReuniao

Centralizar a validação de arquivo de áudio (tipo, extensão, tamanho) e dos metadados que acompanham o job de upload em um único schema Zod, mantendo o pipeline de upload em segundo plano intacto.

## Escopo

Componente-alvo: `src/components/reunioes/UploadAudioReuniao.tsx`
Validação atual: dois `if` manuais em `handleFile` — checagem de MIME/extensão e de `MAX_UPLOAD_BYTES`.

## Arquivo novo

`src/lib/schemas/reuniao_audio.ts`, exportando:

1. **`audioFileSchema`** — valida a instância `File`:
   - `instanceof(File)`
   - `size > 0` (rejeita arquivo vazio)
   - `size <= MAX_UPLOAD_BYTES` (25 MB, via `refine`)
   - MIME/extensão: aceita se `type` começa com `audio/`, OU é `video/mp4`, OU extensão bate com `AUDIO_EXTENSIONS` / `mp4|mov|mkv|avi`
   - Mensagens em português, alinhadas às toasts atuais

2. **`audioUploadMetaSchema`** — metadados do job:
   - `reuniaoId`: `z.string().uuid().nullable()`
   - `userId`: `z.string().uuid()`
   - `titulo`: `z.string().trim().max(200).optional()` (default `"Reunião"` aplicado no consumidor, como hoje)

3. **`parseAudioFile(file)`** — helper que roda `audioFileSchema.safeParse` e devolve `{ ok: true, file } | { ok: false, error }` com mensagem já pronta para `toast.error`.

Constantes reaproveitadas: `MAX_UPLOAD_BYTES` de `@/constants/upload`, `AUDIO_EXTENSIONS` movido para o schema e re-exportado (o componente passa a importá-lo do schema para eliminar duplicação).

## Mudanças em `UploadAudioReuniao.tsx`

- Importar `parseAudioFile` e `audioUploadMetaSchema`.
- Em `handleFile`: substituir os dois blocos `if (!isAudioMime …)` e `if (rawFile.size > MAX_UPLOAD_BYTES)` por uma única chamada a `parseAudioFile(rawFile)`. Em caso de erro, `toast.error` com a mensagem do schema; sucesso segue o fluxo atual.
- Antes de `startUploadJob(...)`: validar os metadados com `audioUploadMetaSchema.safeParse({ reuniaoId: rid, userId, titulo })` como defesa em profundidade; erro dispara `toast.error` e aborta.
- Remover a constante local `AUDIO_EXTENSIONS` (passa a vir do schema).

## Fora do Zod (permanece como está)

- Fluxo de `onAutoSaveDraft` (rascunho da reunião).
- `startUploadJob` e todo o gerenciador em background (`reuniao-upload-manager`).
- Signed URL, remoção via storage, `triggerProcessing`, reprocessamento.
- Toasts de progresso, UI de drag-and-drop, estados `preparing`/`triggering`/`removing`.
- Constante `ACCEPT` do `<input type="file">`.

## Resultado

- Uma única fonte de verdade para "o que é um áudio válido de reunião".
- `handleFile` mais curto e testável.
- Zero mudança de comportamento para o usuário final.
