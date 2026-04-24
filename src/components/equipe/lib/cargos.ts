export const CARGOS = [
  "Analista de Requisitos Júnior",
  "Analista de Requisitos Pleno",
  "Analista de Requisitos Sênior",
  "Coordenador de Requisitos (Gestor)",
  "Help-Desk",
  "Técnico de Suporte de TI",
] as const;

export type Cargo = (typeof CARGOS)[number];
