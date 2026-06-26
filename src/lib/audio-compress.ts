// Compressor de áudio client-side.
// Estratégia: tenta WebCodecs (AudioEncoder nativo, 5-10x mais rápido) primeiro;
// se indisponível ou falhar, cai no ffmpeg.wasm (single-thread, sem COOP/COEP).
// Alvo: arquivo pequeno (~10MB/hora) compatível com limite de 25MB do Groq Whisper.

export const COMPRESSION_THRESHOLD_BYTES = 20 * 1024 * 1024; // 20 MB

// ===== ffmpeg.wasm (fallback) =====
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
  /** Permite forçar o uso do ffmpeg.wasm (debug/teste). */
  forceFfmpeg?: boolean;
}

export interface CompressResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  /** Engine que efetivamente comprimiu o arquivo. */
  engine: "webcodecs" | "ffmpeg";
}

// ============================================================================
// WebCodecs (rápido — Chrome/Edge/Safari 16.4+)
// ============================================================================

function isVideoFile(file: File): boolean {
  return file.type.startsWith("video/") || /\.(mp4|mov|mkv|avi|webm)$/i.test(file.name);
}

/** Detecta se o navegador suporta AudioEncoder + Opus. */
async function webCodecsSupported(): Promise<boolean> {
  if (typeof (globalThis as any).AudioEncoder === "undefined") return false;
  if (typeof (globalThis as any).AudioDecoder === "undefined") return false;
  try {
    const support = await (globalThis as any).AudioEncoder.isConfigSupported({
      codec: "opus",
      sampleRate: 16000,
      numberOfChannels: 1,
      bitrate: 24000,
    });
    return !!support?.supported;
  } catch {
    return false;
  }
}

/** Decodifica via WebAudio (funciona para arquivos de áudio puro: mp3/wav/m4a/ogg/flac). */
async function decodeWithWebAudio(file: File): Promise<AudioBuffer> {
  const arrayBuf = await file.arrayBuffer();
  const Ctx: typeof AudioContext =
    (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;
  // sampleRate alvo 16k — mas alguns navegadores ignoram; resample manual abaixo.
  const ctx = new Ctx({ sampleRate: 48000 });
  try {
    return await ctx.decodeAudioData(arrayBuf);
  } finally {
    try { await ctx.close(); } catch { /* noop */ }
  }
}

/** Downmix para mono + resample linear para 16kHz. */
function toMono16k(buffer: AudioBuffer): Float32Array {
  const srcRate = buffer.sampleRate;
  const channels = buffer.numberOfChannels;
  const srcLen = buffer.length;

  // Mono mix
  const mono = new Float32Array(srcLen);
  for (let ch = 0; ch < channels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < srcLen; i++) mono[i] += data[i] / channels;
  }

  if (srcRate === 16000) return mono;

  // Linear resample
  const ratio = srcRate / 16000;
  const dstLen = Math.floor(srcLen / ratio);
  const out = new Float32Array(dstLen);
  for (let i = 0; i < dstLen; i++) {
    const srcIdx = i * ratio;
    const i0 = Math.floor(srcIdx);
    const i1 = Math.min(i0 + 1, srcLen - 1);
    const frac = srcIdx - i0;
    out[i] = mono[i0] * (1 - frac) + mono[i1] * frac;
  }
  return out;
}


