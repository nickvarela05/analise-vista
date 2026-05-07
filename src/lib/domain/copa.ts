/**
 * Regras puras de ocupação da copa.
 *
 * Premissas:
 * - Cada colaborador permanece na copa apenas os PRIMEIROS `COPA_WINDOW_MIN`
 *   minutos do horário de almoço, ainda que o almoço total seja maior.
 * - A capacidade física da copa é `COPA_CAPACIDADE` pessoas simultâneas.
 */

export const COPA_CAPACIDADE = 3;
export const COPA_WINDOW_MIN = 30;

export interface SlotEntrada {
  colaborador_id: string;
  /** início do almoço em minutos desde 00:00 */
  ai: number;
  /** fim do almoço em minutos desde 00:00 */
  af: number;
  local: "Copa" | "Fora";
}

export interface OcupacaoSlot {
  min: number;
  count: number;
  ids: string[];
}

/**
 * Janela efetiva de presença na copa para um almoço.
 * Retorna `null` quando o local é "Fora".
 */
export function janelaCopa(
  e: Pick<SlotEntrada, "ai" | "af" | "local">,
  windowMin: number = COPA_WINDOW_MIN,
): { ai: number; af: number } | null {
  if (e.local !== "Copa") return null;
  return { ai: e.ai, af: Math.min(e.af, e.ai + windowMin) };
}

/**
 * Gera a curva de ocupação da copa em fatias de `snap` minutos
 * dentro do intervalo [iniMin, fimMin).
 */
export function ocupacaoCopa(
  edits: SlotEntrada[],
  iniMin: number,
  fimMin: number,
  snap: number,
  windowMin: number = COPA_WINDOW_MIN,
): OcupacaoSlot[] {
  const slots: OcupacaoSlot[] = [];
  for (let m = iniMin; m < fimMin; m += snap) {
    const ocup = edits.filter((e) => {
      const j = janelaCopa(e, windowMin);
      if (!j) return false;
      return j.ai <= m && j.af > m;
    });
    slots.push({
      min: m,
      count: ocup.length,
      ids: ocup.map((e) => e.colaborador_id),
    });
  }
  return slots;
}

/**
 * Slots em que a capacidade da copa é excedida.
 */
export function slotsExcedidos(
  slots: OcupacaoSlot[],
  capacidade: number = COPA_CAPACIDADE,
): OcupacaoSlot[] {
  return slots.filter((s) => s.count > capacidade);
}
