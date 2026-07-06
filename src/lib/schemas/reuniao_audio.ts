/**
 * @module lib/schemas/reuniao_audio
 * @description Schema #11 — validação centralizada de upload de áudio de
 *   reuniões. Consolida as regras de tipo/extensão/tamanho e os metadados
 *   do job de upload em um único ponto de verdade.
 */
import { z } from "zod";
import { MAX_UPLOAD_BYTES } from "@/constants/upload";

/** Extensões de áudio aceitas. */
export const AUDIO_EXTENSIONS = /\.(mp3|m4a|wav|webm|ogg|mp4|aac|flac|oga|opus)$/i;

/** Extensões de contêiner de vídeo cujo áudio aceitamos (ex.: MP4 de reunião). */
export const VIDEO_CONTAINER_EXTENSIONS = /\.(mp4|mov|mkv|avi)$/i;

function isAcceptedAudio(file: File): boolean {
  const isAudioMime = file.type.startsWith("audio/");
  const isMp4Container = file.type === "video/mp4" || VIDEO_CONTAINER_EXTENSIONS.test(file.name);
  const hasAudioExt = AUDIO_EXTENSIONS.test(file.name);
  return isAudioMime || isMp4Container || hasAudioExt;
}

/** Schema para a instância `File` do áudio da reunião. */
export const audioFileSchema = z
  .instanceof(File, { message: "Arquivo inválido" })
  .refine((f) => f.size > 0, { message: "Arquivo vazio" })
  .refine((f) => f.size <= MAX_UPLOAD_BYTES, {
    message: "Arquivo acima de 25 MB. Reduza, comprima ou divida antes de enviar.",
  })
  .refine(isAcceptedAudio, {
    message: "Arquivo não é um áudio válido. Formatos aceitos: MP3, M4A, WAV, WebM, OGG, MP4, AAC, FLAC.",
  });

/** Metadados que acompanham o job de upload. */
export const audioUploadMetaSchema = z.object({
  reuniaoId: z.string().uuid({ message: "reuniaoId inválido" }).nullable(),
  userId: z.string().uuid({ message: "userId inválido" }),
  titulo: z.string().trim().max(200, { message: "Título muito longo (máx. 200)" }).optional(),
});

export type AudioUploadMeta = z.infer<typeof audioUploadMetaSchema>;

export type ParseAudioResult =
  | { ok: true; file: File }
  | { ok: false, error: string };

/** Executa `audioFileSchema.safeParse` e devolve mensagem pronta para toast. */
export function parseAudioFile(file: File): ParseAudioResult {
  const result = audioFileSchema.safeParse(file);
  if (result.success) return { ok: true, file: result.data };
  const first = result.error.issues[0]?.message ?? "Arquivo inválido";
  return { ok: false, error: first };
}
