/**
 * Regras de negócio da obrigação.
 *
 * Camada de domínio: funções puras, sem Prisma, HTTP ou sistema de arquivos.
 *
 * Aqui vive o que a planilha do cliente (sgi.xlsx) fazia com duas fórmulas e
 * três colunas de texto digitadas à mão — e o motivo de o módulo existir:
 *
 *   G = E − F − 60   (prazo interno)
 *   H = E − F        (prazo fatal)
 *
 * onde E é a validade e F a antecedência que o órgão exige. A coluna "Status"
 * era digitada, e por isso estava errada em três linhas no dia em que a
 * planilha foi analisada. Aqui a situação é SEMPRE derivada das datas.
 */

import { diasDeCalendario, diaLocal } from "../../../common/datas";

/* ── Vocabulário ──────────────────────────────────────────────────────────── */

export const CRITICIDADE = {
  BAIXA: "baixa",
  MEDIA: "media",
  ALTA: "alta",
  CRITICA: "critica",
} as const;

export type Criticidade = (typeof CRITICIDADE)[keyof typeof CRITICIDADE];
export const CRITICIDADE_VALUES = Object.values(CRITICIDADE) as Criticidade[];

/**
 * Estado DECLARADO da obrigação — o que uma pessoa decidiu sobre ela.
 *
 * Não confundir com a situação de prazo, que é calculada. "vencida" existe aqui
 * porque a especificação a lista, mas quem a escreve é a varredura noturna, a
 * partir da data; nenhuma tela deixa o usuário digitá-la.
 */
export const STATUS_OBRIGACAO = {
  ATIVA: "ativa",
  EM_RENOVACAO: "em_renovacao",
  SUSPENSA: "suspensa",
  VENCIDA: "vencida",
  CANCELADA: "cancelada",
  ARQUIVADA: "arquivada",
} as const;

export type StatusObrigacao = (typeof STATUS_OBRIGACAO)[keyof typeof STATUS_OBRIGACAO];
export const STATUS_OBRIGACAO_VALUES = Object.values(STATUS_OBRIGACAO) as StatusObrigacao[];

/**
 * Status que tiram a obrigação do radar de prazos.
 *
 * Uma licença cancelada não deve gerar alerta de vencimento nem contar como
 * vencida no painel — foi decisão da empresa não renovar, não um esquecimento.
 */
const STATUS_INATIVOS: readonly string[] = [
  STATUS_OBRIGACAO.CANCELADA,
  STATUS_OBRIGACAO.ARQUIVADA,
];

export function contaNoRadar(status: string): boolean {
  return !STATUS_INATIVOS.includes(status);
}

/* ── Situação de prazo (derivada) ─────────────────────────────────────────── */

/**
 * A escada de urgência, do tranquilo ao crítico.
 *
 * `renovacao_devida` é o estado que a planilha não tinha e que custou caro: o
 * prazo interno passou e ninguém foi avisado, porque a coluna "Observação"
 * continuava dizendo "Válida". Três itens estavam nessa situação.
 *
 * `prorrogada` é o inverso — vencida no papel, regular na prática. Ver
 * `protocoloTempestivo`.
 */
export type SituacaoPrazo =
  | "sem_validade"
  | "vigente"
  | "renovacao_devida"
  | "prazo_fatal_vencido"
  | "vencida"
  | "prorrogada";

/** Ordem de gravidade, para ordenar lista e escolher a cor do selo. */
const GRAVIDADE: Readonly<Record<SituacaoPrazo, number>> = Object.freeze({
  sem_validade: 0,
  prorrogada: 1,
  vigente: 2,
  renovacao_devida: 3,
  prazo_fatal_vencido: 4,
  vencida: 5,
});

export function gravidade(situacao: SituacaoPrazo): number {
  return GRAVIDADE[situacao] ?? 0;
}

/* ── Cálculo dos prazos ───────────────────────────────────────────────────── */

/** Folga interna padrão quando nem a obrigação nem a categoria definem uma. */
export const FOLGA_INTERNA_PADRAO_DIAS = 60;

