import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Marca do Nexus: o "N" do ícone da aba, em degradê verde → ciano.
 * Substituiu o cubo da Sisteplan em 14/10/2026 (decisão do Nickolas: "Nexus, apenas").
 *
 * @param fundo Com o quadrado escuro arredondado (como o favicon); sem ele, só o "N".
 */
export function NexusMark({ className, fundo = false }: { className?: string; fundo?: boolean }) {
  const id = React.useId();
  return (
    <svg viewBox="0 0 64 64" className={cn("shrink-0", className)} role="img" aria-label="Nexus">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      {fundo && <rect width="64" height="64" rx="14" fill="#0b1220" />}
      <path d="M18 46V18h6l16 20V18h6v28h-6L24 26v20z" fill={`url(#${id})`} />
    </svg>
  );
}
