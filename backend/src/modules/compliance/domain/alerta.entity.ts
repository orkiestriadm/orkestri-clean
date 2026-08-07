/**
 * Régua de alertas e composição das mensagens.
 *
 * Camada de domínio: funções puras. Quem consulta o banco e quem envia é o
 * serviço; aqui só se decide O QUE deveria ser enviado hoje.
 */

import { diasDeCalendario, dataBR } from "../../../common/datas";

export const CANAL = {
  INTERNO: "interno",
  EMAIL: "email",
  WHATSAPP: "whatsapp",
  WEBHOOK: "webhook",
} as const;

export type Canal = (typeof CANAL)[keyof typeof CANAL];
export const CANAL_VALUES = Object.values(CANAL) as Canal[];

export const DESTINATARIO = {
  RESPONSAVEL: "responsavel",
  GESTOR: "gestor",
  EQUIPE: "equipe",
  ADMINISTRADOR: "administrador",
} as const;

export type Destinatario = (typeof DESTINATARIO)[keyof typeof DESTINATARIO];
export const DESTINATARIO_VALUES = Object.values(DESTINATARIO) as Destinatario[];

export const BASE_DATA = {
  VALIDADE: "validade",
  PRAZO_INTERNO: "prazo_interno",
  PRAZO_FATAL: "prazo_fatal",
} as const;

export type BaseData = (typeof BASE_DATA)[keyof typeof BASE_DATA];
export const BASE_DATA_VALUES = Object.values(BASE_DATA) as BaseData[];

/** Régua sugerida na especificação, em dias antes da data base. */
export const DIAS_ANTES_PADRAO: readonly number[] = [180, 120, 90, 60, 30, 15, 10, 7, 5, 3, 1, 0];
/** Cobrança depois do vencimento — parar no dia D é perder a cobrança. */
export const DIAS_DEPOIS_PADRAO: readonly number[] = [1, 3, 7, 15, 30];

/* ── Qual marco vale hoje ─────────────────────────────────────────────────── */

export type Marco = {
  /** Chave estável usada na idempotência: "antes:30", "depois:7". */
  id: string;
  tipo: "antes" | "depois";
  dias: number;
};

/**
 * O marco vigente hoje — não o marco que casa exatamente com hoje.
 *
 * A diferença importa. Disparar só na igualdade (`faltam exatamente 30 dias`)
 * significa que uma varredura que não rodou — API reiniciando, deploy, feriado
 * com o container parado — perde aquele aviso para sempre, silenciosamente.
 *
 * Aqui devolvemos o marco mais recente já CRUZADO. Se a varredura ficou três
 * dias fora do ar, no retorno ela dispara o marco da janela atual, uma vez só.
 * A chave de idempotência (`ComplianceNotificacaoEnvio.chave`) garante que a
 * repetição diária dentro da mesma janela não vire trinta e-mails iguais.
 *
 * @param diasParaBase dias até a data base; negativo se ela já passou.
 */
export function marcoVigente(
  diasParaBase: number,
  diasAntes: readonly number[],
  diasDepois: readonly number[],
): Marco | null {
  if (diasParaBase >= 0) {
    // Marco mais recentemente cruzado = o menor limiar ainda >= dias restantes.
    const candidatos = diasAntes.filter(d => d >= diasParaBase);
    if (candidatos.length === 0) return null;
    const dias = Math.min(...candidatos);
    return { id: `antes:${dias}`, tipo: "antes", dias };
  }

  const atraso = -diasParaBase;
  const candidatos = diasDepois.filter(d => d <= atraso);
  if (candidatos.length === 0) return null;
  const dias = Math.max(...candidatos);
  return { id: `depois:${dias}`, tipo: "depois", dias };
}

/** Data base efetiva da régua, dentre as três da obrigação. */
export function dataBaseDe(
  base: string,
  obrigacao: {
    dataValidade?: Date | string | null;
    prazoInternoEm?: Date | string | null;
    prazoFatalEm?: Date | string | null;
  },
): Date | string | null {
  if (base === BASE_DATA.VALIDADE) return obrigacao.dataValidade ?? null;
  if (base === BASE_DATA.PRAZO_FATAL) return obrigacao.prazoFatalEm ?? obrigacao.dataValidade ?? null;
  // Padrão: prazo interno, caindo para o fatal e daí para a validade quando a
  // obrigação não tem antecedência configurada.
  return obrigacao.prazoInternoEm ?? obrigacao.prazoFatalEm ?? obrigacao.dataValidade ?? null;
}

/** Escalonamento devido hoje, dado o atraso a partir do prazo interno. */
export function degrauEscalonamento<T extends { aposDias: number; ordem: number }>(
  degraus: readonly T[],
  diasDeAtraso: number,
): T | null {
  if (diasDeAtraso <= 0) return null;
  const cruzados = degraus.filter(d => d.aposDias <= diasDeAtraso);
  if (cruzados.length === 0) return null;
  // O degrau mais alto já cruzado: quem chegou ao diretor não precisa mais do
  // aviso ao gestor.
  return cruzados.reduce((maior, d) => (d.aposDias > maior.aposDias ? d : maior));
}

