import { api } from "../api";

/**
 * Plano de carreira.
 *
 * A trilha ordena CARGOS do catálogo — não existe nível dentro do cargo. O que
 * a tela precisa mostrar não é o desenho da trilha, e sim o que falta para o
 * próximo degrau.
 */

const BASE = "/v1/people/carreira";

export const NIVEIS_COMPETENCIA = [
  { value: "junior",       label: "Júnior" },
  { value: "pleno",        label: "Pleno" },
  { value: "senior",       label: "Sênior" },
  { value: "especialista", label: "Especialista" },
] as const;

export type NivelCompetencia = (typeof NIVEIS_COMPETENCIA)[number]["value"];

export const TIPOS_REQUISITO = [
  { value: "competencia", label: "Competência" },
  { value: "treinamento", label: "Treinamento" },
  { value: "manual",      label: "Conferência manual" },
] as const;

export type TipoRequisito = (typeof TIPOS_REQUISITO)[number]["value"];

export type SituacaoRequisito = "atendido" | "pendente" | "conferencia_manual";

export type Requisito = {
  id: string;
  tipo: TipoRequisito;
  obrigatorio: boolean;
  skillId: string | null;
  nivelMinimo: NivelCompetencia | null;
  trainingId: string | null;
  descricao: string | null;
  skill?: { id: string; nome: string } | null;
  training?: { id: string; nome: string } | null;
};

export type Degrau = {
  id: string;
  ordem: number;
  positionId: string;
  mesesMinimos: number | null;
  notaMinima: number | null;
  observacoes: string | null;
  position?: { id: string; titulo: string; nivel: string | null } | null;
  requisitos: Requisito[];
  /** Quantas pessoas ocupam este cargo hoje. */
  colaboradores?: number;
};

export type Trilha = {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  degraus: Degrau[];
};

/* ── Situação do colaborador ──────────────────────────────────────────────── */

export type RequisitoAvaliado = Requisito & {
  situacao: SituacaoRequisito;
  nivelAtual: NivelCompetencia | null;
  skillNome: string | null;
  trainingNome: string | null;
};

export type CriterioDegrau = {
  rotulo: string;
  situacao: SituacaoRequisito;
  detalhe: string;
};

export type Prontidao = {
  requisitos: RequisitoAvaliado[];
  criterios: CriterioDegrau[];
  percentual: number;
  pronto: boolean;
  conferenciasManuais: number;
};

export type SituacaoCarreira = {
  trilha: { id: string; nome: string; descricao: string | null } | null;
  /** Verdadeiro quando a trilha foi deduzida do cargo, não atribuída. */
  inferida: boolean;
  /** Por que não há trilha — preenchido só quando `trilha` é nulo. */
  motivo: string | null;
  noTopo?: boolean;
  foraDaTrilha?: boolean;
  mesesNoCargo?: number | null;
  desdeNoCargo?: string | null;
  ultimaNota?: number | null;
  totalDegraus?: number;
  degraus?: {
    id: string; ordem: number; cargo: string | null; nivel: string | null;
    atual: boolean; mesesMinimos: number | null; notaMinima: number | null;
    totalRequisitos: number;
  }[];
  degrauAtual: { id: string; ordem: number; cargo: string | null } | null;
  proximoDegrau: { id: string; ordem: number; cargo: string | null; observacoes: string | null } | null;
  prontidao: Prontidao | null;
};

