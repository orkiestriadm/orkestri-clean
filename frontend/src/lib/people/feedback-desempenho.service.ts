import { api } from "../api";

/**
 * Avaliação de Desempenho › Feedback.
 *
 * O fluxo do RH: registro → reunião → ciência → encerramento. Duas faixas de
 * rota, como no 360: quem CONDUZ usa `/feedbacks-desempenho` (permissões
 * `people.feedback_desempenho:*`); quem RECEBE usa `/eu/feedbacks-desempenho`,
 * sem permissão e sem id de colaborador — o alvo sai do token.
 */

const BASE = "/v1/people/feedbacks-desempenho";
const BASE_EU = "/v1/people/eu/feedbacks-desempenho";

export type StatusFeedbackDesempenho =
  | "REGISTRADO" | "REUNIAO_AGENDADA" | "AGUARDANDO_CIENCIA" | "ENCERRADO";

export const ETAPAS: { status: StatusFeedbackDesempenho; rotulo: string }[] = [
  { status: "REGISTRADO",         rotulo: "Registrado" },
  { status: "REUNIAO_AGENDADA",   rotulo: "Reunião agendada" },
  { status: "AGUARDANDO_CIENCIA", rotulo: "Aguardando ciência" },
  { status: "ENCERRADO",          rotulo: "Encerrado" },
];

export type AcaoFeedbackDesempenho =
  | "editar" | "agendar_reuniao" | "reagendar_reuniao" | "registrar_reuniao"
  | "registrar_ciencia" | "solicitar_exclusao" | "decidir_exclusao";

export type ItemFeedbackDesempenho = {
  id: string;
  status: StatusFeedbackDesempenho;
  rotuloStatus: string;
  colaborador: { id: string; nome: string };
  gestor: { id: string; nome: string };
  criadoEm: string;
  reuniaoInicio: string | null;
  cienciaEm: string | null;
  exclusaoPendente: boolean;
  souGestor: boolean;
};

export type EventoFeedback = {
  id: string;
  tipo: string;
  autorNome: string | null;
  detalhe: string | null;
  criadoEm: string;
};

export type DetalheFeedbackDesempenho = {
  id: string;
  status: StatusFeedbackDesempenho;
  rotuloStatus: string;
  colaborador: { id: string; nome: string; cargo: string | null };
  gestor: { id: string; nome: string };
  pontosFortes: string;
  oportunidades: string;
  reuniaoInicio: string | null;
  reuniaoLocal: string | null;
  reuniaoRealizadaEm: string | null;
  alinhamentos: string | null;
  cienciaEm: string | null;
  comentarioColaborador: string | null;
  exclusao: {
    status: "PENDENTE" | "REPROVADA" | null;
    motivo: string | null;
    solicitadaEm: string | null;
    decididaEm: string | null;
    parecer: string | null;
  } | null;
  criadoEm: string;
  papeis: ("gestor" | "rh")[];
  acoes: AcaoFeedbackDesempenho[];
  eventos: EventoFeedback[];
};

export type MeuFeedbackDesempenho = {
  id: string;
  status: StatusFeedbackDesempenho;
  rotuloStatus: string;
  gestor: { nome: string };
  reuniaoInicio: string | null;
  reuniaoLocal: string | null;
  reuniaoRealizadaEm: string | null;
  /** Nulos até a reunião acontecer — o texto só é liberado depois da conversa. */
  pontosFortes: string | null;
  oportunidades: string | null;
  alinhamentos: string | null;
  cienciaEm: string | null;
  comentarioColaborador: string | null;
  podeDarCiencia: boolean;
  criadoEm: string;
  eventos?: EventoFeedback[];
};

export const ROTULO_EVENTO: Record<string, string> = {
  registrado: "Feedback registrado",
  editado: "Registro editado",
  reuniao_agendada: "Reunião agendada",
  reuniao_reagendada: "Reunião remarcada",
  reuniao_realizada: "Reunião realizada",
  ciencia: "Ciência registrada",
  exclusao_solicitada: "Exclusão solicitada ao RH",
  exclusao_aprovada: "Exclusão aprovada pelo RH",
  exclusao_reprovada: "Exclusão reprovada pelo RH",
};

export type FiltroFeedback = {
  status?: string;
  collaboratorId?: string;
  exclusaoPendente?: boolean;
  busca?: string;
};

export const feedbackDesempenhoService = {
  listar: (f: FiltroFeedback = {}) =>
    api.get<{ success: boolean; data: ItemFeedbackDesempenho[] }>(BASE, {
      params: {
        status: f.status || undefined,
        collaboratorId: f.collaboratorId || undefined,
        exclusaoPendente: f.exclusaoPendente ? "1" : undefined,
        busca: f.busca?.trim() || undefined,
      },
    }).then(r => r.data),

  obter: (id: string) =>
    api.get<{ success: boolean; data: DetalheFeedbackDesempenho }>(`${BASE}/${id}`).then(r => r.data),

  elegiveis: () =>
    api.get<{ success: boolean; data: { id: string; nome: string; cargo: string | null }[] }>(
      `${BASE}/colaboradores-elegiveis`,
    ).then(r => r.data),

  criar: (dados: { collaboratorId: string; pontosFortes: string; oportunidades: string }) =>
    api.post<{ success: boolean; data: DetalheFeedbackDesempenho }>(BASE, dados).then(r => r.data),

  editar: (id: string, dados: { pontosFortes: string; oportunidades: string }) =>
    api.patch<{ success: boolean; data: DetalheFeedbackDesempenho }>(`${BASE}/${id}`, dados).then(r => r.data),

  agendar: (id: string, dados: { inicio: string; local?: string }) =>
    api.post<{ success: boolean; data: DetalheFeedbackDesempenho }>(`${BASE}/${id}/reuniao`, dados).then(r => r.data),

  registrarReuniao: (id: string, dados: { realizadaEm?: string; alinhamentos: string }) =>
    api.post<{ success: boolean; data: DetalheFeedbackDesempenho }>(`${BASE}/${id}/reuniao/realizada`, dados).then(r => r.data),

  solicitarExclusao: (id: string, motivo: string) =>
    api.post<{ success: boolean; data: DetalheFeedbackDesempenho; aprovadoresNotificados: number }>(
      `${BASE}/${id}/exclusao`, { motivo },
    ).then(r => r.data),

  decidirExclusao: (id: string, aprovar: boolean, parecer?: string) =>
    api.post<{ success: boolean; data: any }>(`${BASE}/${id}/exclusao/decisao`, { aprovar, parecer }).then(r => r.data),

  meus: () =>
    api.get<{ success: boolean; data: MeuFeedbackDesempenho[] }>(BASE_EU).then(r => r.data),

  meu: (id: string) =>
    api.get<{ success: boolean; data: MeuFeedbackDesempenho }>(`${BASE_EU}/${id}`).then(r => r.data),

  registrarCiencia: (id: string, comentario?: string) =>
    api.post<{ success: boolean; data: MeuFeedbackDesempenho }>(`${BASE_EU}/${id}/ciencia`, { comentario }).then(r => r.data),
};

/** "2026-09-17T14:30" no fuso do navegador → ISO. Vazio devolve undefined. */
export function localParaIso(valor: string): string | undefined {
  if (!valor) return undefined;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** ISO → valor de `<input type="datetime-local">` no fuso do navegador. */
export function isoParaLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
