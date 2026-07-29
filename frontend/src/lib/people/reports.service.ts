import { api } from "../api";

/** Painéis de pessoas e exportação. */

const BASE = "/v1/people/relatorios";

export type Fatia = { rotulo: string; total: number; percentual: number };

export type VisaoGeral = {
  janelaMeses: number;
  /** Falso quando o usuário vê apenas a própria equipe — muda a leitura. */
  escopoOrganizacional: boolean;
  quadro: {
    total: number;
    ativos: number;
    porStatus: { status: string; total: number }[];
    tempoMedioCasaMeses: number;
  };
  movimentacao: {
    admissoes: number;
    desligamentos: number;
    saldo: number;
    turnoverPercentual: number;
    efetivoInicial: number;
  };
  distribuicoes: { porSetor: Fatia[]; porCargo: Fatia[]; porVinculo: Fatia[] };
  documentos: {
    porAprovacao: { aprovacao: string; total: number }[];
    vencendoEm30Dias: number;
  };
  ferias: { saldoTotalDias: number; passivoVencidoDias: number };
};

export type PainelDesenvolvimento = {
  treinamentos: { status: string; total: number }[];
  certificacoesVencendo: number;
  desempenhoPorCiclo: { ciclo: string; media: number | null; avaliacoes: number }[];
};

export type PainelBeneficios = {
  pessoasCobertas: number;
  custoMensalTotal: number;
  porBeneficio: { nome: string; categoria: string; pessoas: number; custo: number }[];
};

export const reportsService = {
  async visaoGeral(meses?: number): Promise<{ success: boolean; data: VisaoGeral }> {
    const { data } = await api.get(`${BASE}/visao-geral`, {
      params: meses ? { meses: String(meses) } : undefined,
    });
    return data;
  },

  async desenvolvimento(): Promise<{ success: boolean; data: PainelDesenvolvimento }> {
    const { data } = await api.get(`${BASE}/desenvolvimento`, { silent: true });
    return data;
  },

  async beneficios(): Promise<{ success: boolean; data: PainelBeneficios }> {
    const { data } = await api.get(`${BASE}/beneficios`, { silent: true });
    return data;
  },

  /**
   * Baixa o CSV do quadro.
   *
   * `responseType: blob` é obrigatório: sem ele o axios trata como texto e o
   * BOM vira caracteres visíveis no começo da primeira célula.
   */
  async exportarQuadro(): Promise<void> {
    const resposta = await api.get(`${BASE}/colaboradores.csv`, { responseType: "blob" });

    const nome =
      /filename="([^"]+)"/.exec(resposta.headers?.["content-disposition"] ?? "")?.[1]
      ?? `colaboradores-${new Date().toISOString().slice(0, 10)}.csv`;

    const url = URL.createObjectURL(resposta.data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Sem revoke, o blob fica na memória da aba até ela ser fechada.
    URL.revokeObjectURL(url);
  },
};
