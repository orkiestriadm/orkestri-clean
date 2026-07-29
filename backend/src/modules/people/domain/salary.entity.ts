/**
 * Remuneração — regras puras.
 *
 * Registro salarial, não folha de pagamento: aqui não se calcula imposto,
 * proporcional nem encargo. A pergunta que estas regras respondem é "quanto,
 * desde quando e por quê mudou" — a base de mérito, promoção e custo de time.
 */

export const MOTIVOS_SALARIO = [
  "admissao", "merito", "promocao", "dissidio", "enquadramento", "reducao", "outro",
] as const;

export type MotivoSalario = (typeof MOTIVOS_SALARIO)[number];

export function motivoValido(valor: string): valor is MotivoSalario {
  return (MOTIVOS_SALARIO as readonly string[]).includes(valor);
}

export type RegistroSalarial = {
  valor: number;
  vigenciaInicio: Date;
  motivo: MotivoSalario | string;
};

/** Só o dia importa: uma vigência não é hora do dia. */
function dia(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Salário vigente: o mais recente cuja vigência já começou.
 *
 * Registro com vigência futura existe de propósito — aumento combinado e
 * lançado antes de valer. Ele não pode ser tratado como atual, senão o custo
 * do time sobe antes da data.
 */
export function salarioVigente(
  historico: RegistroSalarial[],
  hoje: Date = new Date(),
): RegistroSalarial | null {
  const h = dia(hoje);
  return historico
    .filter(r => dia(r.vigenciaInicio) <= h)
    .sort((a, b) => dia(b.vigenciaInicio) - dia(a.vigenciaInicio))[0] ?? null;
}

/**
 * Variação percentual entre dois valores.
 *
 * Devolve null quando não há base de comparação. Zero seria mentira: "0% de
 * aumento" e "primeiro salário" são coisas diferentes, e a tela precisa
 * distinguir para não mostrar admissão como reajuste nulo.
 */
export function variacaoPercentual(anterior: number | null, atual: number): number | null {
  if (anterior === null || anterior <= 0) return null;
  return Math.round(((atual - anterior) / anterior) * 1000) / 10;
}

/** Histórico ordenado do mais recente ao mais antigo, com a variação de cada. */
export function historicoComVariacao<T extends RegistroSalarial>(
  historico: T[],
): (T & { variacaoPercentual: number | null })[] {
  const ordenado = [...historico].sort(
    (a, b) => dia(b.vigenciaInicio) - dia(a.vigenciaInicio),
  );
  return ordenado.map((r, i) => {
    // O próximo do array é o anterior no tempo, porque a ordem é decrescente.
    const anterior = ordenado[i + 1];
    return { ...r, variacaoPercentual: variacaoPercentual(anterior?.valor ?? null, r.valor) };
  });
}

/* ── Faixa salarial ───────────────────────────────────────────────────────── */

export type Faixa = { minimo: number | null; medio: number | null; maximo: number | null };

export type PosicaoNaFaixa = "sem_faixa" | "abaixo" | "dentro" | "acima";

/**
 * Onde o salário cai na faixa do cargo.
 *
 * Serve a duas conversas opostas e igualmente concretas: quem está `abaixo`
 * tem risco de perder para o mercado; quem está `acima` já não tem espaço de
 * crescer sem mudar de cargo, e insistir em mérito ali só adia o problema.
 */
export function posicaoNaFaixa(valor: number, faixa: Faixa): PosicaoNaFaixa {
  const { minimo, maximo } = faixa;
  if (minimo === null && maximo === null) return "sem_faixa";
  if (minimo !== null && valor < minimo) return "abaixo";
  if (maximo !== null && valor > maximo) return "acima";
  return "dentro";
}

/**
 * Posição relativa dentro da faixa, de 0 a 100 (compa-ratio simplificado).
 *
 * Null sem faixa completa. Uma faixa sem mínimo OU sem máximo não define
 * posição — inventar uma daria a impressão de precisão onde não há dado.
 */
export function percentualNaFaixa(valor: number, faixa: Faixa): number | null {
  const { minimo, maximo } = faixa;
  if (minimo === null || maximo === null || maximo <= minimo) return null;
  const bruto = ((valor - minimo) / (maximo - minimo)) * 100;
  return Math.round(Math.min(100, Math.max(0, bruto)));
}

/** Faixa coerente? Mínimo acima do máximo é erro de digitação, não regra. */
export function faixaValida(faixa: Faixa): boolean {
  const { minimo, medio, maximo } = faixa;
  if (minimo !== null && maximo !== null && minimo > maximo) return false;
  if (medio !== null && minimo !== null && medio < minimo) return false;
  if (medio !== null && maximo !== null && medio > maximo) return false;
  return true;
}

/* ── Validação da mudança ─────────────────────────────────────────────────── */

export type MotivoRecusaSalario =
  | "valor_invalido"
  | "motivo_desconhecido"
  | "vigencia_duplicada"
  | "reducao_sem_motivo";

export type ResultadoSalario = {
  valido: boolean;
  motivo?: MotivoRecusaSalario;
  detalhe?: string;
};

export function validarMudanca(params: {
  valor: number;
  vigenciaInicio: Date;
  motivo: string;
  historico?: RegistroSalarial[];
}): ResultadoSalario {
  const { valor, vigenciaInicio, motivo, historico = [] } = params;

  if (!Number.isFinite(valor) || valor <= 0) {
    return { valido: false, motivo: "valor_invalido", detalhe: "O salário deve ser maior que zero." };
  }

  if (!motivoValido(motivo)) {
    return {
      valido: false,
      motivo: "motivo_desconhecido",
      detalhe: `Motivo "${motivo}" não é reconhecido.`,
    };
  }

  if (historico.some(r => dia(r.vigenciaInicio) === dia(vigenciaInicio))) {
    return {
      valido: false,
      motivo: "vigencia_duplicada",
      detalhe: "Já existe um registro salarial com esta data de vigência.",
    };
  }

  // Redução de salário tem restrição legal (CLT art. 468) e precisa de rastro.
  // Não é papel do sistema julgar o caso, mas é papel exigir que fique
  // registrado por que aconteceu.
  const anterior = salarioVigente(historico, vigenciaInicio);
  if (anterior && valor < anterior.valor && motivo !== "reducao") {
    return {
      valido: false,
      motivo: "reducao_sem_motivo",
      detalhe:
        `O valor é menor que o salário vigente (${anterior.valor.toLocaleString("pt-BR", {
          style: "currency", currency: "BRL",
        })}). ` + `Redução exige o motivo "reducao" para ficar registrada.`,
    };
  }

  return { valido: true };
}

/* ── Indicadores ──────────────────────────────────────────────────────────── */

/** Meses desde a última mudança — base do alerta de mérito represado. */
export function mesesDesde(data: Date, hoje: Date = new Date()): number {
  const anos = hoje.getFullYear() - data.getFullYear();
  const meses = hoje.getMonth() - data.getMonth();
  const ajuste = hoje.getDate() < data.getDate() ? -1 : 0;
  return Math.max(0, anos * 12 + meses + ajuste);
}

/** Acima disto, o RH deveria olhar: mérito parado vira pedido de demissão. */
export const MESES_ALERTA_SEM_REAJUSTE = 18;
