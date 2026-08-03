/**
 * Regras de férias.
 *
 * Camada de domínio: funções puras, sem Prisma nem framework. Toda data entra
 * e sai como `Date`, e a comparação é sempre por DIA — férias são contadas em
 * dias inteiros, e comparar por instante faria "vence hoje" virar "venceu".
 *
 * Modelo CLT, que é o que a operação brasileira exige:
 *
 *   admissão → 12 meses → PERÍODO AQUISITIVO completo (direito a 30 dias)
 *            → +12 meses → fim do PERÍODO CONCESSIVO (prazo para gozar)
 *
 * Passar do período concessivo sem gozar gera pagamento em dobro — por isso o
 * sistema precisa avisar antes, não depois.
 */

import { diaLocal } from "../../../common/datas";

/** Dias de direito por período aquisitivo completo, sem faltas. */
export const DIAS_POR_PERIODO = 30;

/** Antecedência com que o vencimento vira alerta. */
export const DIAS_ALERTA_VENCIMENTO_FERIAS = 60;

export const VACATION_PERIOD_STATUS = {
  /** Ainda acumulando: o colaborador não completou 12 meses neste ciclo. */
  EM_AQUISICAO: "EM_AQUISICAO",
  /** Direito adquirido e dentro do prazo para gozar. */
  ADQUIRIDO: "ADQUIRIDO",
  /** Todos os dias foram gozados. */
  GOZADO: "GOZADO",
  /** Passou do período concessivo com saldo — gera passivo trabalhista. */
  VENCIDO: "VENCIDO",
} as const;

export type VacationPeriodStatus =
  (typeof VACATION_PERIOD_STATUS)[keyof typeof VACATION_PERIOD_STATUS];

export type PeriodoAquisitivo = {
  inicio: Date;
  /** Último dia do período aquisitivo (12 meses após o início, menos 1 dia). */
  fim: Date;
  /** Prazo final para gozar (12 meses após o fim do aquisitivo). */
  limiteConcessivo: Date;
  diasDireito: number;
  diasGozados: number;
};

// ── Utilitários de data ──────────────────────────────────────────────────────

// Meia-noite LOCAL do mesmo dia do calendário. O `setHours(0,0,0,0)` que
// estava aqui recuava um dia toda data vinda de coluna DATE — limite
// concessivo e período aquisitivo saíam um dia adiantados. Ver common/datas.ts.
const inicioDoDia = diaLocal;

const somarMeses = (d: Date, meses: number): Date => {
  const x = new Date(d);
  const diaOriginal = x.getDate();
  x.setMonth(x.getMonth() + meses);
  // 31/jan + 1 mês viraria 03/mar em fevereiro; recua para o último dia do mês.
  if (x.getDate() !== diaOriginal) x.setDate(0);
  return x;
};

const somarDias = (d: Date, dias: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + dias);
  return x;
};

export const diffEmDias = (de: Date, ate: Date): number =>
  Math.round((inicioDoDia(ate).getTime() - inicioDoDia(de).getTime()) / 86_400_000);

// ── Períodos ─────────────────────────────────────────────────────────────────

/**
 * Gera os períodos aquisitivos desde a admissão até hoje.
 *
 * Inclui o período em curso: o colaborador precisa enxergar o que está
 * acumulando, não só o que já pode gozar.
 */
export function periodosAquisitivos(
  dataAdmissao: Date,
  hoje: Date = new Date(),
  diasPorPeriodo: number = DIAS_POR_PERIODO,
): PeriodoAquisitivo[] {
  const admissao = inicioDoDia(dataAdmissao);
  const referencia = inicioDoDia(hoje);
  if (admissao > referencia) return [];

  const periodos: PeriodoAquisitivo[] = [];
  let inicio = admissao;

  // Trava de segurança: data de admissão absurda não pode gerar laço infinito.
  for (let i = 0; i < 60; i++) {
    const proximoInicio = somarMeses(inicio, 12);
    periodos.push({
      inicio,
      fim: somarDias(proximoInicio, -1),
      limiteConcessivo: somarDias(somarMeses(proximoInicio, 12), -1),
      diasDireito: diasPorPeriodo,
      diasGozados: 0,
    });
    if (proximoInicio > referencia) break;
    inicio = proximoInicio;
  }

  return periodos;
}

export function statusDoPeriodo(
  periodo: PeriodoAquisitivo,
  hoje: Date = new Date(),
): VacationPeriodStatus {
  const referencia = inicioDoDia(hoje);
  if (referencia <= inicioDoDia(periodo.fim)) return VACATION_PERIOD_STATUS.EM_AQUISICAO;
  if (periodo.diasGozados >= periodo.diasDireito) return VACATION_PERIOD_STATUS.GOZADO;
  if (referencia > inicioDoDia(periodo.limiteConcessivo)) return VACATION_PERIOD_STATUS.VENCIDO;
  return VACATION_PERIOD_STATUS.ADQUIRIDO;
}

