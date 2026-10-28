import { api } from "../api";

/**
 * Acesso à API do Orkiestri People.
 *
 * FRONTEND.md §11 proíbe chamada de API espalhada em componente: o caminho é
 * componente → hook → serviço → api. Este é o único arquivo do frontend que
 * conhece as rotas do People.
 *
 * Rotas versionadas (`/v1/people/...`) conforme PEOPLE_API.md §3. O `baseURL`
 * do axios já inclui `/api`.
 */

const BASE = "/v1/people/employees";

export type StatusColaborador = "ATIVO" | "INATIVO" | "AFASTADO" | "DESLIGADO" | "SUSPENSO";

export type ColaboradorLista = {
  id: string;
  matricula: string | null;
  nomeCompleto: string | null;
  nomeExibicao: string;
  emailCorporativo: string | null;
  telefone: string | null;
  celular: string | null;
  fotoUrl: string | null;
  cargo: string | null;
  status: StatusColaborador;
  ativo: boolean;
  dataAdmissao: string | null;
  userId: string | null;
  user: { id: string; nome: string; email: string; ativo: boolean } | null;
  setor: { id: string; nome: string; cor: string | null } | null;
  position: { id: string; titulo: string; nivel: string | null } | null;
  gestor: { id: string; nomeCompleto: string | null; user: { nome: string } | null } | null;
};

export type ColaboradorDetalhe = ColaboradorLista & {
  emailPessoal: string | null;
  dataNascimento: string | null;
  genero: string | null;
  estadoCivil: string | null;
  nacionalidade: string | null;
  dataDesligamento: string | null;
  departamento: string | null;
  squad: string | null;
  especialidade: string | null;
  senioridade: string | null;
  jornadaHorasDia: number | null;
  jornadaHorasMes: number | null;
  turno: string | null;
  escala: string | null;
  tipoVinculo: string | null;
  liderados: {
    id: string;
    nomeCompleto: string | null;
    /** Texto livre do cadastro antigo — nulo em quem já usa o catálogo. */
    cargo: string | null;
    position: { titulo: string } | null;
    user: { nome: string } | null;
  }[];
  enderecos: EnderecoColaborador[];
  contatos: ContatoColaborador[];
};

export type EnderecoColaborador = {
  id: string; tipo: string; cep: string | null; logradouro: string | null;
  numero: string | null; complemento: string | null; bairro: string | null;
  cidade: string | null; estado: string | null; pais: string; principal: boolean;
};

export type ContatoColaborador = {
  id: string; nome: string; parentesco: string | null;
  telefone: string | null; email: string | null; emergencia: boolean;
};

export type EventoHistorico = {
  id: string; evento: string; campo: string | null;
  valorAnterior: string | null; valorNovo: string | null;
  descricao: string | null; vigenciaEm: string | null; registradoEm: string;
};

export type FiltrosColaboradores = {
  busca?: string;
  status?: StatusColaborador | "";
  setorId?: string;
  positionId?: string;
  gestorId?: string;
  pagina?: number;
  tamanho?: number;
  ordenarPor?: string;
  direcao?: "asc" | "desc";
};

export type RespostaPaginada<T> = {
  success: boolean;
  data: T[];
  meta: { total: number; pagina: number; tamanho: number; paginas: number };
};

/** Remove chaves vazias — a ValidationPipe do backend rejeita string vazia em @IsIn. */
function limpar(filtros: FiltrosColaboradores): Record<string, unknown> {
  const saida: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor === undefined || valor === null || valor === "") continue;
    saida[chave] = valor;
  }
  return saida;
}

/**
 * Campos aceitos na criação e edição.
 *
 * `userId` só existe na criação: trocar o usuário vinculado de um colaborador
 * existente é operação à parte, não edição de cadastro.
 */
export type DadosColaborador = {
  userId?: string;
  nomeCompleto?: string;
  matricula?: string;
  emailCorporativo?: string;
  emailPessoal?: string;
  telefone?: string;
  celular?: string;
  dataNascimento?: string;
  genero?: string;
  estadoCivil?: string;
  nacionalidade?: string;
  dataAdmissao?: string;
  status?: StatusColaborador;
  cargo?: string;
  positionId?: string;
  setorId?: string;
  squad?: string;
  especialidade?: string;
  senioridade?: string;
  gestorId?: string;
  jornadaHorasDia?: number;
  jornadaHorasMes?: number;
  turno?: string;
  escala?: string;
  tipoVinculo?: string;
};

/**
 * Descarta campo vazio antes de enviar.
 *
 * A ValidationPipe do backend roda com `forbidNonWhitelisted` e valida formato:
 * mandar `emailPessoal: ""` derruba a requisição inteira em @IsEmail. Campo em
 * branco no formulário significa "não informado", não "string vazia".
 */
function apenasPreenchidos(dados: DadosColaborador): Record<string, unknown> {
  const saida: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(dados)) {
    if (valor === undefined || valor === null) continue;
    if (typeof valor === "string" && valor.trim() === "") continue;
    saida[chave] = typeof valor === "string" ? valor.trim() : valor;
  }
  return saida;
}

export const employeesService = {
  async listar(filtros: FiltrosColaboradores): Promise<RespostaPaginada<ColaboradorLista>> {
    const { data } = await api.get(BASE, { params: limpar(filtros) });
    return data;
  },

  async obter(id: string): Promise<{ success: boolean; data: ColaboradorDetalhe }> {
    const { data } = await api.get(`${BASE}/${id}`);
    return data;
  },

  async historico(id: string): Promise<{ success: boolean; data: EventoHistorico[] }> {
    const { data } = await api.get(`${BASE}/${id}/historico`);
    return data;
  },

  async criar(dados: DadosColaborador): Promise<{ success: boolean; data: ColaboradorLista }> {
    const { data } = await api.post(BASE, apenasPreenchidos(dados));
    return data;
  },

  async atualizar(id: string, dados: DadosColaborador): Promise<{ success: boolean; data: ColaboradorLista }> {
    const { userId, ...editaveis } = dados;
    const { data } = await api.put(`${BASE}/${id}`, apenasPreenchidos(editaveis));
    return data;
  },

  async mudarStatus(
    id: string,
    payload: { status: StatusColaborador; dataDesligamento?: string; motivo?: string },
  ) {
    const { data } = await api.patch(`${BASE}/${id}/status`, payload);
    return data;
  },

  /**
   * Exclusão LÓGICA — o registro sai das telas e continua no banco.
   *
   * Existe para desfazer cadastro criado por engano, não para desligar alguém:
   * quem saiu da empresa tem `dataDesligamento`, aparece no turnover e mantém a
   * ficha. Retenção legal impede exclusão física (docs/people/ADR-004 §3).
   */
  async excluir(id: string) {
    const { data } = await api.delete(`${BASE}/${id}`);
    return data;
  },
};
