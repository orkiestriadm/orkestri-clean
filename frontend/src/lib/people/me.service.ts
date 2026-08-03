import { api } from "../api";
import type { SituacaoFerias } from "./vacations.service";
import type { Documento } from "./documents.service";
import type { SituacaoCarreira } from "./career.service";
import type { Checklist, SituacaoItem } from "./checklist.service";

/**
 * Meu RH — o módulo visto pelo próprio colaborador.
 *
 * Nenhuma função daqui recebe `collaboratorId`. O backend resolve o alvo pelo
 * token, e é isso que torna impossível pedir o dado de outra pessoa por estas
 * rotas. Se um dia aparecer um parâmetro de identidade aqui, a garantia caiu.
 *
 * Também não exigem permissão `people.*`: ver o próprio saldo de férias não é
 * privilégio a conceder.
 */

const BASE = "/v1/people/eu";

export type MinhaPendencia = {
  id: string;
  titulo: string;
  evento: "admissao" | "desligamento";
  situacao: SituacaoItem;
  /** Negativo quando o prazo já passou; nulo quando o item não tem prazo. */
  diasParaPrazo: number | null;
};

export type MeuResumo = {
  colaborador: {
    id: string;
    nome: string;
    cargo: string | null;
    setor: string | null;
    gestor: string | null;
    dataAdmissao: string | null;
    matricula: string | null;
    fotoUrl: string | null;
    status: string;
  };
  ferias: {
    saldoDisponivel: number;
    vencendo: number;
    semDataAdmissao: boolean;
  };
  documentos: {
    total: number;
    rejeitados: number;
    vencendo: number;
  };
  /** Só os itens de checklist que são MEUS — o resumo é sobre a minha ação. */
  pendencias: MinhaPendencia[];
  carreira: {
    trilha: string | null;
    proximoCargo: string | null;
    percentual: number | null;
  } | null;
};

export type MeuFeedback = {
  id: string;
  tipo: string;
  conteudo: string;
  ocorridoEm: string;
  autorNome: string | null;
};

export type MeuDesenvolvimento = {
  treinamentos: any[];
  /** Só as FINALIZADAS: nota em rascunho ainda pode mudar. */
  avaliacoes: any[];
};

export const meService = {
  async resumo(): Promise<{ success: boolean; data: MeuResumo }> {
    const { data } = await api.get(BASE, { silent: true });
    return data;
  },

  async ferias(): Promise<{ success: boolean; data: SituacaoFerias }> {
    const { data } = await api.get(`${BASE}/ferias`);
    return data;
  },

  async solicitarFerias(payload: { dataInicio: string; dataFim: string; observacao?: string }) {
    const corpo: Record<string, string> = {
      dataInicio: payload.dataInicio,
      dataFim: payload.dataFim,
    };
    // Campo vazio derruba a validação do backend em @MaxLength/@IsString.
    if (payload.observacao?.trim()) corpo.observacao = payload.observacao.trim();
    const { data } = await api.post(`${BASE}/ferias`, corpo);
    return data;
  },

  async documentos(): Promise<{ success: boolean; data: Documento[] }> {
    const { data } = await api.get(`${BASE}/documentos`);
    return data;
  },

  async enviarDocumento(form: FormData) {
    const { data } = await api.post(`${BASE}/documentos`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  async desenvolvimento(): Promise<{ success: boolean; data: MeuDesenvolvimento }> {
    const { data } = await api.get(`${BASE}/desenvolvimento`);
    return data;
  },

  async carreira(): Promise<{ success: boolean; data: SituacaoCarreira }> {
    const { data } = await api.get(`${BASE}/carreira`, { silent: true });
    return data;
  },

  async checklist(): Promise<{ success: boolean; data: Checklist[] }> {
    const { data } = await api.get(`${BASE}/checklist`);
    return data;
  },

  async beneficios(): Promise<{ success: boolean; data: any[] }> {
    const { data } = await api.get(`${BASE}/beneficios`);
    return data;
  },

  async feedbacks(): Promise<{ success: boolean; data: MeuFeedback[] }> {
    const { data } = await api.get(`${BASE}/feedbacks`);
    return data;
  },
};
