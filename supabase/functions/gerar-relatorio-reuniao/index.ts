// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  AlignmentType,
} from "https://esm.sh/docx@8.5.0";
import { corsFor } from "../_shared/cors.ts";
import { requireUser, assertReuniaoAccess } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

/**
 * CONTEXTO DO NEGÓCIO — usado no prompt do modelo.
 * Centralizado aqui para ser fácil de ajustar caso troquemos de provedor/modelo no futuro.
 */
const CONTEXTO_NEGOCIO = `
CONTEXTO DA EMPRESA:
- Somos prestadores de serviço atuando no setor de SISTEMAS DE GESTÃO EDUCACIONAL (ERP/SaaS para escolas, faculdades e instituições de ensino).
- Nossa área de atuação é ANÁLISE DE REQUISITOS: levantamento, refinamento, documentação e validação de requisitos funcionais e não-funcionais com clientes (instituições) e times internos (desenvolvimento, produto, suporte).
- Trabalhamos lado a lado com stakeholders educacionais (coordenadores, secretarias acadêmicas, financeiro educacional, professores, TI da instituição) e com squads de desenvolvimento que evoluem o produto.
- Termos comuns no nosso domínio: matrícula, rematrícula, secretaria acadêmica, diário de classe, boletim, contrato educacional, mensalidade, inadimplência, ENADE/INEP/MEC, integração com gateway de pagamento, LGPD aplicada a dados de alunos menores, calendário letivo, turmas, disciplinas, currículo, histórico escolar, PDI, BNCC.

COMO TRABALHAMOS:
- Reuniões servem para alinhar entendimento de requisitos, validar regras de negócio, destravar dúvidas com cliente, planejar entregas e registrar decisões que impactam roadmap/escopo.
- Cada reunião deve gerar artefatos rastreáveis: requisitos identificados, regras de negócio, premissas, restrições, riscos, dependências, próximos passos com responsáveis e prazos.
`.trim();