/** Versão robusta: 1 pacote Opus por página Ogg (simples, separação garantida). */
function buildOggOpusSimple(packets: Uint8Array[]): Blob {
  const SERIAL = Math.floor(Math.random() * 0xffffffff) >>> 0;
  let pageSeq = 0;
  const out: Uint8Array[] = [];

  function crc32(data: Uint8Array): number {
    let crc = 0;
    for (let i = 0; i < data.length; i++) {
      crc = ((crc ^ (data[i] << 24)) >>> 0);
      for (let j = 0; j < 8; j++) {
        crc = (crc & 0x80000000) ? (((crc << 1) ^ 0x04c11db7) >>> 0) : ((crc << 1) >>> 0);
      }
    }
    return crc >>> 0;
  }

  function emit(payload: Uint8Array, headerType: number, granule: bigint) {
    const segments: number[] = [];
    let rem = payload.length;
    if (rem === 0) segments.push(0);
    while (rem > 0) {
      const s = Math.min(255, rem);
      segments.push(s);
      rem -= s;
      if (rem === 0 && s === 255) segments.push(0);
    }
    if (segments.length > 255) {
      // Pacote grande demais para 1 página — não deve acontecer com Opus voz.
      throw new Error("Pacote Opus excede capacidade de 1 página Ogg");
    }
    const header = new Uint8Array(27 + segments.length);
    const dv = new DataView(header.buffer);
    header[0] = 0x4f; header[1] = 0x67; header[2] = 0x67; header[3] = 0x53;
    header[4] = 0;
    header[5] = headerType;
    dv.setBigUint64(6, granule, true);
    dv.setUint32(14, SERIAL, true);
    dv.setUint32(18, pageSeq++, true);
    dv.setUint32(22, 0, true);
    header[26] = segments.length;
    for (let i = 0; i < segments.length; i++) header[27 + i] = segments[i];
    const page = new Uint8Array(header.length + payload.length);
    page.set(header, 0);
    page.set(payload, header.length);
    const crc = crc32(page);
    new DataView(page.buffer).setUint32(22, crc, true);
    out.push(page);
  }

  // ID Header
  const idHeader = new Uint8Array(19);
  idHeader.set([0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64], 0);
  idHeader[8] = 1;
  idHeader[9] = 1;
  new DataView(idHeader.buffer).setUint16(10, 0, true);
  new DataView(idHeader.buffer).setUint32(12, 48000, true);
  new DataView(idHeader.buffer).setInt16(16, 0, true);
  idHeader[18] = 0;
  emit(idHeader, 0x02, 0n);

  // Comment Header
  const vendor = new TextEncoder().encode("lovable-webcodecs");
  const comment = new Uint8Array(8 + 4 + vendor.length + 4);
  comment.set([0x4f, 0x70, 0x75, 0x73, 0x54, 0x61, 0x67, 0x73], 0);
  new DataView(comment.buffer).setUint32(8, vendor.length, true);
  comment.set(vendor, 12);
  new DataView(comment.buffer).setUint32(12 + vendor.length, 0, true);
  emit(comment, 0x00, 0n);

  // Audio pages — 1 pacote por página, granule em 48kHz, 60ms por pacote => 2880 samples
  const SAMPLES_PER_PACKET = 2880;
  let granule = 0n;
  for (let i = 0; i < packets.length; i++) {
    granule += BigInt(SAMPLES_PER_PACKET);
    const isLast = i === packets.length - 1;
    emit(packets[i], isLast ? 0x04 : 0x00, granule);
  }

  // Copia para ArrayBuffers "limpos" (evita variância de SharedArrayBuffer no tipo)
  const parts: BlobPart[] = out.map((u) => {
    const ab = new ArrayBuffer(u.byteLength);
    new Uint8Array(ab).set(u);
    return ab;
  });
  return new Blob(parts, { type: "audio/ogg" });
}

