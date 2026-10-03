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

const VAZIO = { sistema: null, tarefa: null, observacao: null, link: null, dataHml: null };

/** Junta um item ao mapa; número repetido soma os sistemas (ex.: 9069 em "GED" e em um app). */
function adicionar(porNumero: Map<string, ItemEmailHml>, item: ItemEmailHml) {
  const anterior = porNumero.get(item.numero);
  if (!anterior) {
    porNumero.set(item.numero, item);
    return;
  }
  if (item.sistema && anterior.sistema && !anterior.sistema.includes(item.sistema)) {
    anterior.sistema = `${anterior.sistema} / ${item.sistema}`;
  }
  anterior.sistema ??= item.sistema;
  anterior.tarefa ??= item.tarefa;
  anterior.observacao ??= item.observacao;
  anterior.link ??= item.link;
  anterior.dataHml ??= item.dataHml;
}

const CABECALHOS = new Set(["data de hml", "sistema", "numero", "tarefa", "observacao", "link"]);
const semAcento = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/**
 * Tabela colada como texto puro, uma célula por linha (visto em 03/10/2026). A ordem é a da
 * tabela: [data] [sistema] número tarefa [link…] [observação…]. A linha logo antes de cada
 * número é o sistema daquela tarefa; o que fica entre o título e esse sistema pertence à tarefa
 * anterior (links e observação). Depois de uma data nova, texto solto antes do sistema é ignorado
 * (ex.: "novos", escrito na coluna da data).
 */
function parsePorLinha(linhas: string[]): Map<string, ItemEmailHml> {
  const porNumero = new Map<string, ItemEmailHml>();
  let data: string | null = null;
  let ultimoSistema: string | null = null;
  let atual: ItemEmailHml | null = null;
  let esperandoTitulo = false;
  let pendentes: string[] = [];

  const fecharPendentes = (proximoTemNumero: boolean): string | null => {
    // A última linha antes do número é o sistema da próxima tarefa.
    let sistema: string | null = null;
    if (proximoTemNumero) {
      const ultima = pendentes[pendentes.length - 1];
      if (ultima && !RE_LINK.test(ultima) && !dataParaIso(ultima)) {
        sistema = ultima;
        pendentes = pendentes.slice(0, -1);
      }
    }
    let depoisDeData = false;
    for (const l of pendentes) {
      const iso = dataParaIso(l);
      if (iso) {
        data = iso;
        depoisDeData = true;
      } else if (RE_LINK.test(l) && atual && !depoisDeData) {
        if (!atual.link) atual.link = l.match(RE_LINK)![0];
        else atual.observacao = atual.observacao ? `${atual.observacao} ${l}` : l;
      } else if (atual && !depoisDeData) {
        atual.observacao = atual.observacao ? `${atual.observacao} ${l}` : l;
      }
    }
    pendentes = [];
    return sistema;
  };

  for (const l of linhas) {
    if (CABECALHOS.has(semAcento(l))) continue;
    if (RE_NUMERO.test(l)) {
      const sistema: string | null = fecharPendentes(true) ?? ultimoSistema;
      ultimoSistema = sistema;
      if (atual) adicionar(porNumero, atual);
      atual = { ...VAZIO, numero: l, sistema, dataHml: data };
      esperandoTitulo = true;
      continue;
    }
    if (esperandoTitulo && atual && !RE_LINK.test(l) && !dataParaIso(l)) {
      atual.tarefa = l;
      esperandoTitulo = false;
      continue;
    }
    pendentes.push(l);
  }
  fecharPendentes(false);
  if (atual) adicionar(porNumero, atual);
  return porNumero;
}

/**
 * Lê o texto colado e devolve os itens do pacote. Aceita três formas: uma linha por tarefa com
 * células separadas por tabulação (cópia normal de tabela), uma célula por linha (cópia que
 * perdeu a tabulação) e uma lista simples de números.
 * @param texto Texto colado do e-mail.
 * @returns `itens` sem repetição de número e `ignoradas`, a contagem de linhas com conteúdo
 *   em que nenhum número de tarefa foi encontrado (cabeçalho, saudação etc.). No formato de
 *   uma célula por linha, `ignoradas` é sempre 0.
 */
export function parseEmailHomologacao(texto: string): { itens: ItemEmailHml[]; ignoradas: number } {
  const linhas = texto.split(/\r?\n/).map(limpar).filter(Boolean);
  const umaCelulaPorLinha =
    !texto.includes("\t") &&
    linhas.some((l) => RE_NUMERO.test(l)) &&
    linhas.some((l) => /[a-zà-ú]/i.test(l) && !CABECALHOS.has(semAcento(l)));
  if (umaCelulaPorLinha) {
    return { itens: Array.from(parsePorLinha(linhas).values()), ignoradas: 0 };
  }

  const porNumero = new Map<string, ItemEmailHml>();
  let ignoradas = 0;
  let ultimaData: string | null = null;
  let ultimoSistema: string | null = null;

  for (const bruta of texto.split(/\r?\n/)) {
    if (!bruta.trim()) continue;
    // Lista digitada à mão ("9083, 9208; 9453"): cada número é uma tarefa, sem outros dados.
    if (/^[\d\s,;]+$/.test(bruta)) {
      for (const numero of bruta.match(/\d{3,6}/g) ?? []) {
        if (!porNumero.has(numero)) porNumero.set(numero, { ...VAZIO, numero });
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

    adicionar(porNumero, {
      numero: celulas[idx],
      sistema,
      tarefa: textos[0] ?? null,
      observacao: textos.slice(1).join(" ") || null,
      link,
      dataHml: data,
    });
  }
  return { itens: Array.from(porNumero.values()), ignoradas };
}
