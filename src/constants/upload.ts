/**
 * @module constants/upload
 * @description Limites e mensagens compartilhados pelo pipeline de upload
 *   de áudio de reuniões. Centraliza valores antes espalhados entre o
 *   componente de upload (`UploadAudioReuniao`) e o gerenciador em background
 *   (`reuniao-upload-manager`) para evitar divergências.
 */

/**
 * Tamanho máximo permitido para upload de áudio (bytes).
 * 25 MB — alinhado ao limite do Whisper na pipeline de transcrição.
 */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * Tamanho máximo permitido para upload de imagens (bytes).
 * 5 MB — usado para avatares e galeria de fotos.
 */
export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Tamanho máximo permitido para upload de anexos de eventos (bytes).
 * 10 MB — usado para comprovantes (atestados médicos, etc.) em imagem ou PDF.
 */
export const MAX_ANEXO_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Formata um valor em bytes para leitura humana (KB, MB).
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
