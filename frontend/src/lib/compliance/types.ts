/**
 * Tipos do Orkiestri Compliance.
 *
 * `situacao` é DERIVADA no backend e nunca digitada — é a correção central em
 * relação à planilha que o módulo substitui, onde a coluna "Status" era escrita
 * à mão e por isso estava errada em três linhas.
 */

export type SituacaoPrazo =
  | "sem_validade"
  | "vigente"
  | "renovacao_devida"
  | "prazo_fatal_vencido"
  | "vencida"
  | "prorrogada";

export type BadgeTone = "ok" | "neutro" | "atencao" | "critico" | "info";

export type StatusObrigacao =
  | "ativa" | "em_renovacao" | "suspensa" | "vencida" | "cancelada" | "arquivada";

export type Criticidade = "baixa" | "media" | "alta" | "critica";

export const ROTULO_STATUS: Record<StatusObrigacao, string> = {
  ativa: "Ativa",
  em_renovacao: "Em renovação",
  suspensa: "Suspensa",
  vencida: "Vencida",
  cancelada: "Cancelada",
  arquivada: "Arquivada",
};

export const ROTULO_CRITICIDADE: Record<Criticidade, string> = {
  baixa: "Baixa", media: "Média", alta: "Alta", critica: "Crítica",
};

export const TOM_CRITICIDADE: Record<Criticidade, BadgeTone> = {
  baixa: "neutro", media: "info", alta: "atencao", critica: "critico",
};

export type Categoria = {
  id: string;
  nome: string;
  descricao: string | null;
  icone: string;
  cor: string;
  ativo: boolean;
  ordem: number;
  folgaInternaDias: number;
  totalObrigacoes?: number;
  campos?: CampoDefinicao[];
};

export type TipoCampo = "texto" | "texto_longo" | "numero" | "data" | "booleano" | "selecao";

export type CampoDefinicao = {
  id: string;
  chave: string;
  rotulo: string;
  tipo: TipoCampo;
  opcoes: string[];
  obrigatorio: boolean;
  ajuda: string | null;
  ordem: number;
  ativo?: boolean;
};

export type CampoPreenchido = {
  chave: string;
  rotulo: string;
  tipo: TipoCampo;
  obrigatorio: boolean;
  ajuda: string | null;
  opcoes: string[];
  valor: string | number | boolean | null;
};

export type Responsavel = {
  id?: string;
  papel: "principal" | "gestor" | "equipe" | "observador";
  userId?: string | null;
  collaboratorId?: string | null;
  nome?: string | null;
  email?: string | null;
  telefone?: string | null;
  notificar?: boolean;
  user?: { id: string; nome: string; email: string; avatar: string | null } | null;
};

export type Tag = { id: string; nome: string; cor: string; totalObrigacoes?: number };

export type Orgao = {
  id: string;
  nome: string;
  sigla: string | null;
  contato: string | null;
  telefone: string | null;
  email: string | null;
  site: string | null;
  endereco: string | null;
  totalObrigacoes?: number;
};

export type Obrigacao = {
  id: string;
  codigo: string;
  nome: string;
  sigla: string | null;
  numeroDocumento: string | null;
  descricao: string | null;
  categoriaId: string;
  categoria?: { id: string; nome: string; cor: string; icone: string; campos?: CampoDefinicao[] };
  orgaoId: string | null;
  orgao?: { id: string; nome: string; sigla: string | null } | null;

  empresa: string | null;
  filial: string | null;
  unidade: string | null;
  departamento: string | null;
  centroCusto: string | null;
  ativoIdentificador: string | null;
  projectId: string | null;
  project?: { id: string; titulo: string } | null;

  criticidade: Criticidade;
  status: StatusObrigacao;

  dataEmissao: string | null;
  dataValidade: string | null;
  dataAprovacao: string | null;
  dataUltimaRenovacao: string | null;

  validadeMeses: number | null;
  prazoMinimoDias: number;
  folgaInternaDias: number | null;

  prazoFatalEm: string | null;
  prazoInternoEm: string | null;
  prazoFatalManual: string | null;
  prazoInternoManual: string | null;

  renovacaoAutomatica: boolean;
  protocoloNumero: string | null;
  protocoloEm: string | null;
  protocoloObservacao: string | null;
  prorrogacaoVigente: boolean;

  valorLicenca: string | number | null;
  valorRenovacao: string | number | null;
  supplierId: string | null;
  notaFiscal: string | null;
  observacoes: string | null;

  versaoAtual: number;
  etapaId: string | null;

  responsaveis: Responsavel[];
  tags: Tag[];
  campos: CampoPreenchido[];

  /* Derivados pelo backend */
  situacao: SituacaoPrazo;
  situacaoRotulo: string;
  situacaoTom: BadgeTone;
  gravidade: number;
  diasParaValidade: number | null;
  diasParaPrazoFatal: number | null;
  diasParaPrazoInterno: number | null;
  favorito: boolean;

  criadoEm: string;
  atualizadoEm: string;
};

export type ListaObrigacoes = {
  itens: Obrigacao[];
  total: number;
  pagina: number;
  limite: number;
  paginas: number;
};

export type Filtros = {
  categorias: { id: string; nome: string; cor: string; icone: string; total: number }[];
  orgaos: { id: string; nome: string; sigla: string | null }[];
  tags: { id: string; nome: string; cor: string }[];
  unidades: string[];
  departamentos: string[];
  empresas: string[];
};

