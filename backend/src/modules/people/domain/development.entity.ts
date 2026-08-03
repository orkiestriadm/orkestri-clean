/**
 * Treinamentos, certificações e avaliação de desempenho — regras puras.
 *
 * Treinamento e avaliação vivem no mesmo arquivo porque compartilham a mesma
 * pergunta de negócio ("como esta pessoa está evoluindo"), mas não se
 * misturam: têm permissões distintas, e nota de desempenho é dado de carreira
 * que quem cuida de capacitação não necessariamente pode ler.
 */

import { diasDeCalendario } from "../../../common/datas";

/* ── Treinamento ──────────────────────────────────────────────────────────── */

export const TRAINING_STATUS = {
  PLANEJADO: "PLANEJADO",
  EM_ANDAMENTO: "EM_ANDAMENTO",
  CONCLUIDO: "CONCLUIDO",
  CANCELADO: "CANCELADO",
} as const;

export type StatusTreinamento = (typeof TRAINING_STATUS)[keyof typeof TRAINING_STATUS];

/**
 * Transições permitidas.
 *
 * CONCLUIDO e CANCELADO são finais. Reabrir um treinamento concluído apagaria
 * a data de conclusão e a validade do certificado já emitido — quem errou
 * registra de novo, o histórico não se reescreve.
 */
const TRANSICOES: Record<StatusTreinamento, readonly StatusTreinamento[]> = {
  PLANEJADO:    [TRAINING_STATUS.EM_ANDAMENTO, TRAINING_STATUS.CONCLUIDO, TRAINING_STATUS.CANCELADO],
  EM_ANDAMENTO: [TRAINING_STATUS.CONCLUIDO, TRAINING_STATUS.CANCELADO],
  CONCLUIDO:    [],
  CANCELADO:    [],
};

export function podeTransicionar(de: StatusTreinamento, para: StatusTreinamento): boolean {
  return TRANSICOES[de]?.includes(para) ?? false;
}

export function statusTreinamentoValido(valor: string): valor is StatusTreinamento {
  return Object.prototype.hasOwnProperty.call(TRANSICOES, valor);
}

/**
 * Validade do certificado a partir da conclusão.
 *
 * Devolve null quando o curso não expira. O resultado é GRAVADO na
 * participação: mudar `validadeMeses` do curso depois não pode reescrever
 * certificado já emitido.
 */
export function calcularValidade(conclusao: Date, validadeMeses: number | null): Date | null {
  if (validadeMeses === null || validadeMeses <= 0) return null;
  const d = new Date(conclusao);
  const diaOriginal = d.getDate();
  d.setMonth(d.getMonth() + validadeMeses);
  // 31/jan + 1 mês não pode virar 3/mar: o setMonth transborda sozinho.
  if (d.getDate() !== diaOriginal) d.setDate(0);
  return d;
}

export const DIAS_ALERTA_CERTIFICACAO = 60;

export type SituacaoCertificacao = "sem_validade" | "vigente" | "vence_em_breve" | "vencida";

export function situacaoCertificacao(
  validade: Date | null,
  hoje: Date = new Date(),
  janelaDias: number = DIAS_ALERTA_CERTIFICACAO,
): SituacaoCertificacao {
  if (!validade) return "sem_validade";
  const dias = diasEntre(hoje, validade);
  if (dias < 0) return "vencida";
  if (dias <= janelaDias) return "vence_em_breve";
  return "vigente";
}

/* ── Avaliação de desempenho ──────────────────────────────────────────────── */

export const REVIEW_STATUS = {
  RASCUNHO: "RASCUNHO",
  FINALIZADA: "FINALIZADA",
} as const;

export type StatusAvaliacao = (typeof REVIEW_STATUS)[keyof typeof REVIEW_STATUS];

export const NOTA_MINIMA = 0;
export const NOTA_MAXIMA = 5;

export type Meta = { peso: number; progresso: number };

export type MotivoRecusaAvaliacao =
  | "nota_fora_da_escala"
  | "ja_finalizada"
  | "sem_nota"
  | "auto_avaliacao"
  | "ciclo_invalido";

export type ResultadoAvaliacao = {
  valido: boolean;
  motivo?: MotivoRecusaAvaliacao;
  detalhe?: string;
};

/** `2026.1`, `2026.2` ou `2026` — ano com semestre opcional. */
export function cicloValido(ciclo: string): boolean {
  return /^\d{4}(\.[12])?$/.test(ciclo.trim());
}

export function validarAvaliacao(params: {
  ciclo: string;
  nota?: number | null;
  statusAtual?: StatusAvaliacao;
  finalizando?: boolean;
  colaboradorId?: string;
  avaliadorId?: string | null;
}): ResultadoAvaliacao {
  const { ciclo, nota = null, statusAtual, finalizando = false, colaboradorId, avaliadorId } = params;

  if (!cicloValido(ciclo)) {
    return {
      valido: false,
      motivo: "ciclo_invalido",
      detalhe: 'Use o formato "2026" ou "2026.1".',
    };
  }

  // Editar avaliação finalizada mudaria o registro que o colaborador já viu
  // e assinou. Correção vira novo ciclo, não reescrita do anterior.
  if (statusAtual === REVIEW_STATUS.FINALIZADA) {
    return {
      valido: false,
      motivo: "ja_finalizada",
      detalhe: "Esta avaliação já foi finalizada e não pode mais ser alterada.",
    };
  }

  if (avaliadorId && colaboradorId && avaliadorId === colaboradorId) {
    return {
      valido: false,
      motivo: "auto_avaliacao",
      detalhe: "O avaliador não pode ser o próprio avaliado.",
    };
  }

  if (nota !== null && (nota < NOTA_MINIMA || nota > NOTA_MAXIMA)) {
    return {
      valido: false,
      motivo: "nota_fora_da_escala",
      detalhe: `A nota deve estar entre ${NOTA_MINIMA} e ${NOTA_MAXIMA}.`,
    };
  }

  // Finalizar sem nota produz avaliação que não serve para nada: não entra em
  // média, não compara ciclo, não sustenta decisão de carreira.
  if (finalizando && nota === null) {
    return {
      valido: false,
      motivo: "sem_nota",
      detalhe: "Informe a nota antes de finalizar a avaliação.",
    };
  }

  return { valido: true };
}

/**
 * Progresso das metas ponderado pelo peso.
 *
 * Média simples trataria "entregar o projeto" (peso 5) igual a "fazer o curso
 * de compliance" (peso 1), e o número deixaria de significar algo.
 */
export function progressoPonderado(metas: Meta[]): number {
  const pesoTotal = metas.reduce((s, m) => s + Math.max(0, m.peso), 0);
  if (pesoTotal === 0) return 0;
  const soma = metas.reduce(
    (s, m) => s + Math.min(100, Math.max(0, m.progresso)) * Math.max(0, m.peso),
    0,
  );
  return Math.round(soma / pesoTotal);
}

/* ── Auxiliar ─────────────────────────────────────────────────────────────── */

/**
 * Diferença em dias inteiros, ignorando hora. Negativo se `ate` já passou.
 *
 * Delega para `diasDeCalendario` em vez de recortar o dia com os componentes
 * locais: `validade` vem de coluna DATE (meia-noite UTC) e era recuada um dia
 * em UTC-3 — certificação válida até hoje aparecia como vencida.
 */
export function diasEntre(de: Date, ate: Date): number {
  return diasDeCalendario(de, ate);
}
