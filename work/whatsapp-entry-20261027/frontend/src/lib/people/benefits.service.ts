import { api } from "../api";

/**
 * Benefícios — catálogo da organização e concessão à pessoa.
 *
 * Concessão nunca é apagada: encerrar preenche a data de fim. O histórico de
 * quem teve o quê e quando sustenta folha, rescisão e auditoria.
 */

const BASE = "/v1/people";

export const CATEGORIAS_BENEFICIO = [
  { value: "saude",       label: "Saúde" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "transporte",  label: "Transporte" },
  { value: "educacao",    label: "Educação" },
  { value: "previdencia", label: "Previdência" },
  { value: "bem_estar",   label: "Bem-estar" },
  { value: "outro",       label: "Outro" },
] as const;

export type CategoriaBeneficio = (typeof CATEGORIAS_BENEFICIO)[number]["value"];

export type Beneficio = {
  id: string;
  nome: string;
  categoria: CategoriaBeneficio;
  descricao: string | null;
  valorReferencia: number | null;
  ativo: boolean;
  concessoes: number;
};

export type Concessao = {
  id: string;
  inicio: string;
  fim: string | null;
  valor: number | null;
  observacoes: string | null;
  vigente: boolean;
  benefit: { id: string; nome: string; categoria: string };
};

export type DadosBeneficio = {
  nome: string;
  categoria: CategoriaBeneficio;
  descricao?: string;
  valorReferencia?: number | null;
  ativo?: boolean;
};

function limpar(d: DadosBeneficio): Record<string, unknown> {
  const corpo: Record<string, unknown> = { nome: d.nome.trim(), categoria: d.categoria };
  if (d.descricao?.trim()) corpo.descricao = d.descricao.trim();
  // `null` limpa o valor; `undefined` não mexe. Diferente de string vazia,
  // que o backend rejeitaria no @IsNumber.
  if (d.valorReferencia !== undefined && d.valorReferencia !== null) {
    corpo.valorReferencia = d.valorReferencia;
  }
  if (d.ativo !== undefined) corpo.ativo = d.ativo;
  return corpo;
}

export const benefitsService = {
  async catalogo(incluirInativos = false): Promise<{ success: boolean; data: Beneficio[] }> {
    const { data } = await api.get(`${BASE}/beneficios`, {
      params: { incluirInativos: String(incluirInativos) },
    });
    return data;
  },

  async criar(dados: DadosBeneficio) {
    const { data } = await api.post(`${BASE}/beneficios`, limpar(dados));
    return data;
  },

  async atualizar(id: string, dados: DadosBeneficio) {
    const { data } = await api.put(`${BASE}/beneficios/${id}`, limpar(dados));
    return data;
  },

  async alternarAtivo(id: string, atual: Beneficio, ativo: boolean) {
    const { data } = await api.put(`${BASE}/beneficios/${id}`, {
      nome: atual.nome, categoria: atual.categoria, ativo,
    });
    return data;
  },

  async excluir(id: string) {
    const { data } = await api.delete(`${BASE}/beneficios/${id}`);
    return data;
  },

  async doColaborador(collaboratorId: string): Promise<{
    success: boolean;
    data: { itens: Concessao[]; custoMensalVigente: number };
  }> {
    const { data } = await api.get(`${BASE}/employees/${collaboratorId}/beneficios`);
    return data;
  },

  async conceder(
    collaboratorId: string,
    payload: { benefitId: string; inicio: string; fim?: string; valor?: number; observacoes?: string },
  ) {
    const corpo: Record<string, unknown> = {
      benefitId: payload.benefitId,
      inicio: payload.inicio,
    };
    if (payload.fim) corpo.fim = payload.fim;
    if (payload.valor !== undefined && payload.valor !== null) corpo.valor = payload.valor;
    if (payload.observacoes?.trim()) corpo.observacoes = payload.observacoes.trim();

    const { data } = await api.post(`${BASE}/employees/${collaboratorId}/beneficios`, corpo);
    return data;
  },

  async encerrar(concessaoId: string, fim: string, observacoes?: string) {
    const corpo: Record<string, unknown> = { fim };
    if (observacoes?.trim()) corpo.observacoes = observacoes.trim();
    const { data } = await api.put(`${BASE}/beneficios/concessoes/${concessaoId}/encerrar`, corpo);
    return data;
  },
};
