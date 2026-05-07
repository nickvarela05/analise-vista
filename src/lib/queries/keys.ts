/**
 * Fonte única de verdade para as `queryKey` do React Query.
 *
 * Por que existir:
 * - Evita typos em strings espalhadas pelo código.
 * - Permite invalidations consistentes (`qc.invalidateQueries({ queryKey: qk.tarefas.all() })`).
 * - Facilita refatorações futuras sem precisar varrer o projeto.
 *
 * Compatibilidade: as strings de raiz são idênticas às que já circulam no projeto,
 * de modo que `qc.invalidateQueries({ queryKey: ["tarefas"] })` continua casando
 * com qualquer key derivada de `qk.tarefas.*`.
 */

export const qk = {
  // ---------- Dashboard ----------
  dash: {
    chamados: () => ["dash-chamados"] as const,
    tarefas: () => ["dash-tarefas"] as const,
    reunioes: () => ["dash-reunioes"] as const,
    avisos: () => ["dash-avisos"] as const,
    ferias: () => ["dash-ferias"] as const,
    colaboradores: () => ["dash-colaboradores"] as const,
    demandas: () => ["dash-demandas"] as const,
    solicitacoesRelatorios: () => ["dash-solicitacoes-relatorios"] as const,
    atribuicoes: () => ["dash-atribuicoes"] as const,
  },

  // ---------- Perfil/me ----------
  meuProfile: (userId: string | undefined | null) =>
    ["meu-profile", userId ?? null] as const,

  // ---------- Tarefas ----------
  tarefas: {
    all: () => ["tarefas"] as const,
    counts: () => ["tar-counts"] as const,
    colabs: () => ["tar-colabs"] as const,
    demandasMini: () => ["tar-demandas-mini"] as const,
  },

  // ---------- Demandas ----------
  demandas: {
    all: () => ["demandas-all"] as const,
    tarefaCounts: () => ["demandas-tarefa-counts"] as const,
    colabs: () => ["dem-colabs"] as const,
    tarefasDe: (demandaId: string | null | undefined) =>
      ["demanda-tarefas", demandaId ?? null] as const,
  },

  // ---------- Avisos ----------
  avisos: {
    all: () => ["avisos"] as const,
    colabs: () => ["av-colabs"] as const,
    leiturasDoUsuario: (userId: string | undefined | null) =>
      ["avisos-leituras", userId ?? null] as const,
    /** prefixo para invalidar leituras de qualquer usuário */
    leiturasPrefix: () => ["avisos-leituras"] as const,
    leiturasTodas: () => ["avisos-leituras-todas"] as const,
    bellAvisos: () => ["bell-avisos"] as const,
    bellLeituras: () => ["bell-leituras"] as const,
  },

  // ---------- Atividades (semanal) ----------
  atividades: {
    meuProfile: (userId: string | undefined | null) =>
      ["atv-meu-profile", userId ?? null] as const,
    tarefas: () => ["atv-tarefas"] as const,
    demandas: () => ["atv-demandas"] as const,
    reunioes: () => ["atv-reunioes"] as const,
  },

  // ---------- Equipe / Colaboradores ----------
  equipe: () => ["equipe"] as const,
  colaboradores: () => ["colaboradores"] as const,
  usuariosAdmin: () => ["usuarios-admin"] as const,

  // ---------- Relatórios ----------
  relatorios: {
    solicitacoes: () => ["solicitacoes-relatorios"] as const,
    colaboradores: () => ["relatorios-colaboradores"] as const,
  },
} as const;
