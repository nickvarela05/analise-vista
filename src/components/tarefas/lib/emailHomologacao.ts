/**
 * Leitura da tabela do e-mail "Segue as tarefas disponíveis para testes em homologação".
 *
 * O e-mail é a fonte da verdade do pacote: o status do E-project não bate com ele (em
 * 28/09/2026 a planilha tinha 128 tarefas "Em Homologação" e o e-mail listava 31). Com a
 * tabela colada, a importação filtra a planilha sozinha e guarda no card o que antes se
 * perdia: sistema, observação, link do ambiente e data de homologação.
 *
 * A tabela varia (coluna a mais, células mescladas, ordem), então a leitura não depende da
 * posição das colunas: em cada linha acha o número da tarefa e classifica as outras células
 * pelo conteúdo (data, link, texto).
 */

export type ItemEmailHml = {
  numero: string;
  sistema: string | null;
  tarefa: string | null;
  observacao: string | null;
  link: string | null;
  /** Data de homologação em ISO (AAAA-MM-DD). */
  dataHml: string | null;
};

const RE_NUMERO = /^\d{3,6}$/;
const RE_DATA = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/;
const RE_LINK = /https?:\/\/\S+/i;

function limpar(s: string): string {
  return s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

function dataParaIso(s: string): string | null {
  const m = s.match(RE_DATA);
  if (!m) return null;
  const dia = m[1].padStart(2, "0");
  const mes = m[2].padStart(2, "0");
  const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${ano}-${mes}-${dia}`;
}

/**
 * Converte a tabela HTML que o Outlook põe na área de transferência em texto separado por
 * tabulação, repetindo o conteúdo das células mescladas (rowspan/colspan) em cada linha.
 * Sem isso, "MAED" mesclado em 3 linhas só apareceria na primeira.
 * @returns O texto da maior tabela encontrada, ou `null` se o HTML não tiver tabela.
 */
export function tabelaHtmlParaTsv(html: string): string | null {
  if (typeof DOMParser === "undefined") return null;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const tabelas = Array.from(doc.querySelectorAll("table"));
  if (tabelas.length === 0) return null;
  // Tabelas de layout do Outlook podem envolver a de dados; fica a que tem mais linhas
  // próprias sem conter outra tabela.
  const candidatas = tabelas.filter((t) => !t.querySelector("table"));
  const tabela = (candidatas.length ? candidatas : tabelas).reduce((a, b) =>
    b.rows.length > a.rows.length ? b : a,
  );

  const grade: string[][] = [];
  Array.from(tabela.rows).forEach((tr, r) => {
    grade[r] ??= [];
    let c = 0;
    Array.from(tr.cells).forEach((td) => {
      while (grade[r][c] !== undefined) c++;
      let texto = limpar(td.textContent ?? "");
      // Link só no href (texto do tipo "clique aqui"): mantém o endereço.
      const a = td.querySelector("a[href]");
      const href = a?.getAttribute("href") ?? "";
      if (href && /^https?:/i.test(href) && !RE_LINK.test(texto)) {
        // Se a célula é só o texto do link, fica só o endereço ("clique aqui" não é observação).
        texto = !texto || texto === limpar(a?.textContent ?? "") ? href : `${texto} ${href}`;
      }
      const linhas = Math.max(1, td.rowSpan || 1);
      const colunas = Math.max(1, td.colSpan || 1);
      for (let i = 0; i < linhas; i++) {
        grade[r + i] ??= [];
        for (let j = 0; j < colunas; j++) grade[r + i][c + j] = texto;
      }
      c += colunas;
    });
  });
  return grade.map((linha) => Array.from(linha, (v) => v ?? "").join("\t")).join("\n");
}

/**
 * Lê o texto colado (uma linha por tarefa, células separadas por tabulação) e devolve os
 * itens do pacote. Aceita também uma lista simples de números.
 * @param texto Texto colado do e-mail.
 * @returns `itens` sem repetição de número e `ignoradas`, a contagem de linhas com conteúdo
 *   em que nenhum número de tarefa foi encontrado (cabeçalho, saudação etc.).
 */
export function parseEmailHomologacao(texto: string): { itens: ItemEmailHml[]; ignoradas: number } {
  const porNumero = new Map<string, ItemEmailHml>();
  let ignoradas = 0;
  let ultimaData: string | null = null;
  let ultimoSistema: string | null = null;

  for (const bruta of texto.split(/\r?\n/)) {
    if (!bruta.trim()) continue;
    // Lista digitada à mão ("9083, 9208; 9453"): cada número é uma tarefa, sem outros dados.
    if (/^[\d\s,;]+$/.test(bruta)) {
      for (const numero of bruta.match(/\d{3,6}/g) ?? []) {
        if (!porNumero.has(numero)) {
          porNumero.set(numero, { numero, sistema: null, tarefa: null, observacao: null, link: null, dataHml: null });
        }
      }
      continue;
    }
    const celulas = bruta.split("\t").map(limpar);
    const idx = celulas.findIndex((c) => RE_NUMERO.test(c));
    if (idx === -1) {
      ignoradas++;
      continue;
    }

    let data: string | null = null;
    let sistema: string | null = null;
    for (const c of celulas.slice(0, idx)) {
      if (!c) continue;
      const iso = dataParaIso(c);
      if (iso) data = iso;
      else sistema = c;
    }
    // A data também pode vir depois do número, se a tabela mudar de ordem.
    const depois = celulas.slice(idx + 1).filter(Boolean);
    data ??= depois.map(dataParaIso).find(Boolean) ?? null;
    // Célula mesclada em tabela colada como texto: vale o último valor visto.
    data ??= ultimaData;
    sistema ??= ultimoSistema;
    ultimaData = data;
    ultimoSistema = sistema;

    const resto = depois.filter((c) => !RE_DATA.test(c));
    const comLink = resto.find((c) => RE_LINK.test(c));
    const link = comLink?.match(RE_LINK)?.[0] ?? null;
    const textos = resto
      .map((c) => (c === comLink ? limpar(c.replace(RE_LINK, "")) : c))
      // Célula que ocupa duas colunas chega repetida: fica uma vez só.
      .filter((c, i, todos) => Boolean(c) && todos.indexOf(c) === i);

    const numero = celulas[idx];
    const item: ItemEmailHml = {
      numero,
      sistema,
      tarefa: textos[0] ?? null,
      observacao: textos.slice(1).join(" ") || null,
      link,
      dataHml: data,
    };

    const anterior = porNumero.get(numero);
    if (!anterior) {
      porNumero.set(numero, item);
    } else {
      // Mesma tarefa em dois sistemas (ex.: 9069 em "GED" e "App - Aluno - Prof").
      if (item.sistema && anterior.sistema && !anterior.sistema.includes(item.sistema)) {
        anterior.sistema = `${anterior.sistema} / ${item.sistema}`;
      }
      anterior.sistema ??= item.sistema;
      anterior.observacao ??= item.observacao;
      anterior.link ??= item.link;
      anterior.dataHml ??= item.dataHml;
    }
  }
  return { itens: Array.from(porNumero.values()), ignoradas };
}