export type Painel = {
  cartoes: {
    total: number; ativas: number; vencidas: number; prorrogadas: number;
    venceHoje: number; vence7: number; vence30: number; vence90: number;
    renovacaoDevida: number; prazoFatalVencido: number; emRenovacao: number;
    semValidade: number;
  };
  graficos: {
    porCategoria: { categoriaId: string; nome: string; cor: string; icone: string; total: number }[];
    porStatus: { valor: string; total: number }[];
    porCriticidade: { valor: string; total: number }[];
    porUnidade: { valor: string; total: number }[];
    porDepartamento: { valor: string; total: number }[];
    porResponsavel: { id: string | null; nome: string; total: number }[];
    vencimentos: { mes: string; total: number; criticas: number }[];
  };
  filaDeAcao: Obrigacao[];
  custos: {
    totalLicencas: number;
    totalRenovacoes: number;
    obrigacoesComCusto: number;
    porCategoria: { categoriaId: string; nome: string; licenca: number; renovacao: number }[];
  };
  geradoEm: string;
};

export type MeuPainel = {
  total: number;
  vencidas: number;
  prazoFatalVencido: number;
  renovacaoDevida: number;
  prorrogadas: number;
  pendencias: Obrigacao[];
  obrigacoes: Obrigacao[];
  geradoEm: string;
};

export type EventoCalendario = {
  id: string;
  obrigacaoId: string;
  codigo: string;
  titulo: string;
  sigla: string | null;
  unidade: string | null;
  criticidade: Criticidade;
  categoria: { id: string; nome: string; cor: string };
  situacao: SituacaoPrazo;
  tipo: "prazo_interno" | "prazo_fatal" | "validade";
  rotulo: string;
  data: string;
  diasRestantes: number | null;
};

export type Anexo = {
  id: string;
  obrigacaoId: string;
  versaoId: string | null;
  titulo: string;
  nomeOriginal: string;
  mime: string | null;
  tamanho: number | null;
  versao: number;
  observacoes: string | null;
  criadoEm: string;
  arquivoDisponivel: boolean;
};

export type EventoHistorico = {
  id: string;
  acao: string;
  campo: string | null;
  valorAnterior: string | null;
  valorNovo: string | null;
  descricao: string | null;
  origem: string;
  criadoEm: string;
  user: { id: string; nome: string; avatar: string | null } | null;
};

export type Versao = {
  id: string;
  versao: number;
  numeroDocumento: string | null;
  dataEmissao: string | null;
  dataValidade: string | null;
  prazoMinimoDias: number;
  prazoFatalEm: string | null;
  prazoInternoEm: string | null;
  valor: string | null;
  observacao: string | null;
  encerradaEm: string | null;
  criadoEm: string;
};

export type Comentario = {
  id: string;
  conteudo: string;
  criadoEm: string;
  user: { id: string; nome: string; avatar: string | null };
};

/* ── Alertas ──────────────────────────────────────────────────────────────── */

export type Regra = {
  id: string;
  nome: string;
  categoriaId: string | null;
  obrigacaoId: string | null;
  baseData: "validade" | "prazo_interno" | "prazo_fatal";
  diasAntes: number[];
  diasDepois: number[];
  canais: string[];
  destinatarios: string[];
  emailsExtras: string[];
  whatsappsExtras: string[];
  templateId: string | null;
  ativo: boolean;
  categoria?: { id: string; nome: string } | null;
  obrigacao?: { id: string; codigo: string; nome: string } | null;
  template?: { id: string; nome: string; canal: string } | null;
};

export type Template = {
  id: string;
  nome: string;
  canal: "interno" | "email" | "whatsapp";
  assunto: string | null;
  corpo: string;
  ativo: boolean;
};

export type Escalonamento = {
  id: string;
  categoriaId: string | null;
  aposDias: number;
  alvo: "gestor" | "administrador" | "usuario" | "email";
  userId: string | null;
  emails: string[];
  ordem: number;
  ativo: boolean;
  categoria?: { id: string; nome: string } | null;
  user?: { id: string; nome: string; email: string } | null;
};

export type Envio = {
  id: string;
  obrigacaoId: string;
  marco: string;
  canal: string;
  destino: string;
  status: string;
  erro: string | null;
  enviadoEm: string;
  obrigacao?: { id: string; codigo: string; nome: string };
};

export type Previa = {
  hoje: string;
  previstos: {
    obrigacaoId: string;
    codigo: string;
    nome: string;
    marco: string;
    diasParaBase: number;
    regra: string;
    destinatarios: { canal: string; nome: string }[];
    semDestinatario: boolean;
  }[];
};

export const ROTULO_CANAL: Record<string, string> = {
  interno: "Notificação interna",
  email: "E-mail",
  whatsapp: "WhatsApp",
  webhook: "Webhook",
};

export const ROTULO_DESTINATARIO: Record<string, string> = {
  responsavel: "Responsável",
  gestor: "Gestor",
  equipe: "Equipe inteira",
  administrador: "Administradores",
};

export const ROTULO_BASE: Record<string, string> = {
  validade: "Data de validade",
  prazo_interno: "Prazo interno de renovação",
  prazo_fatal: "Prazo fatal para protocolar",
};
