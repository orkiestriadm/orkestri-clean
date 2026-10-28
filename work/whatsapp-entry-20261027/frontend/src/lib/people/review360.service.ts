import { api } from "../api";

/**
 * Avaliação 360 — autoavaliação, pares e calibração.
 *
 * Duas faixas de acesso, e a separação é o ponto: CONDUZIR (convidar, ver o
 * painel, calibrar) exige `people.avaliacao:*`; RESPONDER e ver o próprio
 * resultado não exigem permissão nenhuma. Quem foi convidado responde, quem
 * foi avaliado lê o que é seu.
 */

const BASE = "/v1/people/avaliacao360";

export type Origem360 = "autoavaliacao" | "par" | "lideranca";

export const ROTULO_ORIGEM: Record<Origem360, string> = {
  autoavaliacao: "Autoavaliação",
  par: "Pares",
  lideranca: "Liderança",
};

export type Pendencia360 = {
  id: string;
  origem: Origem360;
  rotuloOrigem: string;
  ciclo: string;
  /** Nulo na autoavaliação — o avaliado é quem está lendo. */
  sobre: { id: string; nome: string } | null;
  convidadoEm: string;
};

export type ResumoOrigem = {
  origem: Origem360;
  convidados: number;
  respondidas: number;
  /** Nulo quando ninguém respondeu, ou quando há poucos para preservar o anonimato. */
  media: number | null;
  omitidaPorAnonimato: boolean;
};

export type MeuResultado360 = {
  ciclo: string;
  notaGestor: number | null;
  resumo: ResumoOrigem[];
  /** Positivo = a pessoa se vê melhor do que o gestor a vê. */
  divergenciaAutoavaliacao: number | null;
  /** SEM autor, de propósito: é o que mantém o par franco. */
  comentarios: { origem: Origem360; tipo: "forte" | "melhoria"; texto: string }[];
};

export type EntradaPainel = {
  id: string;
  origem: Origem360;
  rotuloOrigem: string;
  avaliador: { id: string; nome: string };
  status: "CONVIDADO" | "RESPONDIDA";
  nota: number | null;
  pontosFortes: string | null;
  pontosMelhoria: string | null;
  comentarios: string | null;
  respondidoEm: string | null;
};

export type Painel360 = {
  reviewId: string;
  ciclo: string;
  notaGestor: number | null;
  resumo: ResumoOrigem[];
  divergenciaAutoavaliacao: number | null;
  entradas: EntradaPainel[];
};

export type LinhaCalibracao = {
  gestorId: string | null;
  gestorNome: string;
  avaliados: number;
  media: number;
  /** Positivo = pontua acima dos demais. */
  desvio: number;
  distribuicao: number[];
};

export type Calibracao = {
  ciclo: string;
  totalAvaliados: number;
  mediaGeral: number | null;
  gestores: LinhaCalibracao[];
  escopoOrganizacional: boolean;
};

export const review360Service = {
  async minhasPendencias(): Promise<{ success: boolean; data: Pendencia360[] }> {
    const { data } = await api.get(`${BASE}/minhas-pendencias`, { silent: true });
    return data;
  },

  async responder(
    entradaId: string,
    payload: { nota?: number; pontosFortes?: string; pontosMelhoria?: string; comentarios?: string },
  ) {
    // Só o que foi preenchido: a ValidationPipe roda com forbidNonWhitelisted
    // e string vazia derrubaria a requisição inteira.
    const corpo: Record<string, unknown> = {};
    if (payload.nota !== undefined) corpo.nota = payload.nota;
    if (payload.pontosFortes?.trim()) corpo.pontosFortes = payload.pontosFortes.trim();
    if (payload.pontosMelhoria?.trim()) corpo.pontosMelhoria = payload.pontosMelhoria.trim();
    if (payload.comentarios?.trim()) corpo.comentarios = payload.comentarios.trim();

    const { data } = await api.post(`${BASE}/entradas/${entradaId}/responder`, corpo);
    return data;
  },

  async meuResultado(ciclo: string): Promise<{ success: boolean; data: MeuResultado360 }> {
    const { data } = await api.get(`${BASE}/meu-resultado/${encodeURIComponent(ciclo)}`, { silent: true });
    return data;
  },

  async painel(reviewId: string): Promise<{ success: boolean; data: Painel360 }> {
    const { data } = await api.get(`${BASE}/reviews/${reviewId}`);
    return data;
  },

  async convidar(reviewId: string, avaliadorId: string, origem: Origem360) {
    const { data } = await api.post(`${BASE}/reviews/${reviewId}/convidar`, { avaliadorId, origem });
    return data;
  },

  async remover(entradaId: string) {
    const { data } = await api.delete(`${BASE}/entradas/${entradaId}`);
    return data;
  },

  async ciclos(): Promise<{ success: boolean; data: string[] }> {
    const { data } = await api.get(`${BASE}/ciclos`, { silent: true });
    return data;
  },

  async calibracao(ciclo: string): Promise<{ success: boolean; data: Calibracao }> {
    const { data } = await api.get(`${BASE}/calibracao`, { params: { ciclo } });
    return data;
  },
};
