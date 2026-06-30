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
