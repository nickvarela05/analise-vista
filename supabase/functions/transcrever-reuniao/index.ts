// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
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
    // Mensagens amigáveis para erros comuns do ElevenLabs
    if (res.status === 401 && /unusual_activity|detected_unusual/i.test(errText)) {
      throw new Error(
        "ElevenLabs bloqueou a chave (Free Tier desabilitado por atividade incomum). Faça upgrade para um plano pago em elevenlabs.io ou gere uma nova API key e atualize o secret ELEVENLABS_API_KEY.",
      );
    }
    if (res.status === 401) {
      throw new Error("ElevenLabs: API key inválida ou sem permissão. Verifique o secret ELEVENLABS_API_KEY.");
    }
    if (res.status === 402) {
      throw new Error("ElevenLabs sem créditos. Adicione créditos ou faça upgrade do plano.");
    }
    if (res.status === 429) {
      throw new Error("ElevenLabs: limite de requisições atingido. Aguarde alguns minutos e tente novamente.");
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let reuniaoId: string | null = null;
  try {
    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY não configurada");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const body = await req.json();
    reuniaoId = body.reuniao_id;
    const audioPath: string = body.audio_path;
    if (!reuniaoId || !audioPath) throw new Error("reuniao_id e audio_path são obrigatórios");

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

    // 2. Transcreve
    const { formatted, speakers } = await transcribeWithElevenLabs(blob, fileName);
    if (!formatted.trim()) throw new Error("Transcrição vazia");

    // Salva transcrição parcial enquanto IA roda
    await admin
      .from("reuniao")
      .update({ transcricao: formatted })
      .eq("id", reuniaoId);

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
            : speakers.map((s) => `Falante ${s}`),
        transcricao_status: "concluido",
        transcricao_erro: null,
      })
      .eq("id", reuniaoId);
    if (upErr) throw new Error(`Falha ao salvar: ${upErr.message}`);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("transcrever-reuniao error:", e);
    if (reuniaoId) {
      await admin
        .from("reuniao")
        .update({
          transcricao_status: "erro",
          transcricao_erro: String(e?.message ?? e).slice(0, 500),
        })
        .eq("id", reuniaoId);
    }
    // Retorna 200 com payload de erro para o cliente NÃO crashar — o status já foi
    // gravado em transcricao_status='erro' e a mensagem em transcricao_erro.
    return new Response(
      JSON.stringify({ ok: false, error: String(e?.message ?? e) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
