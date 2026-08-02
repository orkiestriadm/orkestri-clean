/**
 * Plano de carreira — regras puras.
 *
 * A trilha é uma sequência ORDENADA DE CARGOS do catálogo. Não existe "nível
 * dentro do cargo": o catálogo já carrega o nível e a faixa salarial está
 * amarrada ao cargo, então um segundo eixo criaria duas respostas para "que
 * nível essa pessoa é?".
 *
 * O que importa aqui é a PRONTIDÃO. Uma trilha desenhada é um diagrama; a
 * pergunta que muda uma conversa de carreira é "o que falta para o próximo
 * degrau, exatamente?". Essa conta é o núcleo deste arquivo, e é pura de
 * propósito: promoção mal calculada custa caro e precisa ser testável sem banco.
 */

/* ── Níveis de competência ────────────────────────────────────────────────── */

/**
 * Escala ordenada. A ORDEM é a regra: "exige pleno" quer dizer "pleno ou mais",
 * então comparar exige saber que sênior está acima de pleno. Guardar isso como
 * texto solto em cada consumidor era o caminho para dois lugares discordarem.
 */
export const NIVEIS_COMPETENCIA = ["junior", "pleno", "senior", "especialista"] as const;

export type NivelCompetencia = (typeof NIVEIS_COMPETENCIA)[number];

/** Posição na escala; -1 para valor desconhecido. */
export function ordemNivel(nivel: string | null | undefined): number {
  if (!nivel) return -1;
  return (NIVEIS_COMPETENCIA as readonly string[]).indexOf(nivel);
}

/**
 * O nível alcançado satisfaz o exigido?
 *
 * Exigência desconhecida é tratada como "sem exigência de nível" — ter a
 * competência basta. O contrário (recusar por não entender o próprio critério)
 * bloquearia a progressão de alguém por um erro de cadastro.
 */
export function nivelAtende(alcancado: string | null | undefined, exigido: string | null | undefined): boolean {
  const pedido = ordemNivel(exigido);
  if (pedido < 0) return !!alcancado;
  return ordemNivel(alcancado) >= pedido;
}

/* ── Trilha ───────────────────────────────────────────────────────────────── */

export type Degrau = {
  id: string;
  ordem: number;
  positionId: string;
  mesesMinimos?: number | null;
  notaMinima?: number | null;
};

/**
 * Ordena e reindexa os degraus em 1..N.
 *
 * A ordem gravada vira esburacada com o uso normal — apagar o degrau 2 de uma
 * trilha de 4 deixa 1, 3, 4. Isso não quebra a leitura, mas faz a tela mostrar
 * "degrau 3 de 4" para o penúltimo, o que parece defeito. Renumerar na escrita
 * mantém a sequência íntegra sem exigir que a interface saiba disso.
 */
export function reindexar(degraus: Degrau[]): Degrau[] {
  return [...degraus]
    .sort((a, b) => a.ordem - b.ordem)
    .map((d, i) => ({ ...d, ordem: i + 1 }));
}

/** Degrau que corresponde ao cargo atual da pessoa, ou nulo se está fora da trilha. */
export function degrauAtual(degraus: Degrau[], positionId: string | null | undefined): Degrau | null {
  if (!positionId) return null;
  return degraus.find(d => d.positionId === positionId) ?? null;
}

/** O degrau seguinte na ordem. Nulo no topo da trilha — que é um estado válido. */
export function proximoDegrau(degraus: Degrau[], atual: Degrau | null): Degrau | null {
  if (!atual) return null;
  const ordenados = [...degraus].sort((a, b) => a.ordem - b.ordem);
  const i = ordenados.findIndex(d => d.id === atual.id);
  return i >= 0 ? (ordenados[i + 1] ?? null) : null;
}

/* ── Prontidão ────────────────────────────────────────────────────────────── */

export type TipoRequisito = "competencia" | "treinamento" | "manual";

export type Requisito = {
  id: string;
  tipo: TipoRequisito | string;
  obrigatorio: boolean;
  skillId?: string | null;
  nivelMinimo?: string | null;
  trainingId?: string | null;
  descricao?: string | null;
  /** Rótulos para a tela; não participam da regra. */
  skillNome?: string | null;
  trainingNome?: string | null;
};

export type SituacaoRequisito =
  | "atendido"
  | "pendente"
  /** Texto livre: ninguém pode dizer por dado se foi cumprido. */
  | "conferencia_manual";

export type RequisitoAvaliado = Requisito & {
  situacao: SituacaoRequisito;
  /** Nível que a pessoa tem hoje, quando o requisito é de competência. */
  nivelAtual?: string | null;
};

export type ContextoDoColaborador = {
  /** skillId → nível. */
  competencias: Map<string, string>;
  /** trainingIds concluídos. */
  treinamentos: Set<string>;
  /** Meses no degrau atual. Nulo quando não há como saber. */
  mesesNoDegrau: number | null;
  /** Nota da última avaliação finalizada. */
  ultimaNota: number | null;
};

export type CriterioDegrau = {
  rotulo: string;
  situacao: SituacaoRequisito;
  detalhe: string;
};

export type Prontidao = {
  requisitos: RequisitoAvaliado[];
  /** Tempo mínimo e nota mínima, que vivem no degrau e não na lista. */
  criterios: CriterioDegrau[];
  /** 0–100 sobre o que é verificável e obrigatório. */
  percentual: number;
  /**
   * Verdadeiro quando nada obrigatório e verificável está pendente. NÃO
   * significa "promova": os itens de conferência manual continuam de fora, e
   * são justamente os que exigem julgamento.
   */
  pronto: boolean;
  /** Quantos itens dependem de decisão humana. */
  conferenciasManuais: number;
};

