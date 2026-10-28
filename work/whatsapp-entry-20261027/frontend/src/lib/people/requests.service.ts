import { api } from "../api";

/**
 * Solicitações do colaborador (autosserviço).
 *
 * Roda sobre o `WorkflowRequest` que já existe no produto, com tipos próprios
 * do People. A alternativa — criar uma tabela `employee_requests` como a spec
 * sugeria — seria um segundo motor de aprovação para o mesmo problema: o
 * workflow atual já tem aprovador por setor, delegação, escalonamento,
 * lembrete e histórico. Ver docs/people/README.md.
 *
 * O que o People acrescenta é o vocabulário: tipos e um payload estruturado
 * para que o RH veja o que mudou sem ler texto corrido.
 */

const BASE = "/workflows/requests";

/** Prefixo que separa as solicitações de RH das demais no mesmo motor. */
export const PREFIXO_PEOPLE = "people.";

export const TIPOS_SOLICITACAO = [
  {
    value: "people.alteracao_cadastral",
    label: "Alteração de dados cadastrais",
    dica: "Endereço, telefone, estado civil, conta bancária",
  },
  {
    value: "people.documento",
    label: "Solicitação de documento",
    dica: "Declaração de vínculo, informe de rendimentos, holerite",
  },
  {
    value: "people.outro",
    label: "Outra solicitação ao RH",
    dica: "Qualquer assunto que não se encaixe acima",
  },
] as const;

export type TipoSolicitacao = (typeof TIPOS_SOLICITACAO)[number]["value"];
export type StatusSolicitacao = "PENDENTE" | "APROVADA" | "REJEITADA" | "CANCELADA";

export type Solicitacao = {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  payload: Record<string, unknown> | null;
  status: StatusSolicitacao;
  motivoRejeicao: string | null;
  criadoEm: string;
  aprovadoEm: string | null;
  solicitante?: { id: string; nome: string } | null;
  aprovadorAtual?: { id: string; nome: string } | null;
};

export const requestsService = {
  /** Só as de RH: o mesmo motor carrega despesa, hora extra e outras. */
  async listar(): Promise<Solicitacao[]> {
    const { data } = await api.get(BASE);
    const itens: Solicitacao[] = Array.isArray(data) ? data : (data?.data ?? data?.items ?? []);
    return itens.filter(s => s.tipo?.startsWith(PREFIXO_PEOPLE));
  },

  async criar(dados: {
    tipo: TipoSolicitacao;
    titulo: string;
    descricao?: string;
    campo?: string;
    valorAtual?: string;
    valorNovo?: string;
  }) {
    // Payload estruturado só quando há estrutura: numa alteração cadastral o
    // RH precisa ver de/para lado a lado, não caçar dentro de texto livre.
    const payload =
      dados.tipo === "people.alteracao_cadastral" && dados.campo?.trim()
        ? {
            campo: dados.campo.trim(),
            valorAtual: dados.valorAtual?.trim() || null,
            valorNovo: dados.valorNovo?.trim() || null,
          }
        : undefined;

    const corpo: Record<string, unknown> = {
      tipo: dados.tipo,
      titulo: dados.titulo.trim(),
    };
    if (dados.descricao?.trim()) corpo.descricao = dados.descricao.trim();
    if (payload) corpo.payload = payload;

    const { data } = await api.post(BASE, corpo);
    return data;
  },

  async cancelar(id: string) {
    const { data } = await api.patch(`${BASE}/${id}/cancelar`, {});
    return data;
  },
};
