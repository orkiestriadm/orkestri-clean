/**
 * Tipos do Orkiestri Strategy — espelham o que a API devolve
 * (backend/src/modules/estrategico/application/presenter.ts e serviços).
 */

export type Farol = "verde" | "amarelo" | "vermelho" | "cinza" | "azul";
export type NivelRisco = "baixo" | "moderado" | "alto" | "critico";
export type MotivoFarol = { nivel: "vermelho" | "amarelo"; codigo: string; texto: string };

export type Ref = { id: string; nome: string; cor?: string | null; natureza?: string | null };
export type Pessoa = { id: string; nome: string; avatar?: string | null };

export type DependenciaAtiva = {
  id: string;
  catalogoId: string | null;
  nome: string;
  natureza: string | null;
  organizacao: string | null;
  contato: string | null;
  descricao: string | null;
  desde: string | null;
  dias: number | null;
  respostaEsperadaEm: string | null;
  ultimoFollowUpEm: string | null;
  proximoFollowUpEm: string | null;
};

export type Caso = {
  id: string;
  codigo: string;
  titulo: string;
  descricao: string | null;
  tipo: "assunto" | "oportunidade";
  etapa: string;
  etapaRotulo: string;
  natureza: "oportunidade" | "ativa" | "suspensa" | "encerrada";
  aguardaTerceiro: boolean;
  ativo: boolean;
  estagioOportunidade: string | null;
  estagioRotulo: string | null;
  prioridade: string;
  prioridadeRotulo: string;
  statusTexto: string;

  grupo: Ref | null;
  objetivo: Ref | null;
  esfera: Ref | null;
  areaExecutiva: Ref | null;
  areaOperacional: Ref | null;
  areasApoio: Ref[];
  responsavelExecutivo: Pessoa | null;
  responsavelOperacional: Pessoa | null;

  proximaAcao: string | null;
  proximaAcaoResponsavel: Pessoa | null;
  proximaAcaoResponsavelNome: string | null;
  proximaAcaoPrazo: string | null;
  proximaAcaoPrioridade: string | null;
  prazoFinal: string | null;
  ultimaMovimentacaoEm: string | null;

  diasParado: number | null;
  faixaAging: string;
  diasProximaAcao: number | null;
  semProximaAcao: boolean;
  acaoVencida: boolean;
  prazoFinalVencido: boolean;
  vencido: boolean;

  dependencias: DependenciaAtiva[];
  dependenciaTexto: string | null;
  tarefasVencidas: number;

  financeiroVisivel: boolean;
  classificacaoFinanceira: string | null;
  moeda: string;
  valorPretendido: number | null;
  valorSolicitado: number | null;
  valorEmAnalise: number | null;
  valorReconhecido: number | null;
  valorAlcancado: number | null;
  valorRecebido: number | null;
  valorReequilibrio: number | null;
  valorEmRisco: number | null;
  valorPotencial: number | null;
  valoresReferenciaEm: string | null;
  valorPrincipal: number | null;
  temValor: boolean | null;

  probabilidade: number | null;
  impacto: number | null;
  riscoFinanceiro: number | null;
  riscoJuridico: number | null;
  riscoRegulatorio: number | null;
  riscoOperacional: number | null;
  riscoPrazo: number | null;
  planoMitigacao: string | null;
  riscoScore: number | null;
  riscoNivel: NivelRisco | null;

  farol: Farol;
  farolRotulo: string;
  farolCalculado: Farol;
  farolMotivos: MotivoFarol[];
  farolManual: Farol | null;
  farolJustificativa: string | null;
  farolDivergente: boolean;

  statusOriginal: string | null;
  importado: boolean;
  revisarImportacao: boolean;
  encerradoEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
};

export type CasoDetalhe = Caso & {
  podeEditar: boolean;
  andamentosOriginais: string | null;
  importacao: {
    arquivo: string;
    aba: string;
    linha: number;
    grupo: string | null;
    celulasOriginais: Record<string, string | number | null>;
    pendencias: string[];
    trechosSemData: string[];
    valoresCitados: { texto: string; valor: number; trecho: string }[];
    importadoEm: string;
  } | null;
};

export type Contagens = {
  total: number;
  porFarol: Record<Farol, number>;
  ativos: number;
  semAcao: number;
  vencidos: number;
  parados: number;
  semMovimentacao: number;
  revisar: number;
  suspensos: number;
  oportunidades: number;
  riscoAlto: number;
  semResponsavel: number;
};

