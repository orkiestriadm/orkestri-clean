/**
 * Feedback da Avaliação de Desempenho — regras puras.
 *
 * Segue o fluxo descrito pelo RH, etapa por etapa, e nada além dele:
 *
 *   1. REGISTRO   — o gestor escreve pontos fortes e oportunidades de desenvolvimento.
 *   2. REUNIÃO    — o gestor agenda e realiza a conversa individual, alinhando
 *                   expectativas e próximos passos.
 *   3. CIÊNCIA    — depois da reunião, o colaborador lê e registra ciência,
 *                   com comentário opcional.
 *   4. ENCERRAMENTO — o processo termina e formaliza os alinhamentos.
 *
 * Um status por etapa. Não há devolução, cancelamento nem reabertura porque o
 * fluxo do RH não prevê — acrescentar caminhos que ninguém pediu é o jeito
 * mais rápido de o sistema divergir do processo que ele deveria registrar.
 *
 * NÃO é o feedback contínuo (`performance_feedbacks`), que continua existindo:
 * aquele é anotação solta do dia a dia; este é o registro formal que vai se
 * ligar ao modelo de avaliação de desempenho.
 *
 * A única saída fora do fluxo é a EXCLUSÃO, e ela não é do gestor: ele pede, o
 * RH aprova ou reprova. Enquanto o pedido está pendente o fluxo fica parado —
 * seguir conduzindo um registro que pode sumir faria o colaborador dar ciência
 * de algo que o RH talvez apague.
 */

export const STATUS_FEEDBACK = {
  REGISTRADO: "REGISTRADO",
  REUNIAO_AGENDADA: "REUNIAO_AGENDADA",
  AGUARDANDO_CIENCIA: "AGUARDANDO_CIENCIA",
  ENCERRADO: "ENCERRADO",
} as const;
export type StatusFeedback = (typeof STATUS_FEEDBACK)[keyof typeof STATUS_FEEDBACK];

export const ROTULO_STATUS: Record<StatusFeedback, string> = {
  REGISTRADO: "Registrado",
  REUNIAO_AGENDADA: "Reunião agendada",
  AGUARDANDO_CIENCIA: "Aguardando ciência",
  ENCERRADO: "Encerrado",
};

export const EXCLUSAO = { PENDENTE: "PENDENTE", REPROVADA: "REPROVADA" } as const;

export type AcaoFeedback =
  | "editar"
  | "agendar_reuniao"
  | "reagendar_reuniao"
  | "registrar_reuniao"
  | "registrar_ciencia"
  | "solicitar_exclusao"
  | "decidir_exclusao";

/** Quem está agindo em relação ao registro. Papel no REGISTRO, não no sistema. */
export type PapelNoFeedback = "gestor" | "colaborador" | "rh";

export type EstadoFeedback = {
  status: string;
  /** PENDENTE bloqueia o fluxo; REPROVADA ou nulo não. */
  exclusaoStatus: string | null;
};

export type MotivoRecusa =
  | "papel_nao_permitido"
  | "etapa_errada"
  | "exclusao_pendente"
  | "exclusao_nao_pendente"
  | "exclusao_ja_pendente";

/**
 * De qual etapa cada ação parte, e para qual leva.
 *
 * `destino` nulo = a ação não muda de etapa (editar, reagendar, pedidos de
 * exclusão). Editar só antes da reunião: depois dela o colaborador já leu, e
 * mudar o texto que ele leu desfaz a ciência que ele vai dar.
 */
