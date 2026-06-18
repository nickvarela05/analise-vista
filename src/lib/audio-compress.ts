// Compressor de áudio client-side via ffmpeg.wasm (single-thread, sem COOP/COEP).
// Extrai a faixa de áudio (descartando vídeo em MP4) e reencoda para Opus 24kbps mono 16kHz,
// resultando em arquivos pequenos (~10MB/hora) compatíveis com o limite de 25MB do Groq Whisper.

// Limiar acima do qual vale a pena comprimir (arquivos menores sobem direto).
export const COMPRESSION_THRESHOLD_BYTES = 20 * 1024 * 1024; // 20 MB

// Versão do core single-thread (não exige SharedArrayBuffer / COOP-COEP).
const CORE_VERSION = "0.12.6";
const CORE_BASE = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;

type FFmpegInstance = import("@ffmpeg/ffmpeg").FFmpeg;
let ffmpegSingleton: FFmpegInstance | null = null;
let loadPromise: Promise<FFmpegInstance> | null = null;

async function getFFmpeg(): Promise<FFmpegInstance> {
  if (ffmpegSingleton) return ffmpegSingleton;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { toBlobURL } = await import("@ffmpeg/util");
    const ff = new FFmpeg();
    const [coreURL, wasmURL] = await Promise.all([
      toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
    ]);
    await ff.load({ coreURL, wasmURL });
    ffmpegSingleton = ff;
    return ff;
  })();

  try {
    return await loadPromise;
  } catch (e) {
    loadPromise = null;
    throw e;
  }
}

export function shouldCompress(file: File): boolean {
  const isVideoContainer =
    file.type === "video/mp4" || /\.(mp4|mov|mkv|avi|webm)$/i.test(file.name);
  return isVideoContainer || file.size > COMPRESSION_THRESHOLD_BYTES;
}

export interface CompressOptions {
  onProgress?: (pct: number) => void;
  signal?: AbortSignal;
}

export interface CompressResult {
  file: File;
  originalSize: number;
  compressedSize: number;
}

/**
 * Reencoda o arquivo para Opus 24kbps mono 16kHz em container OGG.
 * Lança erro se ffmpeg.wasm falhar — o chamador deve fazer fallback.
 */
export async function compressAudio(
  input: File,
  { onProgress, signal }: CompressOptions = {},
): Promise<CompressResult> {
  const { fetchFile } = await import("@ffmpeg/util");
  const ff = await getFFmpeg();

  const inputName = `in_${Date.now()}`;
  const outputName = `out_${Date.now()}.ogg`;

  const onProgressEvent = ({ progress }: { progress: number }) => {
    if (onProgress) {
      const pct = Math.max(0, Math.min(99, Math.round(progress * 100)));
      onProgress(pct);
    }
  };
  ff.on("progress", onProgressEvent);

  const onAbort = () => {
    try {
      ff.terminate();
    } catch {
      /* noop */
    }
    ffmpegSingleton = null;
    loadPromise = null;
  };
  signal?.addEventListener("abort", onAbort);

  try {
    await ff.writeFile(inputName, await fetchFile(input));

    if (signal?.aborted) throw new Error("Compressão cancelada");

    const exitCode = await ff.exec([
      "-i", inputName,
      "-vn",                 // descarta vídeo
      "-ac", "1",            // mono
      "-ar", "16000",        // 16 kHz (ideal para voz / Whisper)
      "-c:a", "libopus",
      "-b:a", "24k",
      "-application", "voip",
      outputName,
    ]);

    if (exitCode !== 0) {
      throw new Error("ffmpeg falhou ao processar o áudio");
    }

    const data = await ff.readFile(outputName);
    const uint8 =
      typeof data === "string" ? new TextEncoder().encode(data) : (data as Uint8Array);
    // Cria um ArrayBuffer "limpo" para evitar problemas com SharedArrayBuffer
    const buf = new ArrayBuffer(uint8.byteLength);
    new Uint8Array(buf).set(uint8);
    const blob = new Blob([buf], { type: "audio/ogg" });
    const baseName = input.name.replace(/\.[^.]+$/, "") || "audio";
    const outFile = new File([blob], `${baseName}.ogg`, { type: "audio/ogg" });

    onProgress?.(100);

    // Limpa arquivos do FS virtual
    try { await ff.deleteFile(inputName); } catch { /* noop */ }
    try { await ff.deleteFile(outputName); } catch { /* noop */ }

    return {
      file: outFile,
      originalSize: input.size,
      compressedSize: outFile.size,
    };
  } finally {
    ff.off("progress", onProgressEvent);
    signal?.removeEventListener("abort", onAbort);
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
