/**
 * Agrupamento padrão de colaboradores por equipe.
 * Usado em filtros, comboboxes de atribuição e qualquer seletor de colaborador.
 */

export type ColabMin = { id: string; nome: string; cargo?: string | null };

export const EQUIPES: { label: string; nomes: string[] }[] = [
  {
    label: "Equipe de Análise",
    nomes: ["nickolas", "felipe pino", "matheus", "hugo", "ewerton", "pietro"],
  },
  {
    label: "Equipe HELP-DESK",
    nomes: [
      "larice",
      "karyna",
      "simone",
      "fellipe lourenço",
      "fellipe lourenco",
      "felipe lourenço",
      "felipe lourenco",
    ],
  },
  {
    label: "Equipe Técnica de Suporte",
    nomes: ["silvia", "ketlyn"],
  },
];

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

export function agruparColaboradoresPorEquipe<T extends ColabMin>(
  colaboradores: T[],
): { grupos: { label: string; items: T[] }[]; outros: T[] } {
  const usados = new Set<string>();
  const grupos = EQUIPES.map((g) => {
    const vistos = new Set<string>();
    const items: T[] = [];
    g.nomes.forEach((alvo) => {
      const a = norm(alvo);
      const found = colaboradores.find((c) => {
        const n = norm(c.nome);
        return n === a || n.startsWith(a + " ") || n.includes(" " + a);
      });
      if (found && !vistos.has(found.id)) {
        vistos.add(found.id);
        items.push(found);
      }
    });
    items.forEach((c) => usados.add(c.id));
    return { label: g.label, items };
  });
  const outros = colaboradores.filter((c) => !usados.has(c.id));
  return { grupos, outros };
}
