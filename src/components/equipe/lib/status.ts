import type { Colaborador, EventoTipo, StatusKey } from "./types";

function toMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface ComputedStatus {
  key: StatusKey;
  detail?: string;
  eventoTipo?: EventoTipo;
}

export function computeStatus(c: Colaborador, now: Date = new Date()): ComputedStatus {
  const today = ymd(now);

  // Férias (período)
  const feriasAtiva = c.colaborador_ferias?.find(
    (f) => f.data_inicio <= today && f.data_fim >= today,
  );
  if (feriasAtiva) return { key: "ferias", detail: "Em férias" };

  // Evento de hoje
  const evHoje = c.colaborador_evento?.find((e) => e.data === today);
  if (evHoje && evHoje.tipo !== "atraso") {
    return { key: "evento", detail: evHoje.tipo, eventoTipo: evHoje.tipo };
  }

  // Horário do dia
  const dia = now.getDay();
  const h = c.colaborador_horario?.find((x) => x.dia_semana === dia);
  if (!h) return { key: "fora" };

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const ei = toMinutes(h.expediente_inicio);
  const ef = toMinutes(h.expediente_fim);
  if (ei == null || ef == null || nowMin < ei || nowMin >= ef) {
    return { key: "fora" };
  }

  const ai = toMinutes(h.almoco_inicio);
  const af = toMinutes(h.almoco_fim);
  if (ai != null && af != null && nowMin >= ai && nowMin < af) {
    return { key: "almoco", detail: h.local_almoco ?? undefined };
  }

  return { key: "trabalhando" };
}

export function isOnVacation(c: Colaborador, dateISO: string): boolean {
  return !!c.colaborador_ferias?.find(
    (f) => f.data_inicio <= dateISO && f.data_fim >= dateISO,
  );
}

export function eventOn(c: Colaborador, dateISO: string) {
  return c.colaborador_evento?.find((e) => e.data === dateISO);
}

export function ymdOf(d: Date): string {
  return ymd(d);
}
