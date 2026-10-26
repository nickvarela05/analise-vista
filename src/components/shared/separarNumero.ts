/** Separa o número do começo de um valor ("2,5 dias" → 2.5, 1 casa, vírgula, " dias"). Usado pela Contagem. */
const NUMERO_NO_INICIO = /^(-?\d+(?:[.,]\d+)?)(.*)$/s;

export function separar(
  valor: number | string,
): { alvo: number; casas: number; virgula: boolean; resto: string } | null {
  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) return null;
    const casas = Number.isInteger(valor)
      ? 0
      : Math.min(2, String(valor).split(".")[1]?.length ?? 0);
    return { alvo: valor, casas, virgula: false, resto: "" };
  }
  const m = NUMERO_NO_INICIO.exec(valor);
  if (!m) return null;
  const virgula = m[1].includes(",");
  const casas = m[1].split(/[.,]/)[1]?.length ?? 0;
  return { alvo: Number(m[1].replace(",", ".")), casas, virgula, resto: m[2] };
}
