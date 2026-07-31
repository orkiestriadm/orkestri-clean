import { api } from "../api";

/**
 * Catálogo de cargos.
 *
 * Antes do People, `cargo` era texto livre — "Analista de Sistemas", "analista
 * de sistemas" e "Analista Sistemas" viravam três coisas diferentes, e nenhuma
 * análise por cargo era possível. O catálogo resolve isso daqui para frente; os
 * textos que já existem entram pela importação.
 */

const BASE = "/v1/people/cargos";

export type Cargo = {
  id: string;
  titulo: string;
  codigo: string | null;
  descricao: string | null;
  nivel: string | null;
  ativo: boolean;
  /** Quantos colaboradores estão neste cargo — trava a exclusão. */
  colaboradores: number;
};

/** Texto de cargo ainda não vinculado a um cargo do catálogo. */
export type CargoSolto = { cargo: string; total: number };

export type DadosCargo = {
  titulo: string;
  codigo?: string;
  descricao?: string;
  nivel?: string;
  ativo?: boolean;
};

/** Campo vazio derruba a validação do backend; ausente, não. */
function limpar(dados: DadosCargo): Record<string, unknown> {
  const corpo: Record<string, unknown> = { titulo: dados.titulo.trim() };
  for (const campo of ["codigo", "descricao", "nivel"] as const) {
    const valor = dados[campo]?.trim();
    if (valor) corpo[campo] = valor;
  }
  if (dados.ativo !== undefined) corpo.ativo = dados.ativo;
  return corpo;
}

export const positionsService = {
  async listar(incluirInativos = false): Promise<{ success: boolean; data: Cargo[] }> {
    const { data } = await api.get(BASE, { params: { incluirInativos: String(incluirInativos) } });
    return data;
  },

  async criar(dados: DadosCargo) {
    const { data } = await api.post(BASE, limpar(dados));
    return data;
  },

  async atualizar(id: string, dados: DadosCargo) {
    const { data } = await api.put(`${BASE}/${id}`, limpar(dados));
    return data;
  },

  /** Só desativa — o backend recusa excluir cargo em uso. */
  async alternarAtivo(id: string, cargo: Cargo, ativo: boolean) {
    const { data } = await api.put(`${BASE}/${id}`, { titulo: cargo.titulo, ativo });
    return data;
  },

  async excluir(id: string) {
    const { data } = await api.delete(`${BASE}/${id}`);
    return data;
  },

  /**
   * `silent`: exige `cargo:gerenciar`, permissão mais forte que a da tela. Quem
   * só consulta o catálogo recebe 403 aqui, e um toast de erro por isso seria
   * ruído — a seção simplesmente não aparece.
   */
  async soltos(): Promise<{ success: boolean; data: CargoSolto[] }> {
    const { data } = await api.get(`${BASE}/soltos`, { silent: true });
    return data;
  },

  async importar(titulos: string[]): Promise<{
    success: boolean;
    data: { titulo: string; criado: boolean; vinculados: number }[];
  }> {
    const { data } = await api.post(`${BASE}/importar`, { titulos });
    return data;
  },
};
