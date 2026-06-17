// Unificação de bairros duplicados (mesmo nome escrito de formas diferentes).
// Estratégia: chave canônica = uppercase + sem acentos + apenas alfanum.
// Em seguida, cluster por similaridade (Levenshtein <= 2) para tolerar pequenas
// variações de grafia (ex.: "ANHANGUERA" vs "ANHANGUERRA").
// O nome canônico exibido é o mais frequente do cluster (desempate: mais curto,
// depois ordem alfabética).

const stripKey = (s: string) =>
  s
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "");

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) dp[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = tmp;
    }
  }
  return dp[b.length];
}

function similarKeys(a: string, b: string): boolean {
  if (a === b) return true;
  const longer = Math.max(a.length, b.length);
  if (longer < 4) return false; // evitar fundir nomes muito curtos
  const d = levenshtein(a, b);
  // tolerância proporcional ao tamanho
  const tol = longer >= 10 ? 2 : 1;
  return d <= tol;
}

/**
 * Constrói um mapa { bairroOriginal -> bairroCanônico } unificando duplicatas.
 * Recebe a lista de bairros (com repetições) presente nos dados.
 */
export function buildBairroCanonMap(values: Array<string | null | undefined>): Map<string, string> {
  const counts = new Map<string, number>(); // original -> ocorrências
  for (const v of values) {
    if (!v) continue;
    const original = v.trim();
    if (!original) continue;
    counts.set(original, (counts.get(original) ?? 0) + 1);
  }

  type Cluster = { key: string; members: Array<{ name: string; count: number }> };
  const clusters: Cluster[] = [];

  // ordena por contagem desc para que nomes mais comuns "ancorem" o cluster
  const originals = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);

  for (const [name, count] of originals) {
    const key = stripKey(name);
    if (!key) continue;
    const found = clusters.find((c) => similarKeys(c.key, key));
    if (found) {
      found.members.push({ name, count });
    } else {
      clusters.push({ key, members: [{ name, count }] });
    }
  }

  const map = new Map<string, string>();
  for (const c of clusters) {
    const canonical = [...c.members].sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (a.name.length !== b.name.length) return a.name.length - b.name.length;
      return a.name.localeCompare(b.name, "pt-BR");
    })[0].name;
    for (const m of c.members) map.set(m.name, canonical);
  }
  return map;
}

export const canonBairro = (
  value: string | null | undefined,
  map: Map<string, string>,
): string | null => {
  if (!value) return null;
  const t = value.trim();
  if (!t) return null;
  return map.get(t) ?? t;
};
