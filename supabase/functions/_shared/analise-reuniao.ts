// Análise de reunião por IA, usada pelas duas portas de entrada da transcrição:
//  - transcrever-reuniao (áudio → Groq/Gemini → análise);
//  - analisar-transcricao (texto colado, ex.: Gravador do iPhone, ou "regerar análise").
// Antes eram duas análises com regras diferentes; a do áudio ignorava o contexto configurado em
// Configurações → IA (ia_prompt_config) e as duas liam só os primeiros 60 mil caracteres.
// Unificado em 06/10/2026, depois de o Nickolas relatar análise rasa.
// deno-lint-ignore-file no-explicit-any
import { aiFetch, AI_API_KEY } from "./ai.ts";

export type AnaliseReuniao = {
  resumo: string;
  pauta: string;
  proximos_passos: string;
  decisoes: string[];
  participantes_detectados: string[];
};

/** ~50 mil tokens: cobre reuniões de 2 h (167 mil caracteres) com folga no contexto do Gemini. */
const MAX_CARACTERES = 200_000;

const PROMPT_PADRAO =
  "Você é um analista de reuniões. Receberá a transcrição de uma reunião em português. " +
  "Extraia informações estruturadas, objetivas e profissionais. Não invente nada.";

const tool = {
  type: "function",
  function: {
    name: "extract_meeting_insights",
    description:
      "Extrai os pontos da reunião. Cubra TODOS os assuntos discutidos, não só o primeiro ou o principal. " +
      "A transcrição pode não indicar quem fala (ex.: transcrição do Gravador do iPhone) ou usar " +
      "'Falante 1', 'Falante 2', e pode ter erros de reconhecimento de voz: deduza pelo contexto e não invente.",
    parameters: {
      type: "object",
      properties: {
        pauta: {
          type: "string",
          description:
            "Lista dos assuntos tratados, na ordem em que apareceram, um por linha começando com '- '. " +
            "Cada item com o tema e, em poucas palavras, o que se discutiu dele. Normalmente de 4 a 10 itens.",
        },
        resumo: {
          type: "string",
          description:
            "Resumo em parágrafos curtos, um por assunto da pauta: contexto, problema ou necessidade, " +
            "o que foi proposto e o que ficou definido ou em aberto. Inclua sistemas, telas, números, " +
            "matrículas, prazos e nomes citados. Pode ser longo se a reunião foi longa.",
        },
        proximos_passos: {
          type: "string",
          description:
            "Todas as ações combinadas, uma por linha começando com '- ', no formato " +
            "'Responsável: ação (prazo)'. Omita prazo ou responsável quando não foram ditos; não invente.",
        },
        decisoes: {
          type: "array",
          items: { type: "string" },
          description: "Cada decisão tomada, em uma frase. Não repita ações dos próximos passos. Vazio se não houver.",
        },
        participantes_detectados: {
          type: "array",
          items: { type: "string" },
          description:
            "Nomes próprios de pessoas que participaram ou foram citadas como presentes, com o papel se dito. " +
            "Nunca 'Falante 1'.",
        },
      },
      required: ["resumo", "pauta", "proximos_passos", "decisoes", "participantes_detectados"],
      additionalProperties: false,
    },
  },
};

/** Prompt de sistema configurável em Configurações → IA (chave `analise_reuniao`). */
async function promptDoSistema(admin: any): Promise<string> {
  try {
    const { data } = await admin
      .from("ia_prompt_config")
      .select("prompt_sistema, instrucoes_extras, ativo")
      .eq("chave", "analise_reuniao")
      .maybeSingle();
    if (!data || !data.ativo || !data.prompt_sistema?.trim()) return PROMPT_PADRAO;
    const extra = data.instrucoes_extras?.trim();
    return extra ? `${data.prompt_sistema.trim()}\n\nContexto adicional:\n${extra}` : data.prompt_sistema.trim();
  } catch {
    return PROMPT_PADRAO;
  }
}

/**
 * Analisa a transcrição e devolve pauta, resumo, próximos passos, decisões e participantes.
 * @param admin Cliente Supabase com service role (para ler a configuração de prompt).
 * @param transcricao Texto da reunião.
 */
export async function analisarReuniao(admin: any, transcricao: string): Promise<AnaliseReuniao> {
  if (!AI_API_KEY) throw new Error("AI_API_KEY não configurada");
  const res = await aiFetch({
    method: "POST",
    headers: { Authorization: `Bearer ${AI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: await promptDoSistema(admin) },
        {
          role: "user",
          content: `Analise a transcrição abaixo e chame a função extract_meeting_insights:\n\n---\n${transcricao.slice(0, MAX_CARACTERES)}\n---`,
        },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "extract_meeting_insights" } },
    }),
  });

  if (res.status === 429) throw new Error("Limite de requisições à IA atingido. Tente novamente em alguns minutos.");
  if (res.status === 402) throw new Error("Cota do provedor de IA esgotada. Verifique o faturamento da chave de IA.");
  if (!res.ok) throw new Error(`IA (${res.status}): ${(await res.text()).slice(0, 300)}`);

  const json = await res.json();
  const call = json.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) throw new Error("IA não retornou análise estruturada");
  const args = JSON.parse(call.function.arguments);
  return {
    resumo: args.resumo ?? "",
    pauta: args.pauta ?? "",
    proximos_passos: args.proximos_passos ?? "",
    decisoes: Array.isArray(args.decisoes) ? args.decisoes : [],
    participantes_detectados: Array.isArray(args.participantes_detectados) ? args.participantes_detectados : [],
  };
}