export type EntradaPrazos = {
  dataValidade?: Date | string | null;
  /** Antecedência exigida pelo órgão para protocolar a renovação. */
  prazoMinimoDias?: number | null;
  /** Folga da obrigação; caindo para a da categoria; caindo para 60. */
  folgaInternaDias?: number | null;
  folgaCategoriaDias?: number | null;
  /** Overrides digitados. Preenchidos, vencem a conta. */
  prazoFatalManual?: Date | string | null;
  prazoInternoManual?: Date | string | null;
};

export type Prazos = {
  prazoFatalEm: Date | null;
  prazoInternoEm: Date | null;
  /** Verdadeiro quando ao menos um dos dois veio digitado, não calculado. */
  manual: boolean;
  folgaAplicadaDias: number;
};

function subtrairDias(base: Date, dias: number): Date {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() - dias);
  return d;
}

/**
 * Deriva prazo fatal e prazo interno.
 *
 * Prazo fatal = validade − antecedência exigida pelo órgão. É o último dia em
 * que ainda dá para protocolar dentro da janela legal — NÃO é a validade, e
 * confundir os dois é o erro que faz alguém perder a licença achando que tinha
 * quatro meses.
 *
 * Prazo interno = prazo fatal − folga. É quando a empresa quer começar a se
 * mexer, e é sobre ele que os alertas são calibrados por padrão.
 */
export function calcularPrazos(entrada: EntradaPrazos): Prazos {
  const folga = primeiroNumero(
    entrada.folgaInternaDias,
    entrada.folgaCategoriaDias,
    FOLGA_INTERNA_PADRAO_DIAS,
  );

  const fatalManual = paraData(entrada.prazoFatalManual);
  const internoManual = paraData(entrada.prazoInternoManual);

  const validade = paraData(entrada.dataValidade);
  const minimo = Math.max(0, Number(entrada.prazoMinimoDias ?? 0) || 0);

  const fatalCalculado = validade ? subtrairDias(validade, minimo) : null;
  const fatal = fatalManual ?? fatalCalculado;

  // O interno pende do fatal EFETIVO: se alguém digitou o fatal, a folga passa
  // a contar dali. Calcular o interno a partir do fatal teórico deixaria os
  // dois inconsistentes justamente quando houve intervenção humana.
  const internoCalculado = fatal ? subtrairDias(fatal, folga) : null;
  const interno = internoManual ?? internoCalculado;

  return {
    prazoFatalEm: fatal,
    prazoInternoEm: interno,
    manual: !!(fatalManual || internoManual),
    folgaAplicadaDias: folga,
  };
}

/* ── Protocolo e prorrogação ──────────────────────────────────────────────── */

export type EntradaProtocolo = {
  renovacaoAutomatica?: boolean | null;
  protocoloEm?: Date | string | null;
  prazoFatalEm?: Date | string | null;
  dataValidade?: Date | string | null;
};

/**
 * O protocolo foi feito a tempo?
 *
 * Só o protocolo TEMPESTIVO prorroga. Protocolar depois do prazo fatal é
 * exatamente o caso da ABIO 960/2018 na planilha, anotada à mão como
 * "Sem Renovação Automática (Fora do Prazo)" — o órgão não é obrigado a aceitar,
 * e tratar como prorrogada esconderia o problema em vez de mostrá-lo.
 *
 * Sem prazo fatal, a referência é a própria validade.
 */
export function protocoloTempestivo(entrada: EntradaProtocolo): boolean {
  const protocolo = paraData(entrada.protocoloEm);
  if (!protocolo) return false;

  const limite = paraData(entrada.prazoFatalEm) ?? paraData(entrada.dataValidade);
  if (!limite) return true;

  return diasDeCalendario(protocolo, limite) >= 0;
}

/**
 * A obrigação está prorrogada por protocolo?
 *
 * Exige as três coisas juntas: a regra permite (renovação automática), houve
 * protocolo, e ele foi tempestivo. Faltando qualquer uma, a validade vale.
 */
export function estaProrrogada(entrada: EntradaProtocolo): boolean {
  return !!entrada.renovacaoAutomatica && protocoloTempestivo(entrada);
}

