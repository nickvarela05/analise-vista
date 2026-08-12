// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsFor } from "../_shared/cors.ts";
import { requireUser, assertReuniaoAccess } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

function formatTranscriptByWords(words: any[]): string {
  if (!Array.isArray(words) || words.length === 0) return "";
  const lines: string[] = [];
  let currentSpeaker: string | null = null;
  let buffer: string[] = [];
  const flush = () => {
    if (buffer.length > 0) {
      const speakerLabel = currentSpeaker ? `**Falante ${currentSpeaker}:** ` : "";
      lines.push(`${speakerLabel}${buffer.join("").trim()}`);
      buffer = [];
    }
  };
  for (const w of words) {
    const speaker = w.speaker_id ?? null;
    if (speaker !== currentSpeaker) {
      flush();
      currentSpeaker = speaker;
    }
    buffer.push((w.text ?? "") + " ");
  }
  flush();
  return lines.join("\n\n");
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/** Limite prático do Groq Whisper (abaixo dos 25 MB anunciados). */
const GROQ_SAFE_BYTES = 18 * 1024 * 1024;

class AudioTooLargeError extends Error {}

/** Recusa por cota de segundos de áudio por hora (ASPH) — não é tamanho. */
class GroqQuotaError extends Error {
  retryAfter: number;
  constructor(message: string, retryAfter: number) {
    super(message);
    this.retryAfter = retryAfter;
  }
}

/** Extrai o tempo de espera sugerido pelo Groq (header ou texto do erro). */
function retryAfterSeconds(res: Response, errText: string): number {
  const header = Number(res.headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return header;
  const m = errText.match(/try again in ([\d.]+)(m|s)/i);
  if (m) return Math.ceil(parseFloat(m[1]) * (m[2].toLowerCase() === "m" ? 60 : 1));
  return 20;
}

/** Deriva o `format` aceito pelo bloco input_audio a partir do mime/nome. */
function audioFormat(fileName: string, mime: string | undefined): string {
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();
  const map: Record<string, string> = {
    mp3: "mp3", mpeg: "mp3", m4a: "m4a", mp4: "m4a", aac: "aac",
    wav: "wav", webm: "webm", ogg: "ogg", oga: "ogg", opus: "ogg", flac: "flac",
  };
  if (map[ext]) return map[ext];
  const sub = (mime ?? "").split("/")[1]?.replace("x-", "") ?? "";
  return map[sub] ?? "mp3";
}

function blobToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// =============================================================
// Fallback: Gemini (Lovable AI) — aceita áudios maiores que o Groq.
// =============================================================
async function transcribeWithGemini(audioBlob: Blob, fileName: string): Promise<{
  text: string;
  formatted: string;
  speakers: string[];
}> {
  const bytes = new Uint8Array(await audioBlob.arrayBuffer());
  const base64 = blobToBase64(bytes);
  const format = audioFormat(fileName, audioBlob.type);

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "Você transcreve áudios de reuniões em português brasileiro. Devolva APENAS a transcrição literal, sem comentários, sem resumo. Quando conseguir distinguir vozes diferentes, prefixe cada trecho com **Falante 1:**, **Falante 2:** etc., separando os blocos por linha em branco.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Transcreva integralmente o áudio a seguir." },
            { type: "input_audio", input_audio: { data: base64, format } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    if (res.status === 429) throw new Error("Limite de requisições à IA atingido. Tente novamente em alguns minutos.");
    if (res.status === 402) throw new Error("Créditos da IA esgotados. Adicione créditos no workspace.");
    if (res.status === 413) {
      throw new Error(
        `Áudio de ${formatBytes(audioBlob.size)} é grande demais também para a transcrição por IA. Divida o arquivo antes de enviar.`,
      );
    }
    throw new Error(`Transcrição por IA (${res.status}): ${t.slice(0, 300)}`);
  }

  const json = await res.json();
  const text: string = json.choices?.[0]?.message?.content ?? "";
  return { text, formatted: text, speakers: [] };
}

// =============================================================
// Groq Whisper-large-v3 — gratuito, rápido, sem bloqueio de IP.
// =============================================================
async function transcribeWithGroq(audioBlob: Blob, fileName: string): Promise<{
  text: string;
  formatted: string;
  speakers: string[];
}> {
  const fd = new FormData();
  fd.append("file", audioBlob, fileName);
  fd.append("model", "whisper-large-v3");
  fd.append("language", "pt");
  fd.append("response_format", "verbose_json");
  fd.append("temperature", "0");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
    body: fd,
  });

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 401) {
      throw new Error("Groq: API key inválida. Verifique o secret GROQ_API_KEY em console.groq.com.");
    }
    // Cota de segundos de áudio por hora (ASPH) / rate limit: não é tamanho.
    if (/ASPH|seconds of audio|rate.?limit|too many requests/i.test(errText) || res.status === 429) {
      throw new GroqQuotaError(
        `Groq: cota de áudio por hora atingida`,
        retryAfterSeconds(res, errText),
      );
    }
    if (res.status === 413) {
      throw new AudioTooLargeError(
        `Groq recusou o áudio de ${formatBytes(audioBlob.size)}: ${errText.slice(0, 200)}`,
      );
    }
    throw new Error(`Groq Whisper (${res.status}): ${errText.slice(0, 300)}`);
  }

  const json = await res.json();
  const text: string = json.text ?? "";
  // Whisper não tem diarização nativa — retornamos o texto corrido.
  // O Gemini detecta participantes a partir do conteúdo.
  return { text, formatted: text, speakers: [] };
}

