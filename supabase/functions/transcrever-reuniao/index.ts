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
    if (res.status === 413) {
      throw new AudioTooLargeError(
        `Groq recusou o áudio de ${formatBytes(audioBlob.size)} por tamanho.`,
      );
    }
    if (res.status === 429) {
      throw new Error("Groq: limite de requisições atingido. Aguarde alguns minutos e tente novamente.");
    }
    throw new Error(`Groq Whisper (${res.status}): ${errText.slice(0, 300)}`);
  }

  const json = await res.json();
  const text: string = json.text ?? "";
  // Whisper não tem diarização nativa — retornamos o texto corrido.
  // O Gemini detecta participantes a partir do conteúdo.
  return { text, formatted: text, speakers: [] };
}

/**
 * Escolhe a melhor rota de transcrição:
 * arquivos grandes vão direto para o Gemini; pequenos tentam Groq e caem
 * para o Gemini se forem recusados por tamanho/limite.
 */
async function transcribeAudio(audioBlob: Blob, fileName: string): Promise<{
  text: string;
  formatted: string;
  speakers: string[];
  engine: string;
}> {
  if (audioBlob.size > GROQ_SAFE_BYTES) {
    console.log(`[transcrever] ${formatBytes(audioBlob.size)} → Gemini (direto)`);
    return { ...(await transcribeWithGemini(audioBlob, fileName)), engine: "gemini" };
  }
  try {
    return { ...(await transcribeWithGroq(audioBlob, fileName)), engine: "groq" };
  } catch (e) {
    if (e instanceof AudioTooLargeError) {
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

/** Pipeline completo: baixa → transcreve → analisa → salva. */
async function processarReuniao(reuniaoId: string, audioPath: string): Promise<void> {
  try {
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

    // 2. Transcreve (Groq → fallback Gemini para arquivos grandes)
    const { formatted, speakers, engine } = GROQ_API_KEY
      ? await transcribeAudio(blob, fileName)
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
