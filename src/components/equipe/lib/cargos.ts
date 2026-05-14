export const CARGOS = [
  "Estagiário",
  "Estagiário TI",
  "Analista de Requisitos Júnior",
  "Analista de Requisitos Pleno",
  "Analista de Requisitos Sênior",
  "Coordenador de Requisitos (Gestor)",
  "Gerente",
  "Help-Desk",
  "Técnico de Suporte de TI",
] as const;

export type Cargo = (typeof CARGOS)[number];
