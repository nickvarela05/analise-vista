/**
 * Preferência de animações (26/10/2026). Por padrão o Nexus segue o pedido de "menos movimento"
 * do sistema. Em computadores de empresa (Citrix, efeitos visuais do Windows desligados pela TI)
 * esse pedido vem ligado sem a pessoa ter escolhido, e o Nexus ficava sem nenhuma animação. Aqui
 * cada pessoa decide: seguir o sistema, sempre animar ou nunca animar. A escolha vira uma classe
 * no <html> (movimento-sempre / movimento-nunca), que o CSS usa.
 */
export type PreferenciaMovimento = "sistema" | "sempre" | "nunca";

const CHAVE = "nexus-animacoes";

export function lerPreferenciaMovimento(): PreferenciaMovimento {
  if (typeof window === "undefined") return "sistema";
  try {
    const v = localStorage.getItem(CHAVE);
    return v === "sempre" || v === "nunca" ? v : "sistema";
  } catch {
    return "sistema";
  }
}

export function aplicarPreferenciaMovimento(p: PreferenciaMovimento = lerPreferenciaMovimento()) {
  if (typeof document === "undefined") return;
  const raiz = document.documentElement;
  raiz.classList.toggle("movimento-sempre", p === "sempre");
  raiz.classList.toggle("movimento-nunca", p === "nunca");
}

export function salvarPreferenciaMovimento(p: PreferenciaMovimento) {
  try {
    localStorage.setItem(CHAVE, p);
  } catch {
    /* navegador sem armazenamento: vale só nesta visita */
  }
  aplicarPreferenciaMovimento(p);
}

/** O sistema (Windows/navegador) está pedindo menos movimento? */
export function sistemaPedeMenosMovimento() {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/** Animações devem ficar desligadas agora? Considera a escolha da pessoa antes do sistema. */
export function menosMovimento() {
  const p = lerPreferenciaMovimento();
  if (p === "sempre") return false;
  if (p === "nunca") return true;
  return sistemaPedeMenosMovimento();
}