async function compressWithWebCodecs(
  input: File,
  { onProgress, signal }: CompressOptions,
): Promise<CompressResult> {
  if (isVideoFile(input)) {
    // Demux de vídeo via WebCodecs/MP4Box é complexo; deixa para o ffmpeg.
    throw new Error("Vídeo: usando ffmpeg para extração");
  }

  onProgress?.(2);
  const buffer = await decodeWithWebAudio(input);
  if (signal?.aborted) throw new Error("cancelado");
  onProgress?.(20);

  const samples = toMono16k(buffer);
  onProgress?.(35);

  const FRAME_MS = 60;
  const FRAME_SAMPLES = (FRAME_MS / 1000) * 16000; // 960
  const totalFrames = Math.ceil(samples.length / FRAME_SAMPLES);

  const packets: Uint8Array[] = [];
  let encodeError: Error | null = null;

  const AE: any = (globalThis as any).AudioEncoder;
  const encoder = new AE({
    output: (chunk: any) => {
      const buf = new Uint8Array(chunk.byteLength);
      chunk.copyTo(buf);
      packets.push(buf);
    },
    error: (e: Error) => {
      console.error("[audio-compress] AudioEncoder error:", e);
      encodeError = e;
    },
  });

  // Mantém apenas campos opus válidos pela spec WebCodecs (application + frameDuration).
  // Campos não-padrão (ex.: signal) podem passar isConfigSupported() mas fazer o
  // encoder real travar no flush() — daí a UI ficava em 0% para sempre.
  encoder.configure({
    codec: "opus",
    sampleRate: 16000,
    numberOfChannels: 1,
    bitrate: 24000,
    opus: { application: "voip", frameDuration: FRAME_MS * 1000 },
  });

  const AD: any = (globalThis as any).AudioData;
  let timestampUs = 0;
  for (let f = 0; f < totalFrames; f++) {
    if (signal?.aborted) {
      try { encoder.close(); } catch { /* noop */ }
      throw new Error("cancelado");
    }
    const start = f * FRAME_SAMPLES;
    const end = Math.min(start + FRAME_SAMPLES, samples.length);
    const frame = new Float32Array(FRAME_SAMPLES);
    frame.set(samples.subarray(start, end));
    const data = new AD({
      format: "f32",
      sampleRate: 16000,
      numberOfFrames: FRAME_SAMPLES,
      numberOfChannels: 1,
      timestamp: timestampUs,
      data: frame,
    });
    encoder.encode(data);
    data.close();
    timestampUs += FRAME_MS * 1000;

    if (f % 50 === 0) {
      const pct = 35 + Math.round((f / totalFrames) * 60);
      onProgress?.(Math.min(95, pct));
      // Cede a thread para o encoder processar
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  // Timeout no flush: se o encoder travar (config rejeitada silenciosamente),
  // não deixa a UI presa em 0%. 30s é folgado mesmo p/ 1h de áudio.
  await Promise.race([
    encoder.flush(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("AudioEncoder.flush() timeout (30s) — encoder travou")), 30000),
    ),
  ]);
  try { encoder.close(); } catch { /* noop */ }

  if (encodeError) throw encodeError;
  if (packets.length === 0) throw new Error("Nenhum pacote Opus gerado");

  const blob = buildOggOpusSimple(packets);
  const baseName = input.name.replace(/\.[^.]+$/, "") || "audio";
  const outFile = new File([blob], `${baseName}.ogg`, { type: "audio/ogg" });
  onProgress?.(100);

  return {
    file: outFile,
    originalSize: input.size,
    compressedSize: outFile.size,
    engine: "webcodecs",
  };
}

// ============================================================================
// ffmpeg.wasm (fallback)
// ============================================================================

async function compressWithFfmpeg(
  input: File,
  { onProgress, signal }: CompressOptions,
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
    try { ff.terminate(); } catch { /* noop */ }
    ffmpegSingleton = null;
    loadPromise = null;
  };
  signal?.addEventListener("abort", onAbort);

  try {
    await ff.writeFile(inputName, await fetchFile(input));
    if (signal?.aborted) throw new Error("Compressão cancelada");

    const exitCode = await ff.exec([
      "-i", inputName,
      "-vn",
      "-ac", "1",
      "-ar", "16000",
      "-c:a", "libopus",
      "-b:a", "24k",
      "-application", "voip",
      "-compression_level", "0",
      "-frame_duration", "60",
      "-vbr", "on",
      "-threads", "0",
      outputName,
    ]);

    if (exitCode !== 0) throw new Error("ffmpeg falhou ao processar o áudio");

    const data = await ff.readFile(outputName);
    const uint8 = typeof data === "string" ? new TextEncoder().encode(data) : (data as Uint8Array);
    const buf = new ArrayBuffer(uint8.byteLength);
    new Uint8Array(buf).set(uint8);
    const blob = new Blob([buf], { type: "audio/ogg" });
    const baseName = input.name.replace(/\.[^.]+$/, "") || "audio";
    const outFile = new File([blob], `${baseName}.ogg`, { type: "audio/ogg" });

    onProgress?.(100);
    try { await ff.deleteFile(inputName); } catch { /* noop */ }
    try { await ff.deleteFile(outputName); } catch { /* noop */ }

    return {
      file: outFile,
      originalSize: input.size,
      compressedSize: outFile.size,
      engine: "ffmpeg",
    };
  } finally {
    ff.off("progress", onProgressEvent);
    signal?.removeEventListener("abort", onAbort);
  }
}

// ============================================================================
// API pública
// ============================================================================

export async function compressAudio(
  input: File,
  opts: CompressOptions = {},
): Promise<CompressResult> {
  if (!opts.forceFfmpeg && !isVideoFile(input)) {
    if (await webCodecsSupported()) {
      try {
        return await compressWithWebCodecs(input, opts);
      } catch (e) {
        if (opts.signal?.aborted) throw e;
        console.warn("[audio-compress] WebCodecs falhou, caindo no ffmpeg.wasm:", e);
        // segue para ffmpeg
      }
    }
  }
  return compressWithFfmpeg(input, opts);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
