import { api } from "../api";

/** Treinamentos, certificações e avaliação de desempenho. */

const BASE = "/v1/people";

export type StatusTreinamento = "PLANEJADO" | "EM_ANDAMENTO" | "CONCLUIDO" | "CANCELADO";
export type SituacaoCertificacao = "sem_validade" | "vigente" | "vence_em_breve" | "vencida";
export type StatusAvaliacao = "RASCUNHO" | "FINALIZADA";

export type Curso = {
  id: string;
  nome: string;
  fornecedor: string | null;
  categoria: string;
  cargaHoraria: number | null;
  validadeMeses: number | null;
  descricao: string | null;
  ativo: boolean;
  participacoes: number;
};

export type Participacao = {
  id: string;
  status: StatusTreinamento;
  inicio: string | null;
  conclusao: string | null;
  validade: string | null;
  certificadoRef: string | null;
  nota: number | null;
  observacoes: string | null;
  situacaoCertificacao: SituacaoCertificacao;
  diasParaVencer: number | null;
  training: { id: string; nome: string; categoria: string; cargaHoraria: number | null; fornecedor: string | null };
};

export type Meta = {
  id: string;
  titulo: string;
  descricao: string | null;
  peso: number;
  progresso: number;
  status: string;
  prazo: string | null;
};

export type Avaliacao = {
  id: string;
  ciclo: string;
  status: StatusAvaliacao;
  nota: number | null;
  pontosFortes: string | null;
  pontosMelhoria: string | null;
  comentarios: string | null;
  finalizadaEm: string | null;
  avaliadorId: string | null;
  avaliadorNome: string | null;
  progressoMetas: number;
  metas: Meta[];
};

export type DadosCurso = {
  nome: string;
  fornecedor?: string;
  categoria?: string;
  cargaHoraria?: number | null;
  validadeMeses?: number | null;
  descricao?: string;
  ativo?: boolean;
};

function limparCurso(d: DadosCurso): Record<string, unknown> {
  const corpo: Record<string, unknown> = { nome: d.nome.trim() };
  for (const campo of ["fornecedor", "categoria", "descricao"] as const) {
    const v = d[campo]?.trim();
    if (v) corpo[campo] = v;
  }
  for (const campo of ["cargaHoraria", "validadeMeses"] as const) {
    const v = d[campo];
    if (v !== undefined && v !== null) corpo[campo] = v;
  }
  if (d.ativo !== undefined) corpo.ativo = d.ativo;
  return corpo;
}

export const developmentService = {
  /* ── Cursos ─────────────────────────────────────────────────────────── */

  async cursos(incluirInativos = false): Promise<{ success: boolean; data: Curso[] }> {
    const { data } = await api.get(`${BASE}/treinamentos`, {
      params: { incluirInativos: String(incluirInativos) },
    });
    return data;
  },

  async criarCurso(dados: DadosCurso) {
    const { data } = await api.post(`${BASE}/treinamentos`, limparCurso(dados));
    return data;
  },

  async atualizarCurso(id: string, dados: DadosCurso) {
    const { data } = await api.put(`${BASE}/treinamentos/${id}`, limparCurso(dados));
    return data;
  },

  async alternarCursoAtivo(id: string, atual: Curso, ativo: boolean) {
    const { data } = await api.put(`${BASE}/treinamentos/${id}`, { nome: atual.nome, ativo });
    return data;
  },

  async excluirCurso(id: string) {
    const { data } = await api.delete(`${BASE}/treinamentos/${id}`);
    return data;
  },

  async certificacoesVencendo(): Promise<{
    success: boolean;
    data: {
      janelaDias: number;
      itens: {
        id: string; curso: string; validade: string; diasParaVencer: number;
        colaborador: { id: string; nome: string };
      }[];
    };
  }> {
    const { data } = await api.get(`${BASE}/treinamentos/vencendo`);
    return data;
  },

  /* ── Participações ──────────────────────────────────────────────────── */

  async treinamentosDe(collaboratorId: string): Promise<{ success: boolean; data: Participacao[] }> {
    const { data } = await api.get(`${BASE}/employees/${collaboratorId}/treinamentos`);
    return data;
  },

  async registrar(
    collaboratorId: string,
    payload: {
      trainingId: string; status?: StatusTreinamento; inicio?: string;
      conclusao?: string; certificadoRef?: string; nota?: number; observacoes?: string;
    },
  ) {
    const corpo: Record<string, unknown> = { trainingId: payload.trainingId };
    if (payload.status) corpo.status = payload.status;
    for (const campo of ["inicio", "conclusao", "certificadoRef", "observacoes"] as const) {
      const v = payload[campo]?.trim?.() ?? payload[campo];
      if (v) corpo[campo] = v;
    }
    if (payload.nota !== undefined && payload.nota !== null) corpo.nota = payload.nota;

    const { data } = await api.post(`${BASE}/employees/${collaboratorId}/treinamentos`, corpo);
    return data;
  },

  async atualizarParticipacao(
    id: string,
    payload: { status?: StatusTreinamento; conclusao?: string; certificadoRef?: string; observacoes?: string },
  ) {
    const corpo: Record<string, unknown> = {};
    if (payload.status) corpo.status = payload.status;
    for (const campo of ["conclusao", "certificadoRef", "observacoes"] as const) {
      const v = payload[campo]?.trim();
      if (v) corpo[campo] = v;
    }
    const { data } = await api.put(`${BASE}/treinamentos/participacoes/${id}`, corpo);
    return data;
  },

  /* ── Avaliações ─────────────────────────────────────────────────────── */

  async avaliacoesDe(collaboratorId: string): Promise<{ success: boolean; data: Avaliacao[] }> {
    const { data } = await api.get(`${BASE}/employees/${collaboratorId}/avaliacoes`);
    return data;
  },

  async salvarAvaliacao(
    collaboratorId: string,
    payload: {
      ciclo: string; avaliadorId?: string; nota?: number | null;
      pontosFortes?: string; pontosMelhoria?: string; comentarios?: string;
    },
  ) {
    const corpo: Record<string, unknown> = { ciclo: payload.ciclo.trim() };
    if (payload.avaliadorId) corpo.avaliadorId = payload.avaliadorId;
    if (payload.nota !== undefined && payload.nota !== null) corpo.nota = payload.nota;
    for (const campo of ["pontosFortes", "pontosMelhoria", "comentarios"] as const) {
      const v = payload[campo]?.trim();
      if (v) corpo[campo] = v;
    }
    const { data } = await api.post(`${BASE}/employees/${collaboratorId}/avaliacoes`, corpo);
    return data;
  },

  async finalizarAvaliacao(id: string) {
    const { data } = await api.put(`${BASE}/avaliacoes/${id}/finalizar`, {});
    return data;
  },

  async criarMeta(reviewId: string, payload: { titulo: string; descricao?: string; peso?: number; prazo?: string }) {
    const corpo: Record<string, unknown> = { titulo: payload.titulo.trim() };
    if (payload.descricao?.trim()) corpo.descricao = payload.descricao.trim();
    if (payload.peso) corpo.peso = payload.peso;
    if (payload.prazo) corpo.prazo = payload.prazo;
    const { data } = await api.post(`${BASE}/avaliacoes/${reviewId}/metas`, corpo);
    return data;
  },

  async atualizarMeta(id: string, payload: { progresso?: number; peso?: number; titulo?: string }) {
    const { data } = await api.put(`${BASE}/avaliacoes/metas/${id}`, payload);
    return data;
  },

  async excluirMeta(id: string) {
    const { data } = await api.delete(`${BASE}/avaliacoes/metas/${id}`);
    return data;
  },
};
