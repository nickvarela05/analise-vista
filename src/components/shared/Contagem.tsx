import * as React from "react";

/**
 * Número que "conta" até o valor ao aparecer e ao mudar (pedido do Nickolas, 23/10/2026).
 * Leve: um requestAnimationFrame por número, só enquanto anima, escrevendo direto no DOM (sem
 * re-render do React a cada quadro). Aceita número ou texto que começa com número ("2,5 dias",
 * "18 h"): só a parte numérica anima, com as mesmas casas decimais. Texto sem número ("—")
 * aparece como está. Quem pede menos movimento no sistema vê o valor final direto.
 */
const DURACAO_MS = 700;
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

function formatar(n: number, casas: number, virgula: boolean) {
  const s = n.toFixed(casas);
  return virgula ? s.replace(".", ",") : s;
}

const menosMovimento = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function Contagem({ valor, className }: { valor: number | string; className?: string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const atual = React.useRef(0);
  const partes = separar(valor);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || !partes) return;
    const { alvo, casas, virgula, resto } = partes;
    const de = atual.current;
    if (menosMovimento() || de === alvo) {
      atual.current = alvo;
      el.textContent = formatar(alvo, casas, virgula) + resto;
      return;
    }
    let quadro = 0;
    const inicio = performance.now();
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / DURACAO_MS);
      const suave = 1 - Math.pow(1 - t, 3); // desacelera no fim
      const n = de + (alvo - de) * suave;
      atual.current = n;
      el.textContent = formatar(t < 1 && casas === 0 ? Math.round(n) : n, casas, virgula) + resto;
      if (t < 1) quadro = requestAnimationFrame(passo);
      else atual.current = alvo;
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partes?.alvo, partes?.casas, partes?.resto]);

  if (!partes) return <span className={className}>{valor}</span>;
  // O primeiro quadro já sai do zero; o valor final fica no rótulo acessível.
  return (
    <span ref={ref} className={className} aria-label={String(valor)}>
      {formatar(0, partes.casas, partes.virgula) + partes.resto}
    </span>
  );
}