export type ListaCasos = { itens: Caso[]; total: number; contagens: Contagens };

export type ItemCatalogo = { id: string; nome: string; cor: string | null; natureza: string | null };
export type Rotulado = { id: string; rotulo: string };

export type Filtros = {
  grupos: ItemCatalogo[];
  objetivos: ItemCatalogo[];
  esferas: ItemCatalogo[];
  areas: ItemCatalogo[];
  dependencias: ItemCatalogo[];
  usuarios: Pessoa[];
  etapas: { id: string; rotulo: string; natureza: string; aguardaTerceiro?: boolean }[];
  pipeline: Rotulado[];
  prioridades: Rotulado[];
  tiposEvento: Rotulado[];
  categoriasDocumento: Rotulado[];
  classificacoesFinanceiras: Rotulado[];
  faixasAging: Rotulado[];
  dimensoesRisco: { campo: string; rotulo: string }[];
  camposValor: { campo: string; rotulo: string }[];
  farois: { id: Farol; rotulo: string }[];
};

export type Evento = {
  id: string;
  casoId: string;
  tipo: string;
  dataEvento: string;
  precisaoData: "dia" | "mes";
  titulo: string;
  descricao: string | null;
  decisao: string | null;
  proximoPasso: string | null;
  responsavel: Pessoa | null;
  autorId: string | null;
  origem: "manual" | "importacao" | "sistema" | "reuniao";
  revisar: boolean;
  criadoEm: string;
};

export type Tarefa = {
  id: string;
  casoId: string;
  titulo: string;
  descricao: string | null;
  responsavelId: string | null;
  responsavel: Pessoa | null;
  prazo: string | null;
  prioridade: string;
  status: "pendente" | "em_andamento" | "bloqueada" | "concluida" | "cancelada";
  dependencia: string | null;
  conclusao: string | null;
  concluidaEm: string | null;
  origem: "manual" | "reuniao" | "automacao";
  reuniaoId: string | null;
  criadoPorId: string | null;
  aberta: boolean;
  diasPrazo: number | null;
  vencida: boolean;
  caso?: { id: string; codigo: string; titulo: string };
};

export type Comentario = { id: string; conteudo: string; criadoEm: string; userId: string; user: Pessoa };

export type Dependencia = {
  id: string;
  catalogoId: string | null;
  nome: string;
  organizacao: string | null;
  contato: string | null;
  descricao: string | null;
  desde: string | null;
  dias: number | null;
  respostaEsperadaEm: string | null;
  ultimoFollowUpEm: string | null;
  proximoFollowUpEm: string | null;
  resolvidaEm: string | null;
  catalogo: { id: string; nome: string; natureza: string | null } | null;
};

export type Documento = {
  id: string;
  grupoId: string;
  categoria: string;
  categoriaRotulo: string;
  titulo: string;
  nomeOriginal: string;
  mime: string | null;
  tamanho: number | null;
  versao: number;
  documentoOrigemId: string | null;
  observacoes: string | null;
  enviadoPor: string | null;
  criadoEm: string;
};

export type ItemHistorico = {
  id: string;
  acao: string;
  campo: string | null;
  valorAnterior: string | null;
  valorNovo: string | null;
  descricao: string | null;
  origem: string;
  criadoEm: string;
  user: { id: string; nome: string } | null;
};

export type ValorHistorico = {
  id: string;
  campo: string;
  rotulo: string;
  valorAnterior: number | null;
  valorNovo: number | null;
  referenciaEm: string | null;
  observacao: string | null;
  origem: string;
  usuario: string | null;
  criadoEm: string;
};

export type ResumoCaso = {
  id: string; codigo: string; titulo: string; farol: Farol; etapaRotulo: string; statusTexto: string;
  proximaAcao: string | null; proximaAcaoPrazo: string | null; diasProximaAcao: number | null;
  diasParado: number | null; ultimaMovimentacaoEm: string | null; riscoNivel: NivelRisco | null;
  riscoScore: number | null; valorPrincipal: number | null; motivo: string | null; responsavel: string | null;
};

export type Barra = { id: string; rotulo: string; valor: number; criticos?: number; casos?: string[]; cor?: string };

