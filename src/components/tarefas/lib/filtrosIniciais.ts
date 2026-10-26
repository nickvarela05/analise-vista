import type { TarefaFiltersState } from "../TarefaFilters";

/** Filtros do quadro de tarefas sem nada aplicado. */
export const initialFilters: TarefaFiltersState = {
  search: "",
  responsaveis: [],
  prioridades: [],
  prazo: "todos",
  comDemanda: "todos",
  origem: "todos",
  lotes: [],
  emTeste: false,
};
