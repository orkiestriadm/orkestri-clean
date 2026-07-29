import { api } from "../api";

/**
 * Ausências — férias, atestado, folga, licença.
 *
 * A API é a legada `/ausencias`, não `/v1/people`: o fluxo de aprovação é
 * genérico e serve todos os tipos. O que o People acrescenta é o saldo de
 * férias, que vive em `vacations.service`. Duplicar o CRUD aqui criaria dois
 * caminhos para aprovar a mesma coisa.
 */

export type TipoAusencia = "ferias" | "atestado" | "folga" | "licenca" | "banco_horas" | "outro";
export type StatusAusencia = "PENDENTE" | "APROVADA" | "REJEITADA" | "CANCELADA";

export const TIPOS_AUSENCIA: { value: TipoAusencia; label: string }[] = [
  { value: "ferias",      label: "Férias" },
  { value: "atestado",    label: "Atestado" },
  { value: "folga",       label: "Folga" },
  { value: "licenca",     label: "Licença" },
  { value: "banco_horas", label: "Banco de horas" },
  { value: "outro",       label: "Outro" },
];

export type Ausencia = {
  id: string;
  collaboratorId: string;
  tipo: TipoAusencia;
  dataInicio: string;
  dataFim: string;
  diaInteiro: boolean;
  horasDia: number | null;
  descricao: string | null;
  status: StatusAusencia;
  vacationPeriodId: string | null;
  motivoRejeicao: string | null;
  aprovadaEm: string | null;
  collaborator?: { id: string; nomeCompleto: string | null; user?: { nome: string } | null };
  aprovadaPor?: { nome: string } | null;
};

export type DadosAusencia = {
  collaboratorId: string;
  tipo: TipoAusencia;
  dataInicio: string;
  dataFim: string;
  diaInteiro?: boolean;
  horasDia?: number;
  descricao?: string;
};

export const absencesService = {
  async listar(): Promise<Ausencia[]> {
    const { data } = await api.get("/ausencias");
    return Array.isArray(data) ? data : (data?.data ?? []);
  },

  async criar(dados: DadosAusencia) {
    const corpo: Record<string, unknown> = {
      collaboratorId: dados.collaboratorId,
      tipo: dados.tipo,
      dataInicio: dados.dataInicio,
      dataFim: dados.dataFim,
      diaInteiro: dados.diaInteiro ?? true,
    };
    if (dados.horasDia !== undefined) corpo.horasDia = dados.horasDia;
    if (dados.descricao?.trim()) corpo.descricao = dados.descricao.trim();
    const { data } = await api.post("/ausencias", corpo);
    return data;
  },

  async aprovar(id: string) {
    const { data } = await api.patch(`/ausencias/${id}/aprovar`, {});
    return data;
  },

  /** O motivo é exigido pelo backend: rejeitar sem explicar não ajuda ninguém. */
  async rejeitar(id: string, motivoRejeicao: string) {
    const { data } = await api.patch(`/ausencias/${id}/rejeitar`, { motivoRejeicao });
    return data;
  },

  async cancelar(id: string) {
    const { data } = await api.patch(`/ausencias/${id}/cancelar`, {});
    return data;
  },

  async excluir(id: string) {
    const { data } = await api.delete(`/ausencias/${id}`);
    return data;
  },
};
