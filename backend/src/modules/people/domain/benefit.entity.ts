/**
 * Benefícios — regras puras.
 *
 * A concessão tem vigência: `inicio` e `fim` opcional. Nulo em `fim` significa
 * vigente, não "encerrado sem data" — encerrar preenche a data. A linha nunca
 * é apagada, porque o histórico de quem teve o quê e quando é o próprio ponto
 * da tabela (folha, rescisão e auditoria trabalhista dependem dele).
 */

import { dataBR } from "../../../common/datas";

export const BENEFIT_CATEGORIES = [
  "saude", "alimentacao", "transporte", "educacao", "previdencia", "bem_estar", "outro",
] as const;

export type CategoriaBeneficio = (typeof BENEFIT_CATEGORIES)[number];

export function categoriaValida(valor: string): valor is CategoriaBeneficio {
  return (BENEFIT_CATEGORIES as readonly string[]).includes(valor);
}

export type Concessao = {
  inicio: Date;
  /** Nulo = vigente. */
  fim: Date | null;
};

/** Só o dia importa: conceder às 14h e encerrar às 9h é o mesmo dia. */
function dia(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function estaVigente(c: Concessao, hoje: Date = new Date()): boolean {
  const h = dia(hoje);
  if (h < dia(c.inicio)) return false;
  return c.fim === null || h <= dia(c.fim);
}

/**
 * Duas concessões do mesmo benefício se sobrepõem?
 *
 * Aberto à direita quando `fim` é nulo: uma concessão vigente conflita com
 * qualquer outra que comece a partir dela.
 */
export function haSobreposicao(a: Concessao, b: Concessao): boolean {
  const aIni = dia(a.inicio);
  const bIni = dia(b.inicio);
  const aFim = a.fim === null ? Infinity : dia(a.fim);
  const bFim = b.fim === null ? Infinity : dia(b.fim);
  return aIni <= bFim && bIni <= aFim;
}

export type MotivoRecusaBeneficio =
  | "periodo_invertido"
  | "sobreposicao"
  | "valor_negativo";

export type ResultadoConcessao = {
  valido: boolean;
  motivo?: MotivoRecusaBeneficio;
  detalhe?: string;
};

/**
 * Valida uma concessão contra as que já existem do MESMO benefício.
 *
 * Benefícios diferentes convivem livremente — ter vale-refeição e plano de
 * saúde ao mesmo tempo é o esperado. O conflito só existe dentro do mesmo.
 */
export function validarConcessao(params: {
  inicio: Date;
  fim?: Date | null;
  valor?: number | null;
  existentes?: Concessao[];
}): ResultadoConcessao {
  const { inicio, fim = null, valor = null, existentes = [] } = params;

  if (fim !== null && dia(fim) < dia(inicio)) {
    return {
      valido: false,
      motivo: "periodo_invertido",
      detalhe: "A data de encerramento é anterior à de início.",
    };
  }

  if (valor !== null && valor < 0) {
    return { valido: false, motivo: "valor_negativo", detalhe: "O valor não pode ser negativo." };
  }

  const nova: Concessao = { inicio, fim };
  const conflito = existentes.find(e => haSobreposicao(nova, e));
  if (conflito) {
    return {
      valido: false,
      motivo: "sobreposicao",
      detalhe:
        `Já existe concessão deste benefício a partir de ` +
        `${dataBR(conflito.inicio)}` +
        `${conflito.fim ? ` até ${dataBR(conflito.fim)}` : " (vigente)"}. ` +
        `Encerre a anterior antes de conceder de novo.`,
    };
  }

  return { valido: true };
}

/** Custo mensal das concessões vigentes — entra no relatório de benefícios. */
export function custoVigente(
  concessoes: (Concessao & { valor?: number | null })[],
  hoje: Date = new Date(),
): number {
  return concessoes
    .filter(c => estaVigente(c, hoje))
    .reduce((total, c) => total + (c.valor ?? 0), 0);
}
