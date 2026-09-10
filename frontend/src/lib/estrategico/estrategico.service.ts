import { api } from "../api";
import type {
  ListaCasos, CasoDetalhe, Filtros, Evento, Tarefa, Comentario, Dependencia, Documento, ItemHistorico,
  ValorHistorico, Painel, MinhasAcoes, ReuniaoResumo, Reuniao, TipoRelatorio, TabelaRelatorio, Catalogo,
  Config, PerfilEstrategico, PreviaImportacao, ResultadoImportacao, ResultadoAutomacao,
} from "./types";

/**
 * Acesso à API do Orkiestri Strategy (`/api/v1/estrategico`).
 *
 * Documentos NÃO têm URL: todo acesso passa pelo download autenticado, que
 * valida escopo e permissão e fica na trilha de auditoria.
 */

const BASE = "/v1/estrategico";

export type ConsultaCasos = {
  q?: string; farol?: string; etapa?: string; tipo?: string; objetivoId?: string; esferaId?: string;
  grupoId?: string; areaId?: string; dependenciaId?: string; prioridade?: string; responsavelId?: string;
  recorte?: string; paradoDias?: number; ordenar?: string;
};

function limpar(consulta: Record<string, any>): Record<string, any> {
  const saida: Record<string, any> = {};
  for (const [k, v] of Object.entries(consulta)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    saida[k] = v;
  }
  return saida;
}

async function baixar(url: string, params: Record<string, any>, nomePadrao: string) {
  const resposta = await api.get(url, { params, responseType: "blob" });
  const cd = String(resposta.headers?.["content-disposition"] ?? "");
  const m = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(cd);
  const nome = m ? decodeURIComponent(m[1] ?? m[2]) : nomePadrao;
  const href = URL.createObjectURL(resposta.data as Blob);
  try {
    const a = document.createElement("a");
    a.href = href;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(href), 2000);
  }
}

const multipart = (campos: Record<string, any>, arquivo: File) => {
  const fd = new FormData();
  fd.append("arquivo", arquivo);
  for (const [k, v] of Object.entries(campos)) if (v !== undefined && v !== null && v !== "") fd.append(k, String(v));
  return fd;
};