/** Tenta o Groq com re-tentativas curtas quando a recusa é por cota horária. */
async function transcribeWithGroqRetry(
  blob: Blob,
  fileName: string,
  attempts = 2,
): Promise<{ text: string; formatted: string; speakers: string[] }> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await transcribeWithGroq(blob, fileName);
    } catch (e) {
      last = e;
      if (!(e instanceof GroqQuotaError) || i === attempts - 1) throw e;
      const wait = Math.min(Math.max(e.retryAfter, 5), 60);
      console.log(`[transcrever] cota Groq — aguardando ${wait}s e repetindo`);
      await new Promise((r) => setTimeout(r, wait * 1000));
    }
  }
  throw last;
}


/** Duração alvo de cada parte (segundos) e teto de tamanho. */
const CHUNK_TARGET_SECONDS = 600; // ~10 min
const CHUNK_MAX_BYTES = 5 * 1024 * 1024;

/** Tabelas de bitrate/sample rate para cálculo do tamanho do frame MP3. */
const MP3_BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const MP3_BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
const MP3_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000, 0], // MPEG1
  2: [22050, 24000, 16000, 0], // MPEG2
  0: [11025, 12000, 8000, 0], // MPEG2.5
};

/**
 * Divide um MP3 em partes de ~`targetSeconds` (teto de `maxBytes`), respeitando
 * os limites de frame (sem reencode). `null` quando não parece um MP3 válido.
 */
function splitMp3(bytes: Uint8Array, targetSeconds: number, maxBytes: number): Uint8Array[] | null {
  const parts: Uint8Array[] = [];
  let start = 0;
  let i = 0;
  let partSeconds = 0;
  let totalSeconds = 0;

  // Pula tag ID3v2, se houver.
  if (bytes.length > 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    const size =
      ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f);
    i = 10 + size;
    start = i;
  }

  let frames = 0;
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff || (bytes[i + 1] & 0xe0) !== 0xe0) {
      i++;
      continue;
    }
    const versionBits = (bytes[i + 1] >> 3) & 0x03;
    const layerBits = (bytes[i + 1] >> 1) & 0x03;
    if (versionBits === 1 || layerBits !== 1) {
      i++;
      continue;
    }
    const bitrateIdx = (bytes[i + 2] >> 4) & 0x0f;
    const rateIdx = (bytes[i + 2] >> 2) & 0x03;
    const padding = (bytes[i + 2] >> 1) & 0x01;
    const bitrate =
      (versionBits === 3 ? MP3_BITRATES_V1_L3[bitrateIdx] : MP3_BITRATES_V2_L3[bitrateIdx]) * 1000;
    const rate = (MP3_RATES[versionBits] ?? [])[rateIdx] ?? 0;
    if (!bitrate || !rate) {
      i++;
      continue;
    }
    const samples = versionBits === 3 ? 1152 : 576;
    const frameLen = Math.floor((samples / 8) * (bitrate / rate)) + padding;
    if (frameLen < 4) {
      i++;
      continue;
    }
    frames++;
    const frameSeconds = samples / rate;

    // Fecha a parte quando o próximo frame ultrapassaria o alvo (tempo ou peso).
    if (partSeconds + frameSeconds > targetSeconds || i + frameLen - start > maxBytes) {
      parts.push(bytes.subarray(start, i));
      start = i;
      partSeconds = 0;
    }
    partSeconds += frameSeconds;
    totalSeconds += frameSeconds;
    i += frameLen;
  }

  if (frames < 10) return null;
  if (start < bytes.length) parts.push(bytes.subarray(start, bytes.length));
  console.log(`[transcrever] duração estimada: ${Math.round(totalSeconds / 60)} min`);
  return parts.filter((p) => p.length > 0);
}