export function saldoDoPeriodo(periodo: PeriodoAquisitivo): number {
  return Math.max(0, periodo.diasDireito - periodo.diasGozados);
}

/** Saldo utilizável: só conta período já adquirido e ainda no prazo. */
export function saldoDisponivel(
  periodos: PeriodoAquisitivo[],
  hoje: Date = new Date(),
): number {
  return periodos
    .filter(p => statusDoPeriodo(p, hoje) === VACATION_PERIOD_STATUS.ADQUIRIDO)
    .reduce((total, p) => total + saldoDoPeriodo(p), 0);
}

/**
 * Períodos que vencem dentro da janela de alerta.
 *
 * É o indicador que evita passivo: depois do limite concessivo, o saldo não
 * some — vira obrigação de pagar em dobro.
 */
export function periodosVencendo(
  periodos: PeriodoAquisitivo[],
  hoje: Date = new Date(),
  janelaDias: number = DIAS_ALERTA_VENCIMENTO_FERIAS,
): PeriodoAquisitivo[] {
  return periodos.filter(p => {
    if (statusDoPeriodo(p, hoje) !== VACATION_PERIOD_STATUS.ADQUIRIDO) return false;
    const restam = diffEmDias(hoje, p.limiteConcessivo);
    return restam >= 0 && restam <= janelaDias;
  });
}

// ── Validação de solicitação ─────────────────────────────────────────────────

export type MotivoRecusa =
  | "sem_saldo"
  | "periodo_invertido"
  | "fracionamento_minimo"
  | "sobreposicao";

/**
 * Campos opcionais em vez de união discriminada: o projeto roda com
 * `strictNullChecks: false`, e nessa configuração o TypeScript não estreita
 * uniões por discriminante — `if (!r.valido)` inferia o ramo errado.
 */
export type ResultadoValidacao = {
  valido: boolean;
  /** Preenchido quando válido. */
  dias?: number;
  /** Preenchidos quando inválido. */
  motivo?: MotivoRecusa;
  detalhe?: string;
};

/** Fracionamento: nenhum período de férias pode ser menor que 5 dias corridos. */
export const MINIMO_DIAS_FRACIONAMENTO = 5;

export type IntervaloOcupado = { dataInicio: Date | string; dataFim: Date | string };

/**
 * Valida a janela pedida — datas, fracionamento e conflito de agenda.
 *
 * Separada da checagem de saldo de propósito: saldo depende de QUAL período
 * aquisitivo vai ser debitado, e essa escolha é do serviço, que conhece os
 * períodos. Misturar as duas fazia um pedido sobreposto ser recusado por
 * "sem saldo" — mensagem errada para o usuário corrigir.
 *
 * Conta dias CORRIDOS, não úteis: férias remuneram o período inteiro, incluindo
 * fim de semana. Isso difere de `absenceDaysByCollaborator`, que conta dias
 * úteis porque ali o objetivo é descontar capacidade de trabalho.
 */
export function validarJanela(params: {
  inicio: Date;
  fim: Date;
  ocupados?: IntervaloOcupado[];
  minimoFracionamento?: number;
}): ResultadoValidacao {
  const inicio = inicioDoDia(params.inicio);
  const fim = inicioDoDia(params.fim);

  if (fim < inicio) {
    return { valido: false, motivo: "periodo_invertido", detalhe: "A data final é anterior à inicial." };
  }

  const dias = diffEmDias(inicio, fim) + 1; // inclusivo nas duas pontas
  const minimo = params.minimoFracionamento ?? MINIMO_DIAS_FRACIONAMENTO;

  if (dias < minimo) {
    return {
      valido: false,
      motivo: "fracionamento_minimo",
      detalhe: `Cada período de férias precisa ter no mínimo ${minimo} dias corridos.`,
    };
  }

  const conflito = (params.ocupados ?? []).find(o => {
    const oi = inicioDoDia(new Date(o.dataInicio));
    const of = inicioDoDia(new Date(o.dataFim));
    return oi <= fim && of >= inicio; // interseção de intervalos
  });

  if (conflito) {
    return {
      valido: false,
      motivo: "sobreposicao",
      detalhe: "Já existe uma ausência registrada que se sobrepõe a este período.",
    };
  }

  return { valido: true, dias };
}

/**
 * Escolhe de qual período aquisitivo os dias serão debitados.
 *
 * Regra: o mais antigo que comporte a solicitação INTEIRA. Debitar do mais
 * antigo é o que evita o vencimento; exigir que comporte tudo é o que impede
 * um pedido de 11 dias ser recusado porque o período mais antigo tem 5, mesmo
 * havendo 60 no total.
 *
 * Não fatiamos entre períodos: dividir um pedido em dois debitos produz duas
 * "férias" no histórico onde o colaborador pediu uma, e ninguém entende o
 * extrato depois.
 */
