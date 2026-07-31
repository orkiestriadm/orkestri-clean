import { api } from "../api";

/**
 * Acesso à API de documentos do Orkiestri People.
 *
 * Estes arquivos NÃO são servidos por URL estática — vivem fora do diretório
 * público, e todo acesso passa pelo endpoint de download, que valida escopo,
 * permissão e sigilo por categoria. Por isso não existe `arquivoUrl` aqui:
 * baixar é sempre uma chamada autenticada.
 */

const BASE = "/v1/people";

export type CategoriaDocumento =
  | "identidade" | "contrato" | "certificado" | "medico" | "formacao" | "outro";

export type AprovacaoDocumento = "PENDENTE" | "APROVADO" | "REJEITADO" | "ARQUIVADO";

export type SituacaoValidade = "sem_validade" | "vigente" | "vence_em_breve" | "vencido";

export type Documento = {
  id: string;
  collaboratorId: string;
  categoria: CategoriaDocumento;
  titulo: string;
  descricao: string | null;
  nomeArquivo: string;
  mimeType: string | null;
  tamanhoBytes: number | null;
  dataEmissao: string | null;
  dataValidade: string | null;
  aprovacao: AprovacaoDocumento;
  aprovadoEm: string | null;
  motivoRejeicao: string | null;
  criadoEm: string;
  situacaoValidade: SituacaoValidade;
  /** Falso em documento restrito quando quem olha não é RH nem o próprio. */
  podeBaixar: boolean;
  restrito: boolean;
};

export type DadosEnvio = {
  categoria: CategoriaDocumento;
  titulo: string;
  descricao?: string;
  dataEmissao?: string;
  dataValidade?: string;
};

/** Espelha o backend — validar antes de subir 15 MB evita a viagem inútil. */
export const MIMES_ACEITOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const TAMANHO_MAXIMO_BYTES = 15 * 1024 * 1024;

export const documentsService = {
  async listar(collaboratorId: string): Promise<{ success: boolean; data: Documento[] }> {
    const { data } = await api.get(`${BASE}/employees/${collaboratorId}/documents`);
    return data;
  },

  async enviar(collaboratorId: string, dados: DadosEnvio, arquivo: File) {
    const form = new FormData();
    form.append("arquivo", arquivo);
    for (const [chave, valor] of Object.entries(dados)) {
      // Campo vazio derruba a validação do backend (@IsDateString em string "").
      if (valor === undefined || valor === null || valor === "") continue;
      form.append(chave, String(valor));
    }
    const { data } = await api.post(`${BASE}/employees/${collaboratorId}/documents`, form);
    return data;
  },

  /**
   * Baixa o arquivo.
   *
   * `responseType: blob` porque a resposta é binária; sem isso o axios tenta
   * interpretar como texto e corrompe o conteúdo. O nome vem do metadado, não
   * do cabeçalho — o backend já devolve `Content-Disposition: attachment`, mas
   * o nome ali está percent-encoded.
   */
  async baixar(documento: Documento): Promise<void> {
    const resposta = await api.get(`${BASE}/documents/${documento.id}/download`, {
      responseType: "blob",
    });
    const url = URL.createObjectURL(resposta.data as Blob);
    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = documento.nomeArquivo;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      // Sem revogar, o blob fica retido em memória enquanto a aba viver.
      URL.revokeObjectURL(url);
    }
  },

  async decidir(id: string, aprovacao: AprovacaoDocumento, motivo?: string) {
    const { data } = await api.patch(`${BASE}/documents/${id}/decisao`, { aprovacao, motivo });
    return data;
  },

  async excluir(id: string) {
    const { data } = await api.delete(`${BASE}/documents/${id}`);
    return data;
  },

  async conformidade() {
    const { data } = await api.get(`${BASE}/documents/conformidade`);
    return data;
  },
};
