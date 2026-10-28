import { api } from "../api";

/**
 * Checklist de admissão e desligamento.
 *
 * Responde "o que falta para essa pessoa entrar (ou sair)?" com nome, dono e
 * prazo de cada pendência.
 */

const BASE = "/v1/people/checklists";

export const EVENTOS = [
  { value: "admissao",     label: "Admissão" },
  { value: "desligamento", label: "Desligamento" },
] as const;

export type EventoChecklist = (typeof EVENTOS)[number]["value"];

export const RESPONSAVEIS = [
  { value: "rh",          label: "RH" },
  { value: "gestor",      label: "Gestor" },
  { value: "colaborador", label: "Colaborador" },
] as const;

export type Responsavel = (typeof RESPONSAVEIS)[number]["value"];
export type SituacaoItem = "concluido" | "pendente" | "atrasado";

export type ItemChecklist = {
  id: string;
  ordem: number;
  titulo: string;
  descricao: string | null;
  responsavel: Responsavel;
  obrigatorio: boolean;
  prazoDias: number | null;
  concluidoEm: string | null;
  observacoes: string | null;
  situacao: SituacaoItem;
  /** Negativo quando o prazo já passou; nulo quando não há prazo. */
  diasParaPrazo: number | null;
};

export type Checklist = {
  id: string;
  evento: EventoChecklist;
  nome: string;
  iniciadoEm: string;
  concluidoEm: string | null;
  itens: ItemChecklist[];
  total: number;
  concluidos: number;
  percentual: number;
  completo: boolean;
  atrasados: number;
};

export type ModeloChecklist = {
  id: string;
  nome: string;
  evento: EventoChecklist;
  descricao: string | null;
  ativo: boolean;
  itens: {
    id: string; ordem: number; titulo: string; descricao: string | null;
    responsavel: Responsavel; obrigatorio: boolean; prazoDias: number | null;
  }[];
};

export type PainelChecklists = {
  escopoOrganizacional: boolean;
  total: number;
  comAtraso: number;
  checklists: {
    id: string; evento: EventoChecklist; nome: string; iniciadoEm: string;
    colaborador: { id: string; nome: string };
    percentual: number; pendentes: number; atrasados: number;
  }[];
};

export const checklistService = {
  async modelos(incluirInativos = false): Promise<{ success: boolean; data: ModeloChecklist[] }> {
    const { data } = await api.get(`${BASE}/modelos`, {
      params: incluirInativos ? { incluirInativos: "true" } : {},
      silent: true,
    });
    return data;
  },

  async salvarModelo(
    id: string | null,
    dados: { nome: string; evento: EventoChecklist; descricao?: string; ativo?: boolean },
  ) {
    const corpo: Record<string, unknown> = { nome: dados.nome.trim(), evento: dados.evento };
    if (dados.descricao?.trim()) corpo.descricao = dados.descricao.trim();
    if (dados.ativo !== undefined) corpo.ativo = dados.ativo;
    const { data } = id
      ? await api.put(`${BASE}/modelos/${id}`, corpo)
      : await api.post(`${BASE}/modelos`, corpo);
    return data;
  },

  async excluirModelo(id: string) {
    const { data } = await api.delete(`${BASE}/modelos/${id}`);
    return data;
  },

  async adicionarItemModelo(
    templateId: string,
    dados: {
      titulo: string; descricao?: string; responsavel?: Responsavel;
      obrigatorio?: boolean; prazoDias?: number | null;
    },
  ) {
    const corpo: Record<string, unknown> = { titulo: dados.titulo.trim() };
    if (dados.descricao?.trim()) corpo.descricao = dados.descricao.trim();
    if (dados.responsavel) corpo.responsavel = dados.responsavel;
    if (dados.obrigatorio !== undefined) corpo.obrigatorio = dados.obrigatorio;
    if (dados.prazoDias != null) corpo.prazoDias = dados.prazoDias;
    const { data } = await api.post(`${BASE}/modelos/${templateId}/itens`, corpo);
    return data;
  },

  async removerItemModelo(id: string) {
    const { data } = await api.delete(`${BASE}/modelos/itens/${id}`);
    return data;
  },

  async doColaborador(collaboratorId: string): Promise<{ success: boolean; data: Checklist[] }> {
    const { data } = await api.get(`/v1/people/employees/${collaboratorId}/checklists`, { silent: true });
    return data;
  },

  async abrir(collaboratorId: string, evento: EventoChecklist, templateId?: string) {
    const corpo: Record<string, unknown> = { evento };
    if (templateId) corpo.templateId = templateId;
    const { data } = await api.post(`/v1/people/employees/${collaboratorId}/checklists`, corpo);
    return data;
  },

  async marcarItem(itemId: string, concluido: boolean, observacoes?: string) {
    const corpo: Record<string, unknown> = { concluido };
    if (observacoes !== undefined) corpo.observacoes = observacoes;
    const { data } = await api.patch(`${BASE}/itens/${itemId}`, corpo);
    return data;
  },

  async excluir(id: string) {
    const { data } = await api.delete(`${BASE}/${id}`);
    return data;
  },

  async painel(): Promise<{ success: boolean; data: PainelChecklists }> {
    const { data } = await api.get(`${BASE}/painel`, { silent: true });
    return data;
  },
};