/* ── Situação ─────────────────────────────────────────────────────────────── */

export type EntradaSituacao = EntradaProtocolo & {
  prazoInternoEm?: Date | string | null;
  status?: string | null;
};

/**
 * Classifica a obrigação pelo que as datas dizem — nunca pelo que alguém
 * digitou na coluna de status.
 *
 * A comparação é por dia de calendário: uma licença que vence hoje é válida
 * até o fim do dia, não a partir do meio-dia.
 */
export function situacaoPrazo(
  entrada: EntradaSituacao,
  hoje: Date = new Date(),
): SituacaoPrazo {
  const validade = paraData(entrada.dataValidade);
  if (!validade) return "sem_validade";

  const diasValidade = diasDeCalendario(hoje, validade);

  if (diasValidade < 0) {
    // Vencida no papel. Só o protocolo tempestivo a mantém regular.
    return estaProrrogada(entrada) ? "prorrogada" : "vencida";
  }

  const fatal = paraData(entrada.prazoFatalEm);
  if (fatal && diasDeCalendario(hoje, fatal) < 0) {
    // Já protocolou dentro do prazo? Então não há o que cobrar.
    if (estaProrrogada(entrada)) return "prorrogada";
    return "prazo_fatal_vencido";
  }

  const interno = paraData(entrada.prazoInternoEm);
  if (interno && diasDeCalendario(hoje, interno) < 0) {
    if (estaProrrogada(entrada)) return "prorrogada";
    return "renovacao_devida";
  }

  return "vigente";
}

export type Distancias = {
  diasParaValidade: number | null;
  diasParaPrazoFatal: number | null;
  diasParaPrazoInterno: number | null;
};

/** Dias restantes até cada marco. Negativo quando o marco já passou. */
export function distancias(
  entrada: EntradaSituacao,
  hoje: Date = new Date(),
): Distancias {
  const conta = (valor: Date | string | null | undefined) => {
    const d = paraData(valor);
    return d ? diasDeCalendario(hoje, d) : null;
  };
  return {
    diasParaValidade: conta(entrada.dataValidade),
    diasParaPrazoFatal: conta(entrada.prazoFatalEm),
    diasParaPrazoInterno: conta(entrada.prazoInternoEm),
  };
}

/* ── Renovação ────────────────────────────────────────────────────────────── */

/**
 * Próxima validade sugerida a partir da nova emissão.
 *
 * Somar meses e não dias: "3 anos" é 3 anos de calendário, e 1095 dias erra em
 * ano bissexto. Quando o dia não existe no mês de destino (31 de janeiro + 1
 * mês), o JavaScript transborda para o mês seguinte — recuamos para o último
 * dia do mês pretendido, que é o que um prazo administrativo significa.
 */
export function proximaValidade(
  dataEmissao: Date | string,
  validadeMeses: number | null | undefined,
): Date | null {
  const emissao = paraData(dataEmissao);
  if (!emissao || !validadeMeses || validadeMeses <= 0) return null;

  const diaOriginal = emissao.getDate();
  const destino = new Date(emissao.getTime());
  destino.setMonth(destino.getMonth() + validadeMeses);

  if (destino.getDate() !== diaOriginal) destino.setDate(0);
  return destino;
}

/** Meses a partir dos "anos" da planilha, para a carga inicial. */
export function mesesDeAnos(anos: number | null | undefined): number | null {
  if (!anos || anos <= 0) return null;
  return Math.round(anos * 12);
}

/** Código legível e sequencial por organização. */
export function formatarCodigo(sequencial: number): string {
  return `OBR-${String(sequencial).padStart(4, "0")}`;
}

/* ── Coerções internas ────────────────────────────────────────────────────── */

function paraData(valor: Date | string | null | undefined): Date | null {
  if (!valor) return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : diaLocal(d);
}

function primeiroNumero(...valores: (number | null | undefined)[]): number {
  for (const v of valores) {
    if (v != null && Number.isFinite(v) && v >= 0) return v;
  }
  return FOLGA_INTERNA_PADRAO_DIAS;
}