/** Notificação de progresso parte a parte. */
type ProgressFn = (info: { parte: number; total: number; textoAcumulado: string }) => Promise<void>;

/** Contexto de retomada: partes já concluídas e o texto acumulado até aqui. */
interface ResumeState {
  startIndex: number;
  prefixText: string;
}

/**
 * Erro temporário (cota / limite de tempo): a transcrição pode ser retomada
 * automaticamente depois de esperar.
 */
class RetryableError extends Error {
  waitSeconds: number;
  constructor(message: string, waitSeconds: number) {
    super(message);
    this.waitSeconds = waitSeconds;
  }
}

/** Classifica o erro final: retomável (com espera) ou definitivo. */
function retryableWait(e: unknown): number | null {
  if (e instanceof RetryableError) return e.waitSeconds;
  if (e instanceof GroqQuotaError) return Math.min(Math.max(e.retryAfter, 60), 300);
  const msg = String((e as Error)?.message ?? e);
  if (/Limite de requisições|rate.?limit|429|cota|Tempo máximo de processamento/i.test(msg)) {
    return 120;
  }
  return null;
}

/** Transcreve um MP3 grande em partes sequenciais e concatena o texto. */
async function transcribeChunked(
  audioBlob: Blob,
  _fileName: string,
  onProgress?: ProgressFn,
  resume?: ResumeState,
): Promise<{ text: string; formatted: string; speakers: string[] } | null> {
  const bytes = new Uint8Array(await audioBlob.arrayBuffer());
  const parts = splitMp3(bytes, CHUNK_TARGET_SECONDS, CHUNK_MAX_BYTES);
  if (!parts || parts.length < 2) return null;

  const startIndex = Math.min(resume?.startIndex ?? 0, parts.length);
  const textos: string[] = [];
  const prefix = (resume?.prefixText ?? "").trim();
  const acumulado = () => [prefix, ...textos].filter(Boolean).join("\n\n");

  console.log(
    `[transcrever] ${parts.length} partes — retomando a partir da parte ${startIndex + 1}`,
  );
  for (let idx = startIndex; idx < parts.length; idx++) {
    const part = parts[idx];
    const partBlob = new Blob([part as unknown as BlobPart], { type: "audio/mpeg" });
    console.log(`[transcrever] parte ${idx + 1}/${parts.length} (${formatBytes(part.length)})`);
    let r: { text: string };
    try {
      r = await transcribeWithGroqRetry(partBlob, `parte-${idx + 1}.mp3`);
    } catch (e) {
      console.log(`[transcrever] parte ${idx + 1} falhou no Groq (${(e as Error).message}) → Gemini`);
      try {
        r = await transcribeWithGemini(partBlob, `parte-${idx + 1}.mp3`);
      } catch (e2) {
        const wait = retryableWait(e2) ?? retryableWait(e);
        if (wait !== null) {
          // Progresso já foi salvo: interrompe para retomar desta parte depois.
          throw new RetryableError(
            `Pausado na parte ${idx + 1} de ${parts.length}: limite temporário do serviço de transcrição.`,
            wait,
          );
        }
        throw e2;
      }
    }
    if (r.text.trim()) textos.push(r.text.trim());
    await onProgress?.({
      parte: idx + 1,
      total: parts.length,
      textoAcumulado: acumulado(),
    });
  }
  const full = acumulado();
  return { text: full, formatted: full, speakers: [] };
}


/**
 * Escolhe a melhor rota de transcrição:
 * arquivos grandes são divididos em partes e transcritos pelo Groq;
 * se a divisão não for possível (não-MP3), cai para o Gemini.
 */
async function transcribeAudio(audioBlob: Blob, fileName: string, onProgress?: ProgressFn): Promise<{
  text: string;
  formatted: string;
  speakers: string[];
  engine: string;
}> {
  if (audioBlob.size > GROQ_SAFE_BYTES) {
    console.log(`[transcrever] ${formatBytes(audioBlob.size)} → tentando divisão em partes`);
    const chunked = await transcribeChunked(audioBlob, fileName, onProgress);
    if (chunked && chunked.text.trim()) return { ...chunked, engine: "groq-chunked" };
    console.log(`[transcrever] divisão indisponível → Gemini`);
    return { ...(await transcribeWithGemini(audioBlob, fileName)), engine: "gemini" };
  }
  try {
    return { ...(await transcribeWithGroqRetry(audioBlob, fileName)), engine: "groq" };
  } catch (e) {
    if (e instanceof AudioTooLargeError || e instanceof GroqQuotaError) {
      const chunked = await transcribeChunked(audioBlob, fileName, onProgress);
      if (chunked && chunked.text.trim()) return { ...chunked, engine: "groq-chunked" };
      console.log(`[transcrever] Groq recusou → fallback Gemini`);
      return { ...(await transcribeWithGemini(audioBlob, fileName)), engine: "gemini-fallback" };
    }
    throw e;
  }
}