function avaliarRequisito(r: Requisito, ctx: ContextoDoColaborador): RequisitoAvaliado {
  if (r.tipo === "competencia" && r.skillId) {
    const nivelAtual = ctx.competencias.get(r.skillId) ?? null;
    return {
      ...r,
      nivelAtual,
      situacao: nivelAtende(nivelAtual, r.nivelMinimo) ? "atendido" : "pendente",
    };
  }

  if (r.tipo === "treinamento" && r.trainingId) {
    return {
      ...r,
      situacao: ctx.treinamentos.has(r.trainingId) ? "atendido" : "pendente",
    };
  }

  // Inclui `manual` e também competência/treinamento sem alvo — requisito
  // apontando para o vazio não pode ser dado como cumprido nem como pendente;
  // é cadastro incompleto, e quem decide precisa vê-lo.
  return { ...r, situacao: "conferencia_manual" };
}

/**
 * Avalia a prontidão para o próximo degrau.
 *
 * Contagem do percentual: só requisitos OBRIGATÓRIOS e VERIFICÁVEIS entram no
 * denominador. Diferencial não pode derrubar o número de quem cumpriu tudo que
 * era exigido, e conferência manual não pode ser contada como pendência
 * automática — a pessoa apareceria eternamente em 80% por causa de um item que
 * o sistema nunca vai marcar sozinho.
 */
export function avaliarProntidao(
  proximo: { mesesMinimos?: number | null; notaMinima?: number | null } | null,
  requisitos: Requisito[],
  ctx: ContextoDoColaborador,
): Prontidao {
  const avaliados = requisitos.map(r => avaliarRequisito(r, ctx));
  const criterios: CriterioDegrau[] = [];

  if (proximo?.mesesMinimos != null) {
    const meses = ctx.mesesNoDegrau;
    criterios.push({
      rotulo: "Tempo no cargo",
      // Sem data de referência não dá para afirmar que cumpriu nem que falta.
      situacao:
        meses === null ? "conferencia_manual" : meses >= proximo.mesesMinimos ? "atendido" : "pendente",
      detalhe:
        meses === null
          ? `Exige ${proximo.mesesMinimos} meses — sem data de referência no cadastro`
          : `${meses} de ${proximo.mesesMinimos} ${proximo.mesesMinimos === 1 ? "mês" : "meses"}`,
    });
  }

  if (proximo?.notaMinima != null) {
    const nota = ctx.ultimaNota;
    criterios.push({
      rotulo: "Desempenho",
      situacao: nota === null ? "pendente" : nota >= proximo.notaMinima ? "atendido" : "pendente",
      detalhe:
        nota === null
          ? `Exige nota ${proximo.notaMinima} — nenhuma avaliação finalizada`
          : `Nota ${nota} de ${proximo.notaMinima} exigida`,
    });
  }

  const contaveis = [
    ...avaliados.filter(r => r.obrigatorio && r.situacao !== "conferencia_manual"),
    ...criterios.filter(c => c.situacao !== "conferencia_manual"),
  ];
  const atendidos = contaveis.filter(c => c.situacao === "atendido").length;

  // Sem nada a verificar, a prontidão é 100 e não 0: um degrau sem requisitos
  // automáticos não é um degrau impossível — é um degrau que depende só de
  // decisão. Zero ali leria como "não cumpriu nada".
  const percentual = contaveis.length === 0 ? 100 : Math.round((atendidos / contaveis.length) * 100);

  return {
    requisitos: avaliados,
    criterios,
    percentual,
    pronto: contaveis.length === atendidos,
    conferenciasManuais:
      avaliados.filter(r => r.situacao === "conferencia_manual").length +
      criterios.filter(c => c.situacao === "conferencia_manual").length,
  };
}

/* ── Validações de escrita ────────────────────────────────────────────────── */

export type Validacao = { valido: boolean; detalhe?: string };

/**
 * Um requisito precisa apontar para algo.
 *
 * Sem isto, a tela aceitaria "competência: —" e o item nasceria como
 * conferência manual para sempre, sem que ninguém entendesse por quê.
 */
export function validarRequisito(r: {
  tipo: string;
  skillId?: string | null;
  trainingId?: string | null;
  descricao?: string | null;
}): Validacao {
  if (r.tipo === "competencia") {
    if (!r.skillId) return { valido: false, detalhe: "Escolha a competência exigida." };
    return { valido: true };
  }
  if (r.tipo === "treinamento") {
    if (!r.trainingId) return { valido: false, detalhe: "Escolha o curso exigido." };
    return { valido: true };
  }
  if (r.tipo === "manual") {
    if (!r.descricao?.trim()) {
      return { valido: false, detalhe: "Descreva o que será conferido." };
    }
    return { valido: true };
  }
  return { valido: false, detalhe: `Tipo de requisito desconhecido: ${r.tipo}` };
}

/** Nível de competência precisa existir na escala, quando informado. */
export function validarNivelMinimo(nivel: string | null | undefined): Validacao {
  if (!nivel) return { valido: true };
  if (ordemNivel(nivel) < 0) {
    return { valido: false, detalhe: `Nível inválido: ${nivel}` };
  }
  return { valido: true };
}
