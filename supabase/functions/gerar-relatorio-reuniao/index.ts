// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  AlignmentType,
  Header,
  Footer,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  PageNumber,
  PageBreak,
  LevelFormat,
  VerticalAlign,
} from "https://esm.sh/docx@8.5.0";
import { corsFor } from "../_shared/cors.ts";
import { requireUser, assertReuniaoAccess } from "../_shared/auth.ts";
import { LOGO_BASE64 } from "../_shared/logo.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

// ────────────────────────────────────────────────────────────────────────────
// Identidade visual
// ────────────────────────────────────────────────────────────────────────────
const BRAND = {
  primary: "1F4E79", // azul corporativo
  primaryLight: "D9E2F3",
  text: "1F2937",
  muted: "6B7280",
  border: "CBD5E1",
  accent: "0EA5E9",
};

const LOGO_BYTES = Uint8Array.from(atob(LOGO_BASE64), (c) => c.charCodeAt(0));

// ────────────────────────────────────────────────────────────────────────────
// Prompt — sem "Pessoas Mencionadas", sem repetições, foco analítico
// ────────────────────────────────────────────────────────────────────────────
const CONTEXTO_NEGOCIO = `
CONTEXTO DA EMPRESA:
- Prestadora de serviço em SISTEMAS DE GESTÃO EDUCACIONAL (ERP/SaaS para escolas, faculdades e instituições de ensino).
- Área: ANÁLISE DE REQUISITOS — levantamento, refinamento, documentação e validação com clientes e times de produto/desenvolvimento.
- Termos do domínio: matrícula/rematrícula, secretaria acadêmica, diário de classe, boletim, contrato educacional, mensalidade, inadimplência, ENADE/INEP/MEC, integração com gateway de pagamento, LGPD para dados de menores, calendário letivo, turmas, disciplinas, currículo, histórico escolar, BNCC.
`.trim();

const SYSTEM_PROMPT = `Você é um analista de requisitos sênior em uma empresa de sistemas de gestão educacional.

${CONTEXTO_NEGOCIO}

TAREFA:
Gerar um RELATÓRIO PROFISSIONAL em português a partir dos dados de UMA reunião (título, data, participantes, pauta, resumo, decisões, próximos passos e — quando houver — transcrição). O documento será diagramado externamente; você produz APENAS o conteúdo analítico em markdown, sem cabeçalho de identificação (nome do cliente, data, participantes etc.) — esses dados são renderizados pelo sistema em uma capa estruturada e NÃO devem ser repetidos por você.

DIRETRIZES OBRIGATÓRIAS:
1. NÃO repita informações já presentes na capa: título, data, duração, tipo, participantes, responsáveis. Comece direto pela seção "Contexto e Objetivo".
2. NÃO transcreva falas literais nem cite "fulano disse que...". Linguagem executiva e analítica.
3. Seja DETALHADO: explique contexto, motivação e impacto. Evite frases genéricas.
4. Detalhe regras de negócio, fluxos, integrações, telas, perfis de usuário e dados sensíveis (LGPD) em seções próprias quando aparecerem.
5. Se algo não estiver claro, marque "⚠️ A confirmar com o cliente" — nunca invente fatos, números, prazos ou nomes.
6. Markdown limpo: ## para seções principais, ### para subseções, listas com - e numeradas, **negrito** em termos-chave. NÃO use # (título principal — já existe na capa).
7. Para a seção "Próximos Passos", use SEMPRE uma tabela markdown com colunas: Ação | Responsável | Prazo | Status.
8. Omita seções inteiras quando não houver conteúdo real (não escreva "sem registros" — apenas pule a seção). EXCEÇÃO: a seção "Contexto e Objetivo" é sempre obrigatória.

ESTRUTURA (use exatamente estes títulos, nesta ordem; pule seções vazias exceto Contexto e Objetivo):

## Contexto e Objetivo
2 a 4 parágrafos explicando por que a reunião aconteceu e o que se pretendia alcançar.

## Pauta Detalhada
Expanda cada item da pauta em parágrafo descritivo enriquecido com contexto do domínio educacional. Não copie a pauta crua.

## Pontos-Chave Discutidos
Para cada tópico relevante:
- **Tópico:** nome
- **Descrição:** o que foi tratado e por quê
- **Impacto:** consequência para produto/cliente/cronograma

## Requisitos e Regras de Negócio
Use formato:
- **RF-XX / RNF-XX / RN-XX:** descrição clara, completa e testável.

## Decisões Tomadas
Cada decisão em item próprio, com a decisão E sua justificativa.

## Riscos, Premissas e Dependências
- **Riscos:** o que pode dar errado e como mitigar.
- **Premissas:** o que estamos assumindo como verdadeiro.
- **Dependências:** de quem/do quê o avanço depende.

## Próximos Passos
Tabela markdown obrigatória: | Ação | Responsável | Prazo | Status |

## Pendências e Pontos em Aberto
Itens que precisam de retorno do cliente ou validação pendente.

## Observações Finais
Recomendações adicionais do analista.

REGRA DE OURO: detalhe sem inventar; não repita o que já está na capa.`;