export const careerService = {
  async trilhas(incluirInativas = false): Promise<{ success: boolean; data: Trilha[] }> {
    const { data } = await api.get(`${BASE}/trilhas`, {
      params: incluirInativas ? { incluirInativas: "true" } : {},
      silent: true,
    });
    return data;
  },

  async salvarTrilha(id: string | null, dados: { nome: string; descricao?: string; ativo?: boolean }) {
    const corpo: Record<string, unknown> = { nome: dados.nome.trim() };
    if (dados.descricao?.trim()) corpo.descricao = dados.descricao.trim();
    if (dados.ativo !== undefined) corpo.ativo = dados.ativo;
    const { data } = id
      ? await api.put(`${BASE}/trilhas/${id}`, corpo)
      : await api.post(`${BASE}/trilhas`, corpo);
    return data;
  },

  async excluirTrilha(id: string) {
    const { data } = await api.delete(`${BASE}/trilhas/${id}`);
    return data;
  },

  async adicionarDegrau(
    trackId: string,
    dados: { positionId: string; mesesMinimos?: number | null; notaMinima?: number | null; observacoes?: string },
  ) {
    const { data } = await api.post(`${BASE}/trilhas/${trackId}/degraus`, montarDegrau(dados));
    return data;
  },

  async atualizarDegrau(
    id: string,
    dados: { positionId: string; mesesMinimos?: number | null; notaMinima?: number | null; observacoes?: string },
  ) {
    const { data } = await api.put(`${BASE}/degraus/${id}`, montarDegrau(dados));
    return data;
  },

  async removerDegrau(id: string) {
    const { data } = await api.delete(`${BASE}/degraus/${id}`);
    return data;
  },

  async reordenar(trackId: string, ids: string[]) {
    const { data } = await api.patch(`${BASE}/trilhas/${trackId}/ordem`, { ids });
    return data;
  },

  async adicionarRequisito(
    stepId: string,
    dados: {
      tipo: TipoRequisito; skillId?: string; nivelMinimo?: string;
      trainingId?: string; descricao?: string; obrigatorio?: boolean;
    },
  ) {
    const corpo: Record<string, unknown> = { tipo: dados.tipo };
    // Só o alvo do próprio tipo vai: a ValidationPipe roda com
    // forbidNonWhitelisted, e campo vazio de outro tipo derruba a requisição.
    if (dados.tipo === "competencia") {
      if (dados.skillId) corpo.skillId = dados.skillId;
      if (dados.nivelMinimo) corpo.nivelMinimo = dados.nivelMinimo;
    }
    if (dados.tipo === "treinamento" && dados.trainingId) corpo.trainingId = dados.trainingId;
    if (dados.descricao?.trim()) corpo.descricao = dados.descricao.trim();
    if (dados.obrigatorio !== undefined) corpo.obrigatorio = dados.obrigatorio;

    const { data } = await api.post(`${BASE}/degraus/${stepId}/requisitos`, corpo);
    return data;
  },

  async removerRequisito(id: string) {
    const { data } = await api.delete(`${BASE}/requisitos/${id}`);
    return data;
  },

  async situacao(collaboratorId: string): Promise<{ success: boolean; data: SituacaoCarreira }> {
    const { data } = await api.get(`/v1/people/employees/${collaboratorId}/carreira`, { silent: true });
    return data;
  },

  /**
   * Promove para um degrau da trilha — o que, na prática, troca o cargo.
   *
   * A prontidão NÃO é pré-requisito: o sistema calcula o que falta, quem decide
   * é gente. O item que mais pesa numa promoção costuma ser justamente o de
   * conferência manual.
   */
  async promover(collaboratorId: string, stepId: string, motivo?: string) {
    const corpo: Record<string, unknown> = { stepId };
    if (motivo?.trim()) corpo.motivo = motivo.trim();
    const { data } = await api.post(`/v1/people/employees/${collaboratorId}/carreira/promover`, corpo);
    return data;
  },

  async definirTrilha(collaboratorId: string, careerTrackId: string | null) {
    // `null` explícito desfaz a atribuição; omitir não desfaria nada.
    const { data } = await api.put(`/v1/people/employees/${collaboratorId}/carreira`, { careerTrackId });
    return data;
  },
};

function montarDegrau(dados: {
  positionId: string; mesesMinimos?: number | null; notaMinima?: number | null; observacoes?: string;
}) {
  const corpo: Record<string, unknown> = { positionId: dados.positionId };
  if (dados.mesesMinimos != null) corpo.mesesMinimos = dados.mesesMinimos;
  if (dados.notaMinima != null) corpo.notaMinima = dados.notaMinima;
  if (dados.observacoes?.trim()) corpo.observacoes = dados.observacoes.trim();
  return corpo;
}