export function escolherPeriodoParaDebito(
  periodos: PeriodoAquisitivo[],
  dias: number,
  hoje: Date = new Date(),
): PeriodoAquisitivo | null {
  return periodos
    .filter(p => statusDoPeriodo(p, hoje) === VACATION_PERIOD_STATUS.ADQUIRIDO)
    .filter(p => saldoDoPeriodo(p) >= dias)
    .sort((a, b) => +a.inicio - +b.inicio)[0] ?? null;
}

/* ── Férias devidas no desligamento ────────────────────────────────────────── */

export type FeriasDevidas = {
  /** Períodos que passaram do prazo concessivo — pagos em DOBRO (CLT art. 137). */
  vencidosDias: number;
  /** Períodos adquiridos e ainda no prazo, não gozados. */
  adquiridosDias: number;
  /**
   * Proporcionais do período aquisitivo em curso: 1/12 por mês trabalhado,
   * contando o mês só a partir de 15 dias (CLT art. 146, parágrafo único).
   */
  proporcionaisDias: number;
  /** Meses que entraram no cálculo proporcional — para a conta ser conferível. */
  mesesProporcionais: number;
  /** Soma simples dos dias. NÃO aplica a dobra: dias são dias. */
  totalDias: number;
};

/**
 * Dias de férias devidos a quem está saindo.
 *
 * DELIBERADAMENTE EM DIAS, NUNCA EM REAIS. Folha de pagamento está fora do
 * escopo do módulo (PEOPLE_HUB_BLUEPRINT.md §4), e converter para dinheiro
 * exigiria salário, médias, adicionais e o terço constitucional — cálculo de
 * rescisão, que é outro produto. O que o RH precisa daqui é o insumo: quantos
 * dias, de que natureza, para lançar no sistema de folha.
 *
 * `vencidosDias` vem separado por isso mesmo: é o número que dobra na rescisão,
 * e somá-lo ao resto esconderia justamente o que custa caro.
 */
export function feriasDevidas(
  periodos: PeriodoAquisitivo[],
  dataAdmissao: Date,
  dataDesligamento: Date,
  diasPorPeriodo: number = DIAS_POR_PERIODO,
): FeriasDevidas {
  const saida = inicioDoDia(dataDesligamento);

  let vencidosDias = 0;
  let adquiridosDias = 0;

  for (const p of periodos) {
    const saldo = saldoDoPeriodo(p);
    if (saldo <= 0) continue;

    // O status é calculado NA DATA DA SAÍDA, não hoje: quem foi desligado em
    // janeiro não acumula vencimento por causa do calendário de hoje.
    const status = statusDoPeriodo(p, saida);
    if (status === VACATION_PERIOD_STATUS.VENCIDO) vencidosDias += saldo;
    else if (status === VACATION_PERIOD_STATUS.ADQUIRIDO) adquiridosDias += saldo;
  }

  // ── Proporcionais ───────────────────────────────────────────────────────
  // Conta a partir do início do aquisitivo em curso, que é o último aniversário
  // de admissão antes da saída.
  const admissao = inicioDoDia(dataAdmissao);
  let inicioCiclo = admissao;
  while (true) {
    const proximo = new Date(inicioCiclo);
    proximo.setFullYear(proximo.getFullYear() + 1);
    if (proximo > saida) break;
    inicioCiclo = proximo;
    // Trava: admissão absurda não pode virar laço infinito.
    if (inicioCiclo.getFullYear() > saida.getFullYear() + 1) break;
  }

  let mesesProporcionais = 0;
  if (saida > inicioCiclo) {
    let marco = new Date(inicioCiclo);
    while (true) {
      const fimDoMes = new Date(marco);
      fimDoMes.setMonth(fimDoMes.getMonth() + 1);
      if (fimDoMes <= saida) {
        mesesProporcionais += 1;
        marco = fimDoMes;
        continue;
      }
      // Fração final: só conta se passou de 14 dias.
      const dias = Math.floor((+saida - +marco) / 86_400_000);
      if (dias >= 15) mesesProporcionais += 1;
      break;
    }
  }
  mesesProporcionais = Math.min(mesesProporcionais, 12);

  const proporcionaisDias = Math.round((diasPorPeriodo / 12) * mesesProporcionais * 100) / 100;

  return {
    vencidosDias,
    adquiridosDias,
    proporcionaisDias,
    mesesProporcionais,
    totalDias: Math.round((vencidosDias + adquiridosDias + proporcionaisDias) * 100) / 100,
  };
}