const SYSTEM_PROMPT = `Você é um analista de requisitos sênior em uma empresa prestadora de serviços para sistemas de gestão educacional.

${CONTEXTO_NEGOCIO}

TAREFA:
Você receberá os dados de UMA reunião (título, data, participantes, pauta, resumo, decisões, próximos passos e — quando houver — a transcrição). Gere um RELATÓRIO PROFISSIONAL E DETALHADO em português, próprio para ser entregue ao cliente ou arquivado internamente como documento de referência.

DIRETRIZES OBRIGATÓRIAS:
1. NÃO transcreva falas literais nem cite "fulano disse que...". O relatório é executivo e analítico.
2. Use linguagem técnica de análise de requisitos, mas acessível a stakeholders não-técnicos.
3. Seja DETALHADO: explique contexto, motivação e impacto de cada ponto. Evite frases genéricas ("foi discutido X") — descreva o QUE, POR QUE e COMO afeta o produto/projeto.
4. Quando a transcrição mencionar regras de negócio, fluxos, integrações, telas, perfis de usuário ou dados sensíveis (LGPD, dados de menores), DETALHE-OS em seções próprias.
5. Se algo não estiver claro nos dados fornecidos, marque como "⚠️ A confirmar com o cliente" — NUNCA invente fatos, números, prazos ou nomes.
6. Use markdown limpo: # para título principal, ## para seções, ### para subseções, listas com - e numeradas onde fizer sentido. Use **negrito** para destacar termos-chave.

REGRA CRÍTICA SOBRE PARTICIPANTES (NÃO VIOLAR):
- A lista oficial de participantes é EXATAMENTE a fornecida no campo "participantes" do JSON de entrada. Você NÃO pode adicionar, remover, renomear, corrigir ortografia, agrupar ou inferir participantes a partir da transcrição. Reproduza-a literalmente na seção "Informações Gerais".
- Pessoas que aparecem na transcrição mas NÃO estão na lista oficial de participantes devem ser tratadas como TERCEIROS MENCIONADOS e listadas APENAS na seção "Pessoas Mencionadas" (ver estrutura abaixo). Nunca as promova a participantes.
- Se a lista oficial estiver vazia, escreva "_Não informado._" — não tente preencher a partir da transcrição.

ESTRUTURA OBRIGATÓRIA DO RELATÓRIO (use exatamente estes títulos de seção, omita seções sem conteúdo real, EXCETO "Informações Gerais" e "Pessoas Mencionadas" que são sempre obrigatórias):

# Relatório de Reunião — <título da reunião>

## 1. Informações Gerais
- Data, duração, tipo.
- **Participantes oficiais:** liste EXATAMENTE os nomes do campo "participantes" do JSON, sem alterar nada. Se vazio, escreva "_Não informado._".
- **Responsáveis:** conforme JSON.

## 2. Pessoas Mencionadas
Liste pessoas, papéis ou áreas CITADAS durante a reunião (presentes na transcrição) que NÃO estão na lista oficial de participantes. Para cada uma:
- **Nome / papel:** como apareceu (ex.: "Coordenadora pedagógica da escola X", "João do financeiro do cliente").
- **Contexto da menção:** em que ponto foi citada e por quê (decisão pendente de aprovação dela, responsável por uma integração, etc.).
- **Ação relacionada (se houver):** se há algo a fazer envolvendo essa pessoa.

Se ninguém externo foi mencionado, escreva uma única linha: "_Nenhuma pessoa adicional mencionada._".

## 3. Contexto e Objetivo
Explique por que a reunião aconteceu e o que se pretendia alcançar. 2 a 4 parágrafos.

## 4. Pauta Detalhada
Expanda cada item da pauta original em um parágrafo descritivo. Não copie a pauta crua — enriqueça com contexto do domínio educacional.

## 5. Pontos-Chave Discutidos
Liste e DESENVOLVA os principais tópicos abordados. Para cada um:
- **Tópico:** nome
- **Descrição:** o que foi tratado e por quê
- **Impacto:** consequência para o produto/cliente/cronograma

## 6. Requisitos e Regras de Negócio Identificados
Quando aplicável, liste requisitos funcionais (RF), não-funcionais (RNF) e regras de negócio (RN) levantados ou refinados na reunião. Use formato:
- **RF-XX / RN-XX:** descrição clara, completa e testável.

## 7. Decisões Tomadas
Cada decisão em item próprio, explicando a decisão E sua justificativa.

## 8. Riscos, Premissas e Dependências
- **Riscos:** o que pode dar errado e como mitigar.
- **Premissas:** o que estamos assumindo como verdadeiro.
- **Dependências:** de quem/do quê o avanço depende.

## 9. Próximos Passos
Tabela em markdown com colunas: **Ação | Responsável | Prazo | Status**. Seja específico.

## 10. Pendências e Pontos em Aberto
Itens que precisam de retorno do cliente, dúvidas não resolvidas, validações pendentes.

## 11. Observações Finais
Qualquer recomendação adicional do analista.

REGRA DE OURO: Detalhe sem inventar. Se a fonte não trouxe informação para uma seção, escreva uma única linha: "_Sem registros adicionais nesta reunião._" — NÃO preencha com floreios.`;