/* ── Mensagem ─────────────────────────────────────────────────────────────── */

export type ContextoMensagem = {
  nomeObrigacao: string;
  codigo: string;
  categoria: string;
  sigla?: string | null;
  numeroDocumento?: string | null;
  responsavel: string;
  orgao?: string | null;
  unidade?: string | null;
  dataValidade?: Date | string | null;
  prazoInterno?: Date | string | null;
  prazoFatal?: Date | string | null;
  dias: number;
  situacao: string;
  link?: string;
  /** Campos personalizados, acessíveis como {{campo.chave}}. */
  campos?: Record<string, string>;
};

/**
 * Substitui os marcadores `{{Nome}}` do template.
 *
 * Comparação sem acento e sem caixa: o administrador escreve `{{Responsavel}}`,
 * `{{responsável}}` ou `{{RESPONSAVEL}}` e as três funcionam. Um template que
 * falha em silêncio por causa de um acento é pior que um erro de sintaxe.
 *
 * Marcador desconhecido é mantido literal, não apagado — assim o autor vê o que
 * escreveu errado em vez de receber uma frase com um buraco.
 */
export function renderizarTemplate(template: string, ctx: ContextoMensagem): string {
  const mapa = montarMapa(ctx);

  return template.replace(/\{\{\s*([\w.\u00c0-\u024f]+)\s*\}\}/g, (original, chave: string) => {
    const valor = mapa.get(normalizar(chave));
    return valor == null ? original : valor;
  });
}

function montarMapa(ctx: ContextoMensagem): Map<string, string> {
  const m = new Map<string, string>();
  const put = (chave: string, valor: string | null | undefined) => {
    m.set(normalizar(chave), valor ?? "");
  };

  put("nomeobrigacao", ctx.nomeObrigacao);
  put("obrigacao", ctx.nomeObrigacao);
  put("codigo", ctx.codigo);
  put("categoria", ctx.categoria);
  put("sigla", ctx.sigla);
  put("numero", ctx.numeroDocumento);
  put("numerodocumento", ctx.numeroDocumento);
  put("responsavel", ctx.responsavel);
  put("orgao", ctx.orgao);
  put("unidade", ctx.unidade);
  put("datavalidade", dataBR(ctx.dataValidade));
  put("validade", dataBR(ctx.dataValidade));
  put("prazointerno", dataBR(ctx.prazoInterno));
  put("prazofatal", dataBR(ctx.prazoFatal));
  put("dias", String(Math.abs(ctx.dias)));
  put("diasrestantes", String(ctx.dias));
  put("situacao", ctx.situacao);
  put("link", ctx.link);

  for (const [chave, valor] of Object.entries(ctx.campos ?? {})) {
    put(`campo.${chave}`, valor);
  }
  return m;
}

/** Minúsculas sem acento — `Validade`, `validade` e `VALIDADE` são a mesma coisa. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Mensagem padrão quando não há template cadastrado.
 *
 * Escrita para ser lida no celular, na notificação do sistema e no assunto de
 * e-mail sem adaptação: o que é, de quem é, quanto tempo resta.
 */
export function mensagemPadrao(ctx: ContextoMensagem): { titulo: string; corpo: string } {
  const atrasada = ctx.dias < 0;
  const dias = Math.abs(ctx.dias);
  const quando = ctx.dias === 0
    ? "vence hoje"
    : atrasada
      ? `venceu há ${dias} ${dias === 1 ? "dia" : "dias"}`
      : `vence em ${dias} ${dias === 1 ? "dia" : "dias"}`;

  const identificacao = [ctx.sigla, ctx.numeroDocumento].filter(Boolean).join(" ");
  const sufixo = identificacao ? ` (${identificacao})` : "";

  return {
    titulo: atrasada ? `Obrigação vencida: ${ctx.nomeObrigacao}` : `Obrigação a vencer: ${ctx.nomeObrigacao}`,
    corpo:
      `${ctx.nomeObrigacao}${sufixo} ${quando}.` +
      (ctx.dataValidade ? ` Validade: ${dataBR(ctx.dataValidade)}.` : "") +
      (ctx.prazoFatal ? ` Prazo fatal para protocolar: ${dataBR(ctx.prazoFatal)}.` : "") +
      (ctx.unidade ? ` Unidade: ${ctx.unidade}.` : ""),
  };
}

/**
 * Chave de idempotência de um envio.
 *
 * Sem ela a varredura reenviaria o mesmo aviso todo dia até a data passar. O
 * destino entra na chave porque o mesmo marco vai para várias pessoas, e cada
 * uma precisa receber a sua.
 */
export function chaveEnvio(
  obrigacaoId: string, marcoId: string, canal: string, destino: string,
): string {
  return `${obrigacaoId}|${marcoId}|${canal}|${destino.toLowerCase()}`;
}

/** Dias entre hoje e a base, com a mesma aritmética de calendário do domínio. */
export function diasAte(base: Date | string, hoje: Date = new Date()): number {
  return diasDeCalendario(hoje, base);
}