export type Painel = {
  geradoEm: string;
  financeiroVisivel: boolean;
  kpis: {
    total: number; emAndamento: number; emAtencao: number; criticos: number; suspensos: number; encerrados: number;
    oportunidades: number; semProximaAcao: number; vencidos: number; parados30: number; parados60: number; parados90: number;
    semMovimentacao: number; semResponsavel: number; revisar: number; riscoAltoOuCritico: number; semAvaliacaoRisco: number;
  };
  valores: (Record<string, number> & { casosComValor: number; casosSemValor: number }) | null;
  graficos: {
    porObjetivo: Barra[]; porEsfera: Barra[]; porGrupo: Barra[]; porEtapa: (Barra & { natureza: string })[];
    porFarol: Barra[]; porArea: Barra[]; porResponsavel: Barra[]; porDependencia: Barra[]; aging: Barra[];
    valorPorAssunto: Barra[] | null; valorPorObjetivo: Barra[] | null; valorPorFarol: Barra[] | null;
  };
  pipeline: { id: string; rotulo: string; quantidade: number; potencial: number | null; casos: { id: string; codigo: string; titulo: string; farol: Farol }[] }[];
  matrizRisco: { probabilidade: number; impacto: number; quantidade: number; casos: { id: string; codigo: string; titulo: string }[] }[];
  evolucaoMensal: { mes: string; rotulo: string; andamentos: number; decisoes: number; encerrados: number; novos: number; valorReconhecido: number | null }[];
  quemPrecisaAgir: { chave: string; nome: string; tipo: string; assuntos: number; acoesVencidas: number; semAcao: number; criticos: number; tarefasAbertas: number; tarefasVencidas: number }[];
  oQueMudou: {
    desde: string;
    referencia: { tipo: "reuniao"; id: string; titulo: string; data: string } | { tipo: "30_dias" };
    novos: { id: string; codigo: string; titulo: string; tipo: string }[];
    farolMudou: number;
    casos: { caso: { id: string; codigo: string; titulo: string; farol: Farol }; alteracoes: number; ultimas: { acao: string; campo: string | null; descricao: string | null; origem: string; criadoEm: string; usuario: string | null; valorAnterior: string | null; valorNovo: string | null }[] }[];
  };
  oQueImporta: ResumoCaso[];
  oQueEstaParado: ResumoCaso[];
  semMovimentacao: ResumoCaso[];
  vencidos: ResumoCaso[];
  semProximaAcao: ResumoCaso[];
  parametros: { diasAtencaoSemMovimento: number; diasCriticoSemMovimento: number };
};

export type MinhasAcoes = { acoes: Caso[]; responsavelDe: Caso[]; tarefas: Tarefa[] };

export type ItemPauta = { casoId: string; codigo: string; titulo: string; farol: Farol | null; etapa: string | null; motivo: string; tarefaId?: string };
export type SecaoPauta = { id: string; titulo: string; itens: ItemPauta[] };

export type ReuniaoResumo = {
  id: string; titulo: string; dataReuniao: string; local: string | null;
  status: "planejada" | "em_andamento" | "encerrada" | "cancelada";
  participantes: { userId: string | null; nome: string }[];
  encerradaEm: string | null; criadoEm: string; _count: { decisoes: number };
};

export type Reuniao = ReuniaoResumo & {
  pauta: SecaoPauta[];
  anotacoes: Record<string, { discutido?: boolean; nota?: string }>;
  ata: string | null;
  referenciaDesde: string | null;
  iniciadaEm: string | null;
  decisoes: { id: string; descricao: string; decididoEm: string; caso: { id: string; codigo: string; titulo: string } | null }[];
  tarefas: Tarefa[];
  situacaoAtual: Record<string, { farol: Farol; farolRotulo: string; statusTexto: string; proximaAcao: string | null; proximaAcaoPrazo: string | null; proximaAcaoResponsavel: string | null }>;
};

export type TipoRelatorio = { id: string; titulo: string; descricao: string; financeiro?: boolean };
export type TabelaRelatorio = {
  tipo: string; titulo: string; colunas: string[]; moeda: number[];
  linhas: (string | number | null)[][]; totais?: (string | number | null)[]; avisos: string[]; geradoEm: string;
};

export type Catalogo = {
  id: string; tipo: "grupo" | "objetivo" | "esfera" | "area" | "dependencia"; nome: string; descricao: string | null;
  cor: string | null; natureza: string | null; ordem: number; ativo: boolean; emUso: number;
};