/* =============================================================
 * ElevenLabs DESATIVADO — Free Tier bloqueia chamadas de servidores
 * com mensagem "detected_unusual_activity". Mantido para rollback.
 * Para reativar: descomentar este bloco e a const ELEVENLABS_API_KEY no topo,
 * e trocar a chamada em Deno.serve() de transcribeWithGroq para transcribeWithElevenLabs.
 * =============================================================
async function transcribeWithElevenLabs(audioBlob: Blob, fileName: string): Promise<{
  text: string;
  formatted: string;
  speakers: string[];
}> {
  const fd = new FormData();
  fd.append("file", audioBlob, fileName);
  fd.append("model_id", "scribe_v1");
  fd.append("language_code", "por");
  fd.append("diarize", "true");
  fd.append("tag_audio_events", "true");

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": ELEVENLABS_API_KEY! },
    body: fd,
  });

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 401 && /unusual_activity|detected_unusual/i.test(errText)) {
      throw new Error(
        "ElevenLabs bloqueou a chave (Free Tier desabilitado por atividade incomum).",
      );
    }
    throw new Error(`ElevenLabs (${res.status}): ${errText.slice(0, 300)}`);
  }

  const json = await res.json();
  const text: string = json.text ?? "";
  const formatted = formatTranscriptByWords(json.words ?? []) || text;
  const speakers = Array.from(
    new Set((json.words ?? []).map((w: any) => w.speaker_id).filter(Boolean)),
  ) as string[];
  return { text, formatted, speakers };
}
============================================================= */

async function analyzeWithAI(transcricao: string): Promise<{
  resumo: string;
  pauta: string;
  proximos_passos: string;
  decisoes: string[];
  participantes_detectados: string[];
}> {
  const systemPrompt = `Você é um analista de reuniões. Receberá a transcrição de uma reunião em português brasileiro, possivelmente com falantes identificados como "Falante 0", "Falante 1" etc. Extraia informações estruturadas e objetivas. Use linguagem profissional, frases curtas e claras. Nunca invente informações que não estejam na transcrição.`;

  const tool = {
    type: "function",
    function: {
      name: "extract_meeting_insights",
      description: "Extrai insights estruturados de uma transcrição de reunião.",
      parameters: {
        type: "object",
        properties: {
          resumo: {
            type: "string",
            description:
              "Resumo executivo de 3 a 6 frases sobre o que foi discutido e principais conclusões.",
          },
          pauta: {
            type: "string",
            description:
              "Tópicos abordados em formato de lista markdown (- item). Inferir mesmo que não tenha sido formalizada.",
          },
          proximos_passos: {
            type: "string",
            description:
              "Lista markdown (- item) das ações combinadas, com responsável entre parênteses quando identificado.",
          },
          decisoes: {
            type: "array",
            items: { type: "string" },
            description:
              "Decisões objetivas tomadas durante a reunião. Vazio se nenhuma decisão clara.",
          },
          participantes_detectados: {
            type: "array",
            items: { type: "string" },
            description:
              "Nomes de pessoas mencionadas como participantes/falantes. Apenas nomes próprios reais, não 'Falante 0'.",
          },
        },
        required: [
          "resumo",
          "pauta",
          "proximos_passos",
          "decisoes",
          "participantes_detectados",
        ],
        additionalProperties: false,
      },
    },
  };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Analise a transcrição abaixo e chame a função extract_meeting_insights:\n\n---\n${transcricao.slice(0, 60000)}\n---`,
        },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "extract_meeting_insights" } },
    }),
  });

  if (res.status === 429) throw new Error("Limite de requisições à IA atingido. Tente novamente em alguns minutos.");
  if (res.status === 402) throw new Error("Créditos da IA esgotados. Adicione créditos no workspace.");
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Lovable AI (${res.status}): ${t.slice(0, 300)}`);
  }
  const json = await res.json();
  const call = json.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) throw new Error("IA não retornou análise estruturada");
  const args = JSON.parse(call.function.arguments);
  return {
    resumo: args.resumo ?? "",
    pauta: args.pauta ?? "",
    proximos_passos: args.proximos_passos ?? "",
    decisoes: Array.isArray(args.decisoes) ? args.decisoes : [],
    participantes_detectados: Array.isArray(args.participantes_detectados)
      ? args.participantes_detectados
      : [],
  };
}