// Conversor markdown → docx (suporta o subset que o prompt produz)
function mdToDocx(md: string): Paragraph[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: Paragraph[] = [];
  let inTable = false;
  let tableRows: string[][] = [];

  const flushTable = () => {
    if (tableRows.length === 0) return;
    // Renderiza tabela como lista textual simples para manter compatibilidade ampla
    const [header, _sep, ...rows] = tableRows;
    if (header) {
      out.push(
        new Paragraph({
          children: [new TextRun({ text: header.join(" | "), bold: true })],
          spacing: { before: 120, after: 60 },
        }),
      );
    }
    for (const r of rows) {
      out.push(
        new Paragraph({
          children: [new TextRun({ text: "• " + r.join(" | ") })],
          spacing: { after: 40 },
        }),
      );
    }
    tableRows = [];
    inTable = false;
  };

  const parseInline = (text: string): TextRun[] => {
    // **bold** + texto comum
    const runs: TextRun[] = [];
    const regex = /\*\*([^*]+)\*\*/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      if (m.index > last) runs.push(new TextRun({ text: text.slice(last, m.index) }));
      runs.push(new TextRun({ text: m[1], bold: true }));
      last = m.index + m[0].length;
    }
    if (last < text.length) runs.push(new TextRun({ text: text.slice(last) }));
    return runs.length ? runs : [new TextRun({ text })];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Tabela markdown
    if (/^\s*\|.*\|\s*$/.test(line)) {
      inTable = true;
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      flushTable();
    }

    if (!line.trim()) {
      out.push(new Paragraph({ children: [new TextRun("")] }));
      continue;
    }

    if (line.startsWith("# ")) {
      out.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.LEFT,
          children: parseInline(line.slice(2)),
          spacing: { before: 240, after: 160 },
        }),
      );
    } else if (line.startsWith("## ")) {
      out.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: parseInline(line.slice(3)),
          spacing: { before: 200, after: 120 },
        }),
      );
    } else if (line.startsWith("### ")) {
      out.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: parseInline(line.slice(4)),
          spacing: { before: 160, after: 100 },
        }),
      );
    } else if (/^\s*[-*]\s+/.test(line)) {
      out.push(
        new Paragraph({
          children: [new TextRun({ text: "• " }), ...parseInline(line.replace(/^\s*[-*]\s+/, ""))],
          indent: { left: 360 },
          spacing: { after: 60 },
        }),
      );
    } else if (/^\s*\d+\.\s+/.test(line)) {
      out.push(
        new Paragraph({
          children: parseInline(line.trim()),
          indent: { left: 360 },
          spacing: { after: 60 },
        }),
      );
    } else {
      out.push(
        new Paragraph({
          children: parseInline(line),
          spacing: { after: 100 },
        }),
      );
    }
  }
  flushTable();
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const { reuniao_id } = await req.json();
    if (!reuniao_id) throw new Error("reuniao_id é obrigatório");

    const { data: r, error } = await admin
      .from("reuniao")
      .select("*")
      .eq("id", reuniao_id)
      .single();
    if (error || !r) throw new Error("Reunião não encontrada");

    const dadosReuniao = {
      titulo: r.titulo,
      tipo: r.tipo,
      status: r.status,
      data_reuniao: r.data_reuniao,
      duracao_min: r.duracao_min,
      participantes: r.participantes ?? [],
      participantes_detectados: r.participantes_detectados ?? [],
      pauta: r.pauta ?? "",
      resumo: r.resumo ?? "",
      decisoes: r.decisoes ?? [],
      proximos_passos: r.proximos_passos ?? "",
      transcricao: (r.transcricao ?? "").slice(0, 80000),
    };

    // Chama Lovable AI Gateway
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content:
              `Gere o relatório detalhado em markdown para a reunião abaixo.\n\n` +
              `DADOS DA REUNIÃO (JSON):\n\`\`\`json\n${JSON.stringify(dadosReuniao, null, 2)}\n\`\`\``,
          },
        ],
      }),
    });

    if (aiRes.status === 429) throw new Error("Limite de requisições à IA atingido. Aguarde alguns segundos.");
    if (aiRes.status === 402) throw new Error("Créditos da IA esgotados. Contate o administrador.");
    if (!aiRes.ok) {
      const t = await aiRes.text();
      throw new Error(`Falha na IA (${aiRes.status}): ${t.slice(0, 300)}`);
    }

    const aiJson = await aiRes.json();
    const markdown: string = aiJson.choices?.[0]?.message?.content ?? "";
    if (!markdown.trim()) throw new Error("IA retornou conteúdo vazio");

    // Monta DOCX
    const doc = new Document({
      creator: "Sistema de Reuniões",
      title: `Relatório — ${r.titulo}`,
      styles: {
        default: { document: { run: { font: "Calibri", size: 22 } } },
      },
      sections: [
        {
          properties: {
            page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } },
          },
          children: mdToDocx(markdown),
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    const safeTitle = (r.titulo || "reuniao")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 60);
    const dateStr = new Date(r.data_reuniao).toISOString().slice(0, 10);
    const filename = `Relatorio_${safeTitle}_${dateStr}.docx`;

    return new Response(buffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    console.error("gerar-relatorio-reuniao error:", e);
    return new Response(
      JSON.stringify({ error: String(e?.message ?? e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