// ────────────────────────────────────────────────────────────────────────────
// Helpers de formatação docx
// ────────────────────────────────────────────────────────────────────────────
const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: BRAND.border };
const cellBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

function parseInline(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) runs.push(new TextRun({ text: text.slice(last, m.index), color: BRAND.text }));
    runs.push(new TextRun({ text: m[1], bold: true, color: BRAND.text }));
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push(new TextRun({ text: text.slice(last), color: BRAND.text }));
  return runs.length ? runs : [new TextRun({ text, color: BRAND.text })];
}

function makeTable(rows: string[][]): Table {
  if (rows.length === 0) return new Table({ rows: [] });
  const cols = rows[0].length;
  const tableWidth = 9360;
  const colWidth = Math.floor(tableWidth / cols);
  const widths = new Array(cols).fill(colWidth);

  const trows = rows.map((r, i) => {
    const isHeader = i === 0;
    return new TableRow({
      tableHeader: isHeader,
      children: r.map((cellText, j) => {
        return new TableCell({
          width: { size: widths[j], type: WidthType.DXA },
          borders: cellBorders,
          shading: isHeader
            ? { fill: BRAND.primary, type: ShadingType.CLEAR, color: "auto" }
            : i % 2 === 0
              ? { fill: "F8FAFC", type: ShadingType.CLEAR, color: "auto" }
              : undefined,
          margins: { top: 100, bottom: 100, left: 140, right: 140 },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              spacing: { before: 0, after: 0 },
              children: isHeader
                ? [new TextRun({ text: cellText, bold: true, color: "FFFFFF", size: 20 })]
                : parseInline(cellText),
            }),
          ],
        });
      }),
    });
  });

  return new Table({
    width: { size: tableWidth, type: WidthType.DXA },
    columnWidths: widths,
    rows: trows,
  });
}

// Conversor markdown → blocos docx (Paragraph | Table)
function mdToDocx(md: string): (Paragraph | Table)[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: (Paragraph | Table)[] = [];
  let tableBuf: string[][] | null = null;

  const flushTable = () => {
    if (!tableBuf) return;
    // Remove linha separadora |---|---|
    const cleaned = tableBuf.filter((r) => !r.every((c) => /^-{2,}:?$|^:?-{2,}:?$|^:?-{2,}$/.test(c.trim())));
    out.push(makeTable(cleaned));
    out.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    tableBuf = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (/^\s*\|.*\|\s*$/.test(line)) {
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      if (!tableBuf) tableBuf = [];
      tableBuf.push(cells);
      continue;
    } else if (tableBuf) {
      flushTable();
    }

    if (!line.trim()) {
      out.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
      continue;
    }

    if (line.startsWith("# ")) {
      // ignora — título principal vem da capa
      continue;
    } else if (line.startsWith("## ")) {
      out.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: line.slice(3), bold: true, color: BRAND.primary, size: 28 })],
          spacing: { before: 320, after: 140 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: BRAND.primary, space: 4 } },
        }),
      );
    } else if (line.startsWith("### ")) {
      out.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [new TextRun({ text: line.slice(4), bold: true, color: BRAND.text, size: 24 })],
          spacing: { before: 220, after: 100 },
        }),
      );
    } else if (/^\s*[-*]\s+/.test(line)) {
      out.push(
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: parseInline(line.replace(/^\s*[-*]\s+/, "")),
          spacing: { after: 60 },
        }),
      );
    } else if (/^\s*\d+\.\s+/.test(line)) {
      out.push(
        new Paragraph({
          numbering: { reference: "numbers", level: 0 },
          children: parseInline(line.replace(/^\s*\d+\.\s+/, "")),
          spacing: { after: 60 },
        }),
      );
    } else {
      out.push(
        new Paragraph({
          children: parseInline(line),
          spacing: { after: 100 },
          alignment: AlignmentType.JUSTIFIED,
        }),
      );
    }
  }
  flushTable();
  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// Capa (informações gerais — fonte única da verdade)
// ────────────────────────────────────────────────────────────────────────────
function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtParticipantes(list: any): string {
  if (!Array.isArray(list) || list.length === 0) return "—";
  return list
    .map((p: any) => {
      if (typeof p === "string") return p;
      if (p && typeof p === "object") return p.nome ?? p.name ?? p.email ?? JSON.stringify(p);
      return String(p);
    })
    .join(", ");
}

