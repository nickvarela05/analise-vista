import { describe, it, expect } from "vitest";
import {
  COPA_CAPACIDADE,
  COPA_WINDOW_MIN,
  janelaCopa,
  ocupacaoCopa,
  slotsExcedidos,
} from "../copa";

const T = (h: number, m = 0) => h * 60 + m;

describe("janelaCopa", () => {
  it("retorna null para almoço Fora", () => {
    expect(janelaCopa({ ai: T(12), af: T(13), local: "Fora" })).toBeNull();
  });

  it("limita a janela aos primeiros 30 min mesmo com almoço de 1h", () => {
    expect(janelaCopa({ ai: T(12), af: T(13), local: "Copa" })).toEqual({
      ai: T(12),
      af: T(12, 30),
    });
  });

  it("respeita almoços menores que a janela", () => {
    expect(janelaCopa({ ai: T(12), af: T(12, 20), local: "Copa" })).toEqual({
      ai: T(12),
      af: T(12, 20),
    });
  });

  it("usa COPA_WINDOW_MIN = 30 por padrão", () => {
    expect(COPA_WINDOW_MIN).toBe(30);
  });
});

describe("ocupacaoCopa", () => {
  it("não conta quem almoça Fora", () => {
    const slots = ocupacaoCopa(
      [{ colaborador_id: "a", ai: T(12), af: T(13), local: "Fora" }],
      T(11),
      T(15),
      5,
    );
    expect(slots.every((s) => s.count === 0)).toBe(true);
  });

  it("considera apenas os primeiros 30 min: 12:30-13:00 fica vazio", () => {
    const slots = ocupacaoCopa(
      [{ colaborador_id: "a", ai: T(12), af: T(13), local: "Copa" }],
      T(11),
      T(15),
      5,
    );
    const s1215 = slots.find((s) => s.min === T(12, 15))!;
    const s1230 = slots.find((s) => s.min === T(12, 30))!;
    const s1245 = slots.find((s) => s.min === T(12, 45))!;
    expect(s1215.count).toBe(1);
    expect(s1230.count).toBe(0);
    expect(s1245.count).toBe(0);
  });

  it("acumula múltiplas pessoas no mesmo slot", () => {
    const edits = [
      { colaborador_id: "a", ai: T(12), af: T(13), local: "Copa" as const },
      { colaborador_id: "b", ai: T(12, 10), af: T(13), local: "Copa" as const },
      { colaborador_id: "c", ai: T(12, 20), af: T(13), local: "Copa" as const },
    ];
    const slots = ocupacaoCopa(edits, T(11), T(15), 5);
    const s1225 = slots.find((s) => s.min === T(12, 25))!;
    expect(s1225.count).toBe(3);
    expect(s1225.ids.sort()).toEqual(["a", "b", "c"]);
  });
});

describe("slotsExcedidos", () => {
  it("identifica apenas slots acima da capacidade", () => {
    const edits = [
      { colaborador_id: "a", ai: T(12), af: T(13), local: "Copa" as const },
      { colaborador_id: "b", ai: T(12), af: T(13), local: "Copa" as const },
      { colaborador_id: "c", ai: T(12), af: T(13), local: "Copa" as const },
      { colaborador_id: "d", ai: T(12), af: T(13), local: "Copa" as const },
    ];
    const slots = ocupacaoCopa(edits, T(11), T(15), 5);
    const over = slotsExcedidos(slots, COPA_CAPACIDADE);
    // overflow apenas dentro da janela 12:00 - 12:30
    expect(over.length).toBeGreaterThan(0);
    expect(over.every((s) => s.count > COPA_CAPACIDADE)).toBe(true);
    expect(over.every((s) => s.min >= T(12) && s.min < T(12, 30))).toBe(true);
  });

  it("não acusa overflow se exatamente igual à capacidade", () => {
    const edits = [
      { colaborador_id: "a", ai: T(12), af: T(13), local: "Copa" as const },
      { colaborador_id: "b", ai: T(12), af: T(13), local: "Copa" as const },
      { colaborador_id: "c", ai: T(12), af: T(13), local: "Copa" as const },
    ];
    const slots = ocupacaoCopa(edits, T(11), T(15), 5);
    expect(slotsExcedidos(slots, COPA_CAPACIDADE)).toEqual([]);
  });
});
