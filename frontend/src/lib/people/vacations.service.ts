import { api } from "../api";

/**
 * Férias — saldo, períodos aquisitivos e solicitação.
 *
 * Aprovar, rejeitar e cancelar continuam em `/ausencias`: o fluxo é genérico e
 * serve atestado e licença também. Aqui fica só o que é específico de férias.
 */

const BASE = "/v1/people";

export type StatusPeriodo = "EM_AQUISICAO" | "ADQUIRIDO" | "GOZADO" | "VENCIDO";

export type PeriodoFerias = {
  id: string;
  inicio: string;
  fim: string;
  /** Prazo final para gozar. Passar daqui gera pagamento em dobro. */
  limiteConcessivo: string;
  diasDireito: number;
  diasGozados: number;
  saldo: number;
  status: StatusPeriodo;
  /** Negativo quando o prazo já passou. */
  diasParaVencer: number;
};

export type SituacaoFerias = {
  /** Sem data de admissão não há como calcular período — é dado faltando. */
  semDataAdmissao: boolean;
  saldoDisponivel: number;
  periodos: PeriodoFerias[];
  vencendo: number;
};

export type ItemPassivo = {
  id: string;
  colaborador: { id: string; nome: string };
  limiteConcessivo: string;
  diasParaVencer: number;
  saldo: number;
};

export const vacationsService = {
  async situacao(collaboratorId: string): Promise<{ success: boolean; data: SituacaoFerias }> {
    const { data } = await api.get(`${BASE}/employees/${collaboratorId}/ferias`);
    return data;
  },

  async solicitar(
    collaboratorId: string,
    payload: { dataInicio: string; dataFim: string; observacao?: string },
  ) {
    const corpo: Record<string, string> = {
      dataInicio: payload.dataInicio,
      dataFim: payload.dataFim,
    };
    // Campo vazio derruba a validação do backend em @MaxLength/@IsString.
    if (payload.observacao?.trim()) corpo.observacao = payload.observacao.trim();

    const { data } = await api.post(`${BASE}/employees/${collaboratorId}/ferias`, corpo);
    return data;
  },

  async passivo(): Promise<{ success: boolean; data: { janelaDias: number; periodos: ItemPassivo[] } }> {
    const { data } = await api.get(`${BASE}/ferias/passivo`);
    return data;
  },
};
