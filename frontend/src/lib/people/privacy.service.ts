import { api } from "../api";

/**
 * Privacidade — eliminação do dado pessoal de ex-colaborador (LGPD).
 *
 * A ação é IRREVERSÍVEL. Por isso o serviço expõe uma prévia separada da
 * execução: a tela é obrigada a mostrar o que vai sumir antes de oferecer o
 * botão. "Tem certeza?" sem dizer o que acontece não é confirmação.
 */

const BASE = "/v1/people/privacidade";

export type MotivoInelegibilidade =
  | "nao_desligado" | "sem_data_desligamento" | "dentro_do_prazo" | "ja_anonimizado";

export type LinhaExpurgo = {
  id: string;
  nome: string;
  matricula: string | null;
  cargo: string | null;
  setor: string | null;
  dataDesligamento: string | null;
  elegivel: boolean;
  liberaEm: string | null;
  /** Negativo quando o prazo já venceu. */
  diasParaLiberar: number | null;
  motivo: MotivoInelegibilidade | null;
  explicacao: string | null;
};

export type Elegiveis = {
  anosGuarda: number;
  elegiveis: LinhaExpurgo[];
  aguardando: LinhaExpurgo[];
};

export type PreviaAnonimizacao = {
  colaborador: { id: string; nome: string };
  elegivel: boolean;
  motivo: MotivoInelegibilidade | null;
  explicacao: string | null;
  liberaEm: string | null;
  seraEliminado: {
    identificacao: string;
    contato: string;
    enderecos: number;
    contatos: number;
    documentos: number;
    acessoAoSistema: boolean;
  };
  seraPreservado: string[];
};

export const privacyService = {
  async elegiveis(anosGuarda?: number): Promise<{ success: boolean; data: Elegiveis }> {
    const { data } = await api.get(`${BASE}/elegiveis`, {
      params: anosGuarda ? { anosGuarda } : {},
      silent: true,
    });
    return data;
  },

  async previa(collaboratorId: string): Promise<{ success: boolean; data: PreviaAnonimizacao }> {
    const { data } = await api.get(`${BASE}/${collaboratorId}/previa`);
    return data;
  },

  async anonimizar(collaboratorId: string, justificativa: string) {
    const { data } = await api.post(`${BASE}/${collaboratorId}/anonimizar`, {
      justificativa: justificativa.trim(),
    });
    return data;
  },
};