function buildCapa(r: any): (Paragraph | Table)[] {
  const blocks: (Paragraph | Table)[] = [];

  // Título
  blocks.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 0, after: 60 },
      children: [
        new TextRun({ text: "RELATÓRIO DE REUNIÃO", bold: true, color: BRAND.muted, size: 20 }),
      ],
    }),
  );
  blocks.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 0, after: 240 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 16, color: BRAND.primary, space: 6 } },
      children: [
        new TextRun({ text: r.titulo ?? "Reunião sem título", bold: true, color: BRAND.primary, size: 40 }),
      ],
    }),
  );

  // Tabela de informações gerais
  const rows: [string, string][] = [
    ["Data e horário", fmtDate(r.data_reuniao)],
    ["Duração", r.duracao_min ? `${r.duracao_min} min` : "—"],
    ["Tipo", r.tipo ?? "—"],
    ["Status", r.status ?? "—"],
    ["Participantes", fmtParticipantes(r.participantes)],
  ];

  const infoTable = new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2600, 6760],
    rows: rows.map(([k, v], i) => new TableRow({
      children: [
        new TableCell({
          width: { size: 2600, type: WidthType.DXA },
          borders: cellBorders,
          shading: { fill: BRAND.primaryLight, type: ShadingType.CLEAR, color: "auto" },
          margins: { top: 100, bottom: 100, left: 140, right: 140 },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({
            spacing: { before: 0, after: 0 },
            children: [new TextRun({ text: k, bold: true, color: BRAND.primary, size: 20 })],
          })],
        }),
        new TableCell({
          width: { size: 6760, type: WidthType.DXA },
          borders: cellBorders,
          shading: i % 2 === 0 ? undefined : { fill: "F8FAFC", type: ShadingType.CLEAR, color: "auto" },
          margins: { top: 100, bottom: 100, left: 140, right: 140 },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({
            spacing: { before: 0, after: 0 },
            children: [new TextRun({ text: v, color: BRAND.text, size: 20 })],
          })],
        }),
      ],
    })),
  });
  blocks.push(infoTable);
  blocks.push(new Paragraph({ spacing: { after: 240 }, children: [] }));

  return blocks;
}

// ────────────────────────────────────────────────────────────────────────────
// Header / Footer
// ────────────────────────────────────────────────────────────────────────────
function buildHeader(): Header {
  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 60 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: BRAND.primary, space: 4 } },
        children: [
          new ImageRun({
            type: "png",
            data: LOGO_BYTES,
            transformation: { width: 90, height: 30 },
            altText: { title: "Sisteplan", description: "Logo Sisteplan", name: "logo" },
          }),
          new TextRun({ text: "\t" }),
          new TextRun({ text: "Relatório de Reunião", color: BRAND.muted, size: 18, italics: true }),
        ],
        tabStops: [{ type: "right" as any, position: 9360 }],
      }),
    ],
  });
}

function buildFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60 },
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: BRAND.border, space: 4 } },
        children: [
          new TextRun({ text: "Sisteplan · Análise de Requisitos · ", color: BRAND.muted, size: 16 }),
          new TextRun({ text: "Página ", color: BRAND.muted, size: 16 }),
          new TextRun({ children: [PageNumber.CURRENT], color: BRAND.muted, size: 16 }),
          new TextRun({ text: " de ", color: BRAND.muted, size: 16 }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], color: BRAND.muted, size: 16 }),
        ],
      }),
    ],
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Handler
// ────────────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const user = await requireUser(req);
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const { reuniao_id, modelo } = await req.json();
    if (!reuniao_id) throw new Error("reuniao_id é obrigatório");
    const aiModel = modelo === "pro" ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";

    await assertReuniaoAccess(admin, user.id, reuniao_id);

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
      pauta: r.pauta ?? "",
      resumo: r.resumo ?? "",
      decisoes: r.decisoes ?? [],
      proximos_passos: r.proximos_passos ?? "",
      transcricao: truncateMiddle(r.transcricao ?? "", 40000),
    };

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content:
              `Gere o conteúdo analítico (sem repetir capa) para a reunião abaixo.\n\n` +
              `DADOS (JSON):\n\`\`\`json\n${JSON.stringify(dadosReuniao, null, 2)}\n\`\`\``,
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

    const children: (Paragraph | Table)[] = [
      ...buildCapa(r),
      ...mdToDocx(markdown),
    ];

    const doc = new Document({
      creator: "Sisteplan — Sistema de Reuniões",
      title: `Relatório — ${r.titulo}`,
      styles: {
        default: {
          document: { run: { font: "Calibri", size: 22, color: BRAND.text } },
        },
      },
      numbering: {
        config: [
          {
            reference: "bullets",
            levels: [{
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 540, hanging: 280 } } },
            }],
          },
          {
            reference: "numbers",
            levels: [{
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 540, hanging: 280 } } },
            }],
          },
        ],
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838 }, // A4
              margin: { top: 1440, right: 1134, bottom: 1134, left: 1134 },
            },
          },
          headers: { default: buildHeader() },
          footers: { default: buildFooter() },
          children,
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
    if (e instanceof Response) return e;
    console.error("gerar-relatorio-reuniao error:", e);
    return new Response(
      JSON.stringify({ error: String(e?.message ?? e) }),
      { status: 500, headers: { ...corsFor(req), "Content-Type": "application/json" } },
    );
  }
});
