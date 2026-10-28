import { api } from "../api";

/**
 * Remuneração e feedback.
 *
 * Registro salarial, não folha de pagamento. E o dado mais sensível do
 * módulo: a permissão `people.salario:*` não entra em nenhum perfil padrão.
 */

const BASE = "/v1/people";

export const MOTIVOS_SALARIO = [
  { value: "admissao",      label: "Admissão" },
  { value: "merito",        label: "Mérito" },
  { value: "promocao",      label: "Promoção" },
  { value: "dissidio",      label: "Dissídio" },
  { value: "enquadramento", label: "Enquadramento" },
  { value: "reducao",       label: "Redução" },
  { value: "outro",         label: "Outro" },
] as const;

export type MotivoSalario = (typeof MOTIVOS_SALARIO)[number]["value"];
export type PosicaoNaFaixa = "sem_faixa" | "abaixo" | "dentro" | "acima";

export type RegistroSalarial = {
  id: string;
  valor: number;
  vigenciaInicio: string;
  motivo: MotivoSalario;
  observacoes: string | null;
  /** Null na admissão: não há com o que comparar. */
  variacaoPercentual: number | null;
  cargo: string | null;
};

export type SituacaoSalarial = {
  vigente: {
    valor: number;
    vigenciaInicio: string;
    motivo: MotivoSalario;
    mesesDesdeMudanca: number;
  } | null;
  /** Preenchido só quando passa da janela de alerta. */
  semReajusteHa: number | null;
  faixa: {
    id: string; titulo: string;
    minimo: number | null; medio: number | null; maximo: number | null;
    posicao: PosicaoNaFaixa;
    percentual: number | null;
  } | null;
  historico: RegistroSalarial[];
};

export type PainelSalarial = {
  escopoOrganizacional: boolean;
  massaSalarial: number;
  mediaSalarial: number;
  comSalarioRegistrado: number;
  janelaMesesSemReajuste: number;
  foraDaFaixa: {
    collaboratorId: string; nome: string; cargo: string | null;
    valor: number; posicao: PosicaoNaFaixa; limite: number | null;
  }[];
  semReajuste: {
    collaboratorId: string; nome: string; cargo: string | null;
    meses: number; desde: string;
  }[];
};

export type FaixaCargo = {
  id: string;
  titulo: string;
  nivel: string | null;
  colaboradores: number;
  minimo: number | null;
  medio: number | null;
  maximo: number | null;
  /** Falso quando o cargo não tem nenhum dos três valores. */
  definida: boolean;
};

export const salaryService = {
  async situacao(collaboratorId: string): Promise<{ success: boolean; data: SituacaoSalarial }> {
    const { data } = await api.get(`${BASE}/employees/${collaboratorId}/salario`);
    return data;
  },

  async registrar(
    collaboratorId: string,
    payload: { valor: number; vigenciaInicio: string; motivo: MotivoSalario; observacoes?: string },
  ) {
    const corpo: Record<string, unknown> = {
      valor: payload.valor,
      vigenciaInicio: payload.vigenciaInicio,
      motivo: payload.motivo,
    };
    if (payload.observacoes?.trim()) corpo.observacoes = payload.observacoes.trim();
    const { data } = await api.post(`${BASE}/employees/${collaboratorId}/salario`, corpo);
    return data;
  },

  async excluir(id: string) {
    const { data } = await api.delete(`${BASE}/salarios/${id}`);
    return data;
  },

  async faixas(): Promise<{ success: boolean; data: FaixaCargo[] }> {
    const { data } = await api.get(`${BASE}/cargos/faixas`, { silent: true });
    return data;
  },

  async definirFaixa(
    positionId: string,
    faixa: { minimo?: number | null; medio?: number | null; maximo?: number | null },
  ) {
    // `null` limpa a faixa; `undefined` seria descartado e não limparia nada.
    const { data } = await api.put(`${BASE}/cargos/${positionId}/faixa`, {
      minimo: faixa.minimo ?? null,
      medio: faixa.medio ?? null,
      maximo: faixa.maximo ?? null,
    });
    return data;
  },

  async painel(): Promise<{ success: boolean; data: PainelSalarial }> {
    const { data } = await api.get(`${BASE}/salarios/painel`, { silent: true });
    return data;
  },
};

/* ── Feedback ─────────────────────────────────────────────────────────────── */

export const TIPOS_FEEDBACK = [
  { value: "elogio",         label: "Elogio" },
  { value: "correcao",       label: "Ponto de correção" },
  { value: "um_a_um",        label: "1:1" },
  { value: "reconhecimento", label: "Reconhecimento" },
  { value: "outro",          label: "Outro" },
] as const;

export type TipoFeedback = (typeof TIPOS_FEEDBACK)[number]["value"];

export type Feedback = {
  id: string;
  tipo: TipoFeedback;
  visibilidade: "privado" | "compartilhado";
  conteudo: string;
  ocorridoEm: string;
  ciclo: string | null;
  autorNome: string | null;
};

export const feedbackService = {
  async listar(collaboratorId: string): Promise<{ success: boolean; data: Feedback[] }> {
    const { data } = await api.get(`${BASE}/employees/${collaboratorId}/feedbacks`);
    return data;
  },

  async criar(
    collaboratorId: string,
    payload: {
      tipo: TipoFeedback; conteudo: string;
      ocorridoEm?: string; visibilidade?: string; autorId?: string;
    },
  ) {
    const corpo: Record<string, unknown> = {
      tipo: payload.tipo,
      conteudo: payload.conteudo.trim(),
    };
    if (payload.ocorridoEm) corpo.ocorridoEm = payload.ocorridoEm;
    if (payload.visibilidade) corpo.visibilidade = payload.visibilidade;
    if (payload.autorId) corpo.autorId = payload.autorId;
    const { data } = await api.post(`${BASE}/employees/${collaboratorId}/feedbacks`, corpo);
    return data;
  },

  async excluir(id: string) {
    const { data } = await api.delete(`${BASE}/feedbacks/${id}`);
    return data;
  },
};