/** Limite global do pipeline: evita reunião presa em "processando" para sempre. */
const PIPELINE_TIMEOUT_MS = 25 * 60 * 1000;

/** Pipeline completo: baixa → transcreve → analisa → salva. */
async function processarReuniao(reuniaoId: string, audioPath: string): Promise<void> {
  const deadline = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error("Tempo máximo de processamento excedido (25 min). Tente novamente ou divida o áudio.")),
      PIPELINE_TIMEOUT_MS,
    )
  );
  try {
    await Promise.race([executarPipeline(reuniaoId, audioPath), deadline]);
  } catch (e: any) {
    console.error("transcrever-reuniao error:", e);
    await admin
      .from("reuniao")
      .update({
        transcricao_status: "erro",
        transcricao_erro: String(e?.message ?? e).slice(0, 500),
      })
      .eq("id", reuniaoId);
  }
}

async function executarPipeline(reuniaoId: string, audioPath: string): Promise<void> {
  {
    await admin
      .from("reuniao")
      .update({ transcricao_status: "processando", transcricao_erro: null })
      .eq("id", reuniaoId);

    // 1. Baixa áudio
    const { data: blob, error: dlErr } = await admin.storage
      .from("reuniao-audios")
      .download(audioPath);
    if (dlErr || !blob) throw new Error(`Falha ao baixar áudio: ${dlErr?.message}`);

    const fileName = audioPath.split("/").pop() ?? "audio.mp3";

    // Progresso parte a parte: grava o texto já transcrito e o andamento.
    const onProgress: ProgressFn = async ({ parte, total, textoAcumulado }) => {
      await admin
        .from("reuniao")
        .update({
          transcricao: textoAcumulado,
          transcricao_erro: `Transcrevendo… parte ${parte} de ${total}`,
        })
        .eq("id", reuniaoId);
    };

    // 2. Transcreve (Groq → fallback Gemini para arquivos grandes)
    const { formatted, speakers, engine } = GROQ_API_KEY
      ? await transcribeAudio(blob, fileName, onProgress)
      : { ...(await transcribeWithGemini(blob, fileName)), engine: "gemini" };
    console.log(`[transcrever] engine=${engine} size=${formatBytes(blob.size)}`);
    if (!formatted.trim()) throw new Error("Transcrição vazia");

    // Salva transcrição parcial enquanto IA roda
    await admin.from("reuniao").update({ transcricao: formatted }).eq("id", reuniaoId);

    // 3. Analisa com IA
    const insights = await analyzeWithAI(formatted);

    // 4. Salva tudo
    const { error: upErr } = await admin
      .from("reuniao")
      .update({
        transcricao: formatted,
        resumo: insights.resumo,
        pauta: insights.pauta,
        proximos_passos: insights.proximos_passos,
        decisoes: insights.decisoes,
        participantes_detectados:
          insights.participantes_detectados.length > 0
            ? insights.participantes_detectados
            : speakers.map((s: string) => `Falante ${s}`),
        transcricao_status: "concluido",
        transcricao_erro: null,
      })
      .eq("id", reuniaoId);
    if (upErr) throw new Error(`Falha ao salvar: ${upErr.message}`);
  }
}

Deno.serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const user = await requireUser(req);
    if (!GROQ_API_KEY) console.warn("GROQ_API_KEY ausente — usando apenas a transcrição por IA");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const body = await req.json();
    const reuniaoId: string | null = body.reuniao_id;
    const audioPath: string = body.audio_path;
    if (!reuniaoId || !audioPath) throw new Error("reuniao_id e audio_path são obrigatórios");

    await assertReuniaoAccess(admin, user.id, reuniaoId);

    // Roda em segundo plano: o cliente não precisa esperar (áudios longos
    // levam minutos) e a desconexão do cliente não interrompe o trabalho.
    const task = processarReuniao(reuniaoId, audioPath);
    // @ts-ignore — API do runtime de edge functions
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(task);
    } else {
      await task;
    }

    return new Response(JSON.stringify({ ok: true, status: "processando" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("transcrever-reuniao error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e?.message ?? e) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
