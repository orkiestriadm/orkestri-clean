import { api } from "../api";
import type {
  Obrigacao, ListaObrigacoes, Filtros, Painel, MeuPainel, EventoCalendario,
  Anexo, EventoHistorico, Versao, Comentario, Categoria, Orgao, Tag,
  Regra, Template, Escalonamento, Envio, Previa,
} from "./types";

/**
 * Acesso à API do Orkiestri Compliance.
 *
 * Os anexos NÃO são servidos por URL estática — vivem fora do diretório
 * público, e todo acesso passa pelo endpoint de download, que valida escopo e
 * permissão. Por isso não existe `arquivoUrl` aqui.
 */

const BASE = "/v1/compliance";

export type ConsultaObrigacoes = {
  q?: string;
  categoriaId?: string;
  orgaoId?: string;
  status?: string;
  criticidade?: string;
  situacao?: string;
  unidade?: string;
  departamento?: string;
  empresa?: string;
  responsavelId?: string;
  tag?: string;
  venceEmDias?: number;
  de?: string;
  ate?: string;
  favoritos?: boolean;
  ordenar?: string;
  pagina?: number;
  limite?: number;
};

/** Remove chaves vazias — `?status=` filtraria por string vazia no backend. */
function limpar(consulta: Record<string, any>): Record<string, any> {
  const saida: Record<string, any> = {};
  for (const [k, v] of Object.entries(consulta)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    saida[k] = v;
  }
  return saida;
}