const REGRAS: Record<AcaoFeedback, { papel: PapelNoFeedback; origem: StatusFeedback[]; destino: StatusFeedback | null }> = {
  editar:             { papel: "gestor",      origem: ["REGISTRADO", "REUNIAO_AGENDADA"], destino: null },
  agendar_reuniao:    { papel: "gestor",      origem: ["REGISTRADO"],                     destino: "REUNIAO_AGENDADA" },
  reagendar_reuniao:  { papel: "gestor",      origem: ["REUNIAO_AGENDADA"],               destino: null },
  registrar_reuniao:  { papel: "gestor",      origem: ["REUNIAO_AGENDADA"],               destino: "AGUARDANDO_CIENCIA" },
  registrar_ciencia:  { papel: "colaborador", origem: ["AGUARDANDO_CIENCIA"],             destino: "ENCERRADO" },
  // Qualquer etapa: o erro de registro pode ser percebido depois da ciência, e
  // quem decide se o registro some é o RH, não a etapa em que ele está.
  solicitar_exclusao: { papel: "gestor",      origem: ["REGISTRADO", "REUNIAO_AGENDADA", "AGUARDANDO_CIENCIA", "ENCERRADO"], destino: null },
  decidir_exclusao:   { papel: "rh",          origem: ["REGISTRADO", "REUNIAO_AGENDADA", "AGUARDANDO_CIENCIA", "ENCERRADO"], destino: null },
};

export const EXPLICACAO_RECUSA: Record<MotivoRecusa, string> = {
  papel_nao_permitido: "Esta ação não cabe a você neste feedback.",
  etapa_errada: "Esta ação não está disponível na etapa atual do feedback.",
  exclusao_pendente: "Há um pedido de exclusão aguardando o RH. O feedback fica parado até a decisão.",
  exclusao_nao_pendente: "Não há pedido de exclusão aguardando decisão.",
  exclusao_ja_pendente: "Já existe um pedido de exclusão aguardando o RH.",
};

/** Pode executar a ação? Nulo = pode; senão, o motivo da recusa. */
export function validarAcao(
  acao: AcaoFeedback,
  papel: PapelNoFeedback,
  estado: EstadoFeedback,
): MotivoRecusa | null {
  const regra = REGRAS[acao];
  if (regra.papel !== papel) return "papel_nao_permitido";
  if (!(regra.origem as string[]).includes(estado.status)) return "etapa_errada";

  const pendente = estado.exclusaoStatus === EXCLUSAO.PENDENTE;
  if (acao === "decidir_exclusao") return pendente ? null : "exclusao_nao_pendente";
  if (acao === "solicitar_exclusao") return pendente ? "exclusao_ja_pendente" : null;
  if (pendente) return "exclusao_pendente";

  return null;
}

/** Etapa depois da ação. Chamar só depois de `validarAcao` devolver nulo. */
export function proximoStatus(acao: AcaoFeedback, atual: StatusFeedback): StatusFeedback {
  return REGRAS[acao].destino ?? atual;
}

/** Ações que o papel pode executar agora — é o que a tela usa para mostrar botões. */
export function acoesDisponiveis(papel: PapelNoFeedback, estado: EstadoFeedback): AcaoFeedback[] {
  return (Object.keys(REGRAS) as AcaoFeedback[]).filter(a => validarAcao(a, papel, estado) === null);
}

/**
 * O colaborador pode ler o conteúdo?
 *
 * Só depois da reunião. O RH descreve a leitura como a etapa que vem DEPOIS da
 * conversa: quem lê o texto antes chega à reunião com a resposta pronta, e a
 * conversa deixa de ser a apresentação do feedback.
 */
export function colaboradorLeConteudo(status: string): boolean {
  return status === STATUS_FEEDBACK.AGUARDANDO_CIENCIA || status === STATUS_FEEDBACK.ENCERRADO;
}

/** O que falta preencher para o registro valer. Vazio = válido. */
export function camposFaltantesRegistro(dados: { pontosFortes?: string | null; oportunidades?: string | null }): string[] {
  const faltam: string[] = [];
  if (!dados.pontosFortes?.trim()) faltam.push("pontos fortes");
  if (!dados.oportunidades?.trim()) faltam.push("oportunidades de desenvolvimento");
  return faltam;
}

/**
 * A data informada como realização da reunião é aceitável?
 *
 * Não pode estar no futuro: "reunião realizada" amanhã é agendamento, e
 * liberaria o conteúdo ao colaborador antes da conversa. A folga de 5 minutos
 * cobre relógio de máquina adiantado.
 */
export function realizacaoValida(realizadaEm: Date, agora: Date = new Date()): boolean {
  return realizadaEm.getTime() <= agora.getTime() + 5 * 60_000;
}

export const DURACAO_REUNIAO_MIN = 60;