export type Config = {
  diasAtencaoSemMovimento: number; diasCriticoSemMovimento: number; diasAtrasoCritico: number;
  diasDependenciaAtencao: number; diasFollowUp: number; antecedenciasAviso: number[]; diasEscalonamento: number;
  limiarValorRelevante: number | string | null; automacoesAtivas: boolean; notificarEmail: boolean;
  gestoresEscalonamento: string[];
};

/** Quem enxerga o Strategy e por qual caminho (papel, administrador, master, concessão direta). */
export type AcessoEstrategico = { papel: string; pessoas: { id: string; nome: string; cargo: string | null; via: string[] }[] };

export type CasoPrevia = {
  linha: number; chave: string; titulo: string; grupo: string | null; tipo: string; estagioOportunidade: string | null;
  objetivo: string | null; esfera: string | null; areaOperacional: string | null; areasApoio: string[];
  statusOriginal: string | null; situacaoOriginal: string | null; etapa: string; dependencia: string | null;
  andamentosOriginais: string | null;
  eventos: { data: string; precisao: string; tipo: string; titulo: string; descricao: string; contexto?: string }[];
  trechosSemData: string[];
  valores: Record<string, number | null>;
  valoresCitados: { texto: string; valor: number; trecho: string }[];
  pendencias: string[]; ultimaMovimentacao: string | null;
  jaImportado: { codigo: string; excluido: boolean } | null;
};

export type PreviaImportacao = {
  arquivo: string; aba: string; linhaCabecalho: number; colunas: Record<string, string>;
  casos: CasoPrevia[]; grupos: string[];
  catalogos: { objetivo: { nome: string; variacoes: string[] }[]; esfera: { nome: string; variacoes: string[] }[]; area: { nome: string; variacoes: string[] }[]; dependencia: string[] };
  avisos: string[];
  resumo: { casos: number; novos: number; jaImportados: number; eventos: number; trechosSemData: number; oportunidades: number; comValor: number };
};

export type ResultadoImportacao = {
  criados: { codigo: string; titulo: string; eventos: number; pendencias: number }[];
  ignorados: { titulo: string; motivo: string }[];
  eventos: number; dependencias: number; catalogosCriados: string[];
};

export type ResultadoAutomacao = {
  organizacoes: number; casos: number; farolAlterado: number; avisos: number; escalonamentos: number;
  followUps: number; semDestinatario: number; desativadas: number;
};

/* ── Vocabulário visual ──────────────────────────────────────────────────── */

export const ROTULO_FAROL: Record<Farol, string> = {
  vermelho: "Vermelho", amarelo: "Amarelo", azul: "Azul", verde: "Verde", cinza: "Cinza",
};

/** O que cada cor QUER DIZER — vai no `title`, para a cor nunca ser a única informação. */
export const SIGNIFICADO_FAROL: Record<Farol, string> = {
  vermelho: "Risco relevante — financeiro, jurídico, regulatório ou de prazo",
  amarelo: "Dependência, atraso potencial ou necessidade de acompanhamento",
  azul: "Oportunidade ainda em estruturação",
  verde: "Situação controlada, avanço dentro do esperado",
  cinza: "Suspenso ou cancelado",
};

export const COR_FAROL: Record<Farol, string> = {
  vermelho: "var(--accent-red)",
  amarelo: "var(--accent-amber)",
  azul: "var(--accent-cyan)",
  verde: "var(--accent-green)",
  cinza: "var(--text-muted)",
};

export const TOM_FAROL: Record<Farol, "critico" | "atencao" | "info" | "ok" | "neutro"> = {
  vermelho: "critico", amarelo: "atencao", azul: "info", verde: "ok", cinza: "neutro",
};

export const ORDEM_FAROL: Farol[] = ["vermelho", "amarelo", "azul", "verde", "cinza"];

export const ROTULO_RISCO: Record<NivelRisco, string> = { baixo: "Baixo", moderado: "Moderado", alto: "Alto", critico: "Crítico" };
export const TOM_RISCO: Record<NivelRisco, "ok" | "info" | "atencao" | "critico"> = { baixo: "ok", moderado: "info", alto: "atencao", critico: "critico" };

export const ROTULO_STATUS_TAREFA: Record<string, string> = {
  pendente: "Pendente", em_andamento: "Em andamento", bloqueada: "Bloqueada", concluida: "Concluída", cancelada: "Cancelada",
};

export const ROTULO_TIPO_CATALOGO: Record<string, string> = {
  grupo: "Grupos", objetivo: "Objetivos", esfera: "Esferas", area: "Áreas", dependencia: "Dependências",
};