export const estrategicoService = {
  /* Casos */
  async listar(consulta: ConsultaCasos = {}): Promise<ListaCasos> {
    const { data } = await api.get(`${BASE}/casos`, { params: limpar(consulta) });
    return data;
  },
  async filtros(): Promise<Filtros> {
    const { data } = await api.get(`${BASE}/casos/filtros`, { silent: true });
    return data;
  },
  async obter(id: string): Promise<CasoDetalhe> {
    const { data } = await api.get(`${BASE}/casos/${id}`);
    return data;
  },
  async criar(dados: Record<string, any>): Promise<CasoDetalhe> {
    const { data } = await api.post(`${BASE}/casos`, dados);
    return data;
  },
  async atualizar(id: string, dados: Record<string, any>): Promise<CasoDetalhe> {
    const { data } = await api.put(`${BASE}/casos/${id}`, dados);
    return data;
  },
  async farol(id: string, farol: string | null, justificativa?: string): Promise<CasoDetalhe> {
    const { data } = await api.patch(`${BASE}/casos/${id}/farol`, { farol, justificativa });
    return data;
  },
  async excluir(id: string) {
    const { data } = await api.delete(`${BASE}/casos/${id}`);
    return data;
  },
  async historico(id: string): Promise<ItemHistorico[]> {
    const { data } = await api.get(`${BASE}/casos/${id}/historico`);
    return data;
  },
  async valores(id: string): Promise<ValorHistorico[]> {
    const { data } = await api.get(`${BASE}/casos/${id}/valores`, { silent: true });
    return data;
  },

  /* Timeline */
  async eventos(casoId: string): Promise<Evento[]> {
    const { data } = await api.get(`${BASE}/casos/${casoId}/eventos`);
    return data;
  },
  async criarEvento(casoId: string, dados: Record<string, any>): Promise<Evento> {
    const { data } = await api.post(`${BASE}/casos/${casoId}/eventos`, dados);
    return data;
  },
  async atualizarEvento(id: string, dados: Record<string, any>): Promise<Evento> {
    const { data } = await api.put(`${BASE}/eventos/${id}`, dados);
    return data;
  },
  async excluirEvento(id: string) {
    const { data } = await api.delete(`${BASE}/eventos/${id}`);
    return data;
  },

  /* Tarefas */
  async minhas(): Promise<MinhasAcoes> {
    const { data } = await api.get(`${BASE}/minhas`);
    return data;
  },
  async tarefas(casoId: string): Promise<Tarefa[]> {
    const { data } = await api.get(`${BASE}/casos/${casoId}/tarefas`);
    return data;
  },
  async criarTarefa(casoId: string, dados: Record<string, any>): Promise<Tarefa> {
    const { data } = await api.post(`${BASE}/casos/${casoId}/tarefas`, dados);
    return data;
  },
  async atualizarTarefa(id: string, dados: Record<string, any>): Promise<Tarefa> {
    const { data } = await api.put(`${BASE}/tarefas/${id}`, dados);
    return data;
  },
  async excluirTarefa(id: string) {
    const { data } = await api.delete(`${BASE}/tarefas/${id}`);
    return data;
  },

  /* Comentários */
  async comentarios(casoId: string): Promise<Comentario[]> {
    const { data } = await api.get(`${BASE}/casos/${casoId}/comentarios`);
    return data;
  },
  async comentar(casoId: string, conteudo: string): Promise<Comentario> {
    const { data } = await api.post(`${BASE}/casos/${casoId}/comentarios`, { conteudo });
    return data;
  },
  async excluirComentario(id: string) {
    const { data } = await api.delete(`${BASE}/comentarios/${id}`);
    return data;
  },

  /* Dependências */
  async dependencias(casoId: string): Promise<Dependencia[]> {
    const { data } = await api.get(`${BASE}/casos/${casoId}/dependencias`);
    return data;
  },
  async criarDependencia(casoId: string, dados: Record<string, any>): Promise<Dependencia> {
    const { data } = await api.post(`${BASE}/casos/${casoId}/dependencias`, dados);
    return data;
  },
  async atualizarDependencia(id: string, dados: Record<string, any>): Promise<Dependencia> {
    const { data } = await api.put(`${BASE}/dependencias/${id}`, dados);
    return data;
  },
  async excluirDependencia(id: string) {
    const { data } = await api.delete(`${BASE}/dependencias/${id}`);
    return data;
  },

  /* Documentos */
  async documentos(casoId: string): Promise<Documento[]> {
    const { data } = await api.get(`${BASE}/casos/${casoId}/documentos`, { silent: true });
    return data;
  },
  async enviarDocumento(casoId: string, arquivo: File, campos: Record<string, any>): Promise<Documento> {
    const { data } = await api.post(`${BASE}/casos/${casoId}/documentos`, multipart(campos, arquivo), {
      headers: { "Content-Type": "multipart/form-data" }, timeout: 120000,
    });
    return data;
  },
  baixarDocumento(doc: { id: string; nomeOriginal: string }) {
    return baixar(`${BASE}/documentos/${doc.id}/download`, {}, doc.nomeOriginal);
  },
  async excluirDocumento(id: string) {
    const { data } = await api.delete(`${BASE}/documentos/${id}`);
    return data;
  },

  /* Painel e relatórios */
  async painel(filtros: Record<string, any> = {}): Promise<Painel> {
    const { data } = await api.get(`${BASE}/painel`, { params: limpar(filtros) });
    return data;
  },
  // Prévias em `/analises`: `/relatorios` cai no limite de 5 req/min do nginx
  // para exportações (ver painel.controller.ts). Só o arquivo usa `/relatorios`.
  async tiposRelatorio(): Promise<TipoRelatorio[]> {
    const { data } = await api.get(`${BASE}/analises`);
    return data;
  },
  async relatorio(tipo: string): Promise<TabelaRelatorio> {
    const { data } = await api.get(`${BASE}/analises/${tipo}`);
    return data;
  },
  exportarRelatorio(tipo: string, formato: "excel" | "csv" | "pdf") {
    const ext = formato === "excel" ? "xlsx" : formato;
    return baixar(`${BASE}/relatorios/${tipo}/exportar`, { formato }, `estrategico-${tipo}.${ext}`);
  },

  /* Reuniões */
  async reunioes(): Promise<ReuniaoResumo[]> {
    const { data } = await api.get(`${BASE}/reunioes`);
    return data;
  },
  async reuniao(id: string): Promise<Reuniao> {
    const { data } = await api.get(`${BASE}/reunioes/${id}`);
    return data;
  },
  async criarReuniao(dados: Record<string, any>): Promise<Reuniao> {
    const { data } = await api.post(`${BASE}/reunioes`, dados);
    return data;
  },
  async regerarPauta(id: string): Promise<Reuniao> {
    const { data } = await api.post(`${BASE}/reunioes/${id}/pauta`);
    return data;
  },
  async anotar(id: string, casoId: string, dados: { discutido?: boolean; nota?: string }) {
    const { data } = await api.patch(`${BASE}/reunioes/${id}/anotacoes`, { casoId, ...dados }, { silent: true });
    return data;
  },
  async decidir(id: string, dados: { casoId?: string; descricao: string }) {
    const { data } = await api.post(`${BASE}/reunioes/${id}/decisoes`, dados);
    return data;
  },
  async tarefaReuniao(id: string, dados: Record<string, any>): Promise<Tarefa> {
    const { data } = await api.post(`${BASE}/reunioes/${id}/tarefas`, dados);
    return data;
  },
  async statusReuniao(id: string, status: "em_andamento" | "encerrada" | "cancelada"): Promise<Reuniao> {
    const { data } = await api.patch(`${BASE}/reunioes/${id}/status`, { status });
    return data;
  },
  baixarAta(id: string) {
    return baixar(`${BASE}/reunioes/${id}/ata.pdf`, {}, "ata-reuniao-estrategica.pdf");
  },

  /* Administração */
  async catalogos(): Promise<Catalogo[]> {
    const { data } = await api.get(`${BASE}/admin/catalogos`);
    return data;
  },
  async criarCatalogo(dados: Record<string, any>): Promise<Catalogo> {
    const { data } = await api.post(`${BASE}/admin/catalogos`, dados);
    return data;
  },
  async atualizarCatalogo(id: string, dados: Record<string, any>): Promise<Catalogo> {
    const { data } = await api.put(`${BASE}/admin/catalogos/${id}`, dados);
    return data;
  },
  async config(): Promise<Config> {
    const { data } = await api.get(`${BASE}/admin/config`);
    return data;
  },
  async salvarConfig(dados: Partial<Config>): Promise<Config> {
    const { data } = await api.put(`${BASE}/admin/config`, dados);
    return data;
  },
  async perfis(): Promise<{ perfis: PerfilEstrategico[]; permissoes: { permissao: string; descricao: string }[] }> {
    const { data } = await api.get(`${BASE}/admin/perfis`, { silent: true });
    return data;
  },
  async previaImportacao(arquivo: File): Promise<PreviaImportacao> {
    const { data } = await api.post(`${BASE}/admin/importacao/previa`, multipart({}, arquivo), {
      headers: { "Content-Type": "multipart/form-data" }, timeout: 120000,
    });
    return data;
  },
  async confirmarImportacao(arquivo: File): Promise<ResultadoImportacao> {
    const { data } = await api.post(`${BASE}/admin/importacao/confirmar`, multipart({}, arquivo), {
      headers: { "Content-Type": "multipart/form-data" }, timeout: 180000,
    });
    return data;
  },
  async executarAutomacoes(): Promise<ResultadoAutomacao> {
    const { data } = await api.post(`${BASE}/admin/automacoes/executar`, {}, { timeout: 120000 });
    return data;
  },
};