export const complianceService = {
  /* ── Obrigações ─────────────────────────────────────────────────────────── */

  async listar(consulta: ConsultaObrigacoes = {}): Promise<ListaObrigacoes> {
    const { data } = await api.get(`${BASE}/obrigacoes`, { params: limpar(consulta) });
    return data;
  },

  async obter(id: string): Promise<Obrigacao> {
    const { data } = await api.get(`${BASE}/obrigacoes/${id}`);
    return data;
  },

  async filtros(): Promise<Filtros> {
    const { data } = await api.get(`${BASE}/obrigacoes/filtros`, { silent: true });
    return data;
  },

  async criar(dados: Record<string, any>): Promise<Obrigacao> {
    const { data } = await api.post(`${BASE}/obrigacoes`, dados);
    return data;
  },

  async atualizar(id: string, dados: Record<string, any>): Promise<Obrigacao> {
    const { data } = await api.put(`${BASE}/obrigacoes/${id}`, dados);
    return data;
  },

  async renovar(id: string, dados: Record<string, any>): Promise<Obrigacao> {
    const { data } = await api.post(`${BASE}/obrigacoes/${id}/renovar`, dados);
    return data;
  },

  /** Devolve `aviso` quando o protocolo não prorroga — a tela precisa mostrar. */
  async protocolar(
    id: string, dados: { protocoloNumero: string; protocoloEm: string; observacao?: string },
  ): Promise<Obrigacao & { aviso: string | null }> {
    const { data } = await api.post(`${BASE}/obrigacoes/${id}/protocolo`, dados);
    return data;
  },

  async mudarStatus(id: string, status: string, motivo?: string): Promise<Obrigacao> {
    const { data } = await api.patch(`${BASE}/obrigacoes/${id}/status`, { status, motivo });
    return data;
  },

  async excluir(id: string) {
    const { data } = await api.delete(`${BASE}/obrigacoes/${id}`);
    return data;
  },

  async favoritar(id: string): Promise<{ favorito: boolean }> {
    const { data } = await api.post(`${BASE}/obrigacoes/${id}/favorito`);
    return data;
  },

  async historico(id: string): Promise<EventoHistorico[]> {
    const { data } = await api.get(`${BASE}/obrigacoes/${id}/historico`);
    return data;
  },

  async versoes(id: string): Promise<Versao[]> {
    const { data } = await api.get(`${BASE}/obrigacoes/${id}/versoes`);
    return data;
  },

  async comentarios(id: string): Promise<Comentario[]> {
    const { data } = await api.get(`${BASE}/obrigacoes/${id}/comentarios`);
    return data;
  },

  async comentar(id: string, conteudo: string): Promise<Comentario> {
    const { data } = await api.post(`${BASE}/obrigacoes/${id}/comentarios`, { conteudo });
    return data;
  },

  /**
   * Exportação.
   *
   * `responseType: blob` porque a resposta é binária; sem isso o axios tenta
   * interpretar como texto e corrompe o arquivo.
   */
  async exportar(formato: "excel" | "pdf" | "csv", consulta: ConsultaObrigacoes = {}) {
    const resposta = await api.get(`${BASE}/obrigacoes/exportar`, {
      params: limpar({ ...consulta, formato }),
      responseType: "blob",
    });

    const extensao = formato === "excel" ? "xlsx" : formato;
    const nome = `obrigacoes-${new Date().toISOString().slice(0, 10)}.${extensao}`;
    const url = URL.createObjectURL(resposta.data as Blob);
    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = nome;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      // Sem revogar, o blob fica retido em memória enquanto a aba viver.
      URL.revokeObjectURL(url);
    }
    return { truncado: resposta.headers?.["x-export-truncado"] === "true" };
  },

  /* ── Painel e calendário ────────────────────────────────────────────────── */

  async painel(): Promise<Painel> {
    const { data } = await api.get(`${BASE}/painel`);
    return data;
  },

  async meuPainel(): Promise<MeuPainel> {
    const { data } = await api.get(`${BASE}/meu-painel`);
    return data;
  },

  async calendario(de?: string, ate?: string): Promise<{ de: string; ate: string; eventos: EventoCalendario[] }> {
    const { data } = await api.get(`${BASE}/calendario`, { params: limpar({ de, ate }) });
    return data;
  },

  async relatorios() {
    const { data } = await api.get(`${BASE}/relatorios`);
    return data;
  },

  /* ── Anexos ─────────────────────────────────────────────────────────────── */

  async anexos(obrigacaoId: string): Promise<Anexo[]> {
    const { data } = await api.get(`${BASE}/obrigacoes/${obrigacaoId}/anexos`);
    return data;
  },

  async enviarAnexo(
    obrigacaoId: string, arquivo: File, dados: { titulo?: string; observacoes?: string } = {},
  ): Promise<Anexo> {
    const form = new FormData();
    form.append("arquivo", arquivo);
    for (const [chave, valor] of Object.entries(dados)) {
      if (valor === undefined || valor === null || valor === "") continue;
      form.append(chave, String(valor));
    }
    const { data } = await api.post(`${BASE}/obrigacoes/${obrigacaoId}/anexos`, form);
    return data;
  },

  async baixarAnexo(anexo: Anexo): Promise<void> {
    const resposta = await api.get(`${BASE}/anexos/${anexo.id}/download`, { responseType: "blob" });
    const url = URL.createObjectURL(resposta.data as Blob);
    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = anexo.nomeOriginal;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
  },

  async excluirAnexo(id: string) {
    const { data } = await api.delete(`${BASE}/anexos/${id}`);
    return data;
  },

  /* ── Categorias ─────────────────────────────────────────────────────────── */

  async categorias(todas = false): Promise<Categoria[]> {
    const { data } = await api.get(`${BASE}/categorias`, { params: limpar({ todas }) });
    return data;
  },

  async categoria(id: string): Promise<Categoria> {
    const { data } = await api.get(`${BASE}/categorias/${id}`);
    return data;
  },

  async salvarCategoria(id: string | null, dados: Record<string, any>): Promise<Categoria> {
    const { data } = id
      ? await api.put(`${BASE}/categorias/${id}`, dados)
      : await api.post(`${BASE}/categorias`, dados);
    return data;
  },

  async excluirCategoria(id: string) {
    const { data } = await api.delete(`${BASE}/categorias/${id}`);
    return data;
  },

  /* ── Órgãos e tags ──────────────────────────────────────────────────────── */

  async orgaos(): Promise<Orgao[]> {
    const { data } = await api.get(`${BASE}/orgaos`, { silent: true });
    return data;
  },

  async salvarOrgao(id: string | null, dados: Record<string, any>): Promise<Orgao> {
    const { data } = id
      ? await api.put(`${BASE}/orgaos/${id}`, dados)
      : await api.post(`${BASE}/orgaos`, dados);
    return data;
  },

  async excluirOrgao(id: string) {
    const { data } = await api.delete(`${BASE}/orgaos/${id}`);
    return data;
  },

  async tags(): Promise<Tag[]> {
    const { data } = await api.get(`${BASE}/tags`, { silent: true });
    return data;
  },

  /* ── Alertas ────────────────────────────────────────────────────────────── */

  async regras(): Promise<Regra[]> {
    const { data } = await api.get(`${BASE}/alertas/regras`);
    return data;
  },

  async salvarRegra(id: string | null, dados: Record<string, any>): Promise<Regra> {
    const { data } = id
      ? await api.put(`${BASE}/alertas/regras/${id}`, dados)
      : await api.post(`${BASE}/alertas/regras`, dados);
    return data;
  },

  async excluirRegra(id: string) {
    const { data } = await api.delete(`${BASE}/alertas/regras/${id}`);
    return data;
  },

  async templates(): Promise<Template[]> {
    const { data } = await api.get(`${BASE}/alertas/templates`);
    return data;
  },

  async salvarTemplate(id: string | null, dados: Record<string, any>): Promise<Template> {
    const { data } = id
      ? await api.put(`${BASE}/alertas/templates/${id}`, dados)
      : await api.post(`${BASE}/alertas/templates`, dados);
    return data;
  },

  async excluirTemplate(id: string) {
    const { data } = await api.delete(`${BASE}/alertas/templates/${id}`);
    return data;
  },

  async escalonamentos(): Promise<Escalonamento[]> {
    const { data } = await api.get(`${BASE}/alertas/escalonamentos`);
    return data;
  },

  async salvarEscalonamento(id: string | null, dados: Record<string, any>) {
    const { data } = id
      ? await api.put(`${BASE}/alertas/escalonamentos/${id}`, dados)
      : await api.post(`${BASE}/alertas/escalonamentos`, dados);
    return data;
  },

  async excluirEscalonamento(id: string) {
    const { data } = await api.delete(`${BASE}/alertas/escalonamentos/${id}`);
    return data;
  },

  async previa(): Promise<Previa> {
    const { data } = await api.get(`${BASE}/alertas/previa`);
    return data;
  },

  async envios(obrigacaoId?: string): Promise<Envio[]> {
    const { data } = await api.get(`${BASE}/alertas/envios`, { params: limpar({ obrigacaoId }) });
    return data;
  },

  async varrer(): Promise<{ examinadas: number; enviados: number; escalonamentos: number; marcadasVencidas: number }> {
    const { data } = await api.post(`${BASE}/alertas/varrer`);
    return data;
  },
};
