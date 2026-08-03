/**
 * Autoavaliação, avaliação de pares e calibração — regras puras.
 *
 * O ciclo de desempenho era gestor → liderado, com uma nota. Faltavam as três
 * peças que fazem a avaliação servir para conversa e não só para arquivo:
 *
 *  - AUTOAVALIAÇÃO. Sem ela, a conversa começa com a pessoa descobrindo o que
 *    o gestor achou. Com ela, começa pela DIFERENÇA entre as duas leituras —
 *    que é o único lugar onde há o que discutir.
 *  - PARES. Um gestor não vê o trabalho do dia a dia de quem lidera; quem vê
 *    são as pessoas ao lado.
 *  - CALIBRAÇÃO. Nota só compara quando os avaliadores usam a mesma régua, e
 *    eles nunca usam. Sem enxergar quem pontua alto e quem pontua baixo, "4,2"
 *    de um gestor e "4,2" de outro são números diferentes com o mesmo nome.
 *
 * A DECISÃO QUE ORGANIZA TUDO: a nota do gestor NÃO vira média com as outras.
 * A responsabilidade pela avaliação é dele, e uma média com pares faria a nota
 * não ser de ninguém — sem dono, ela deixa de ser defensável numa conversa
 * sobre promoção ou desligamento. As demais entram como insumo, exibidas ao
 * lado, e é o gestor quem decide o que fazer com a divergência.
 */

export const ORIGENS_360 = ["autoavaliacao", "par", "lideranca"] as const;
export type Origem360 = (typeof ORIGENS_360)[number];

export const STATUS_ENTRADA = { CONVIDADO: "CONVIDADO", RESPONDIDA: "RESPONDIDA" } as const;
export type StatusEntrada = (typeof STATUS_ENTRADA)[keyof typeof STATUS_ENTRADA];

export const ROTULO_ORIGEM: Record<Origem360, string> = {
  autoavaliacao: "Autoavaliação",
  par: "Pares",
  lideranca: "Liderança",
};

/**
 * Mínimo de respostas de pares para exibir a média ao avaliado.
 *
 * Com uma ou duas respostas, "a média dos pares" identifica quem respondeu — e
 * a pessoa deduz de quem veio a crítica. Feedback de par só é honesto se quem
 * escreve souber que não será rastreado; um limiar baixo demais destrói a
 * própria fonte de dados.
 */
export const MINIMO_PARES_PARA_EXIBIR = 3;

export type EntradaAvaliacao = {
  avaliadorId: string;
  origem: string;
  nota: number | null;
  status: string;
};

export type MotivoRecusaConvite =
  | "origem_invalida"
  | "auto_de_outra_pessoa"
  | "par_e_o_proprio_avaliado"
  | "ja_convidado"
  | "review_finalizada";

/**
 * Pode convidar esta pessoa para esta avaliação?
 *
 * A autoavaliação é o caso especial: o avaliador TEM que ser o avaliado. É a
 * mesma checagem do par, com o sinal invertido — e escrever as duas juntas
 * evita que uma seja corrigida sem a outra.
 */
export function validarConvite(params: {
  origem: string;
  avaliadorId: string;
  avaliadoId: string;
  jaConvidados: string[];
  reviewFinalizada: boolean;
}): MotivoRecusaConvite | null {
  const { origem, avaliadorId, avaliadoId, jaConvidados, reviewFinalizada } = params;

  if (!(ORIGENS_360 as readonly string[]).includes(origem)) return "origem_invalida";
  // Depois de finalizada, a nota já foi comunicada: uma resposta nova mudaria
  // o retrato de algo que a pessoa já leu.
  if (reviewFinalizada) return "review_finalizada";

  if (origem === "autoavaliacao" && avaliadorId !== avaliadoId) return "auto_de_outra_pessoa";
  if (origem !== "autoavaliacao" && avaliadorId === avaliadoId) return "par_e_o_proprio_avaliado";
  if (jaConvidados.includes(avaliadorId)) return "ja_convidado";

  return null;
}

export const EXPLICACAO_RECUSA: Record<MotivoRecusaConvite, string> = {
  origem_invalida: "Origem inválida. Use autoavaliacao, par ou lideranca.",
  auto_de_outra_pessoa: "Autoavaliação só pode ser preenchida pelo próprio avaliado.",
  par_e_o_proprio_avaliado: "O avaliado não pode entrar como par de si mesmo — para isso existe a autoavaliação.",
  ja_convidado: "Esta pessoa já foi convidada para esta avaliação.",
  review_finalizada: "A avaliação já foi finalizada e não recebe novas respostas.",
};

export type ResumoOrigem = {
  origem: Origem360;
  convidados: number;
  respondidas: number;
  /** Nulo quando ninguém respondeu, ou quando há poucos para preservar o anonimato. */
  media: number | null;
  /** Verdadeiro quando há resposta mas a média foi omitida por anonimato. */
  omitidaPorAnonimato: boolean;
};

/**
 * Consolida as entradas por origem.
 *
 * `paraOAvaliado` muda o que sai: a média de pares só aparece com respostas
 * suficientes para que ninguém seja identificável. Para quem conduz a
 * avaliação (gestor, RH) não há omissão — eles precisam do dado para decidir,
 * e já sabem quem convidaram.
 */
export function consolidar(
  entradas: EntradaAvaliacao[],
  paraOAvaliado = false,
  minimoPares = MINIMO_PARES_PARA_EXIBIR,
): ResumoOrigem[] {
  return ORIGENS_360.map(origem => {
    const daOrigem = entradas.filter(e => e.origem === origem);
    const respondidas = daOrigem.filter(
      e => e.status === STATUS_ENTRADA.RESPONDIDA && e.nota !== null,
    );

    const anonimatoImporta = paraOAvaliado && origem !== "autoavaliacao";
    const poucas = anonimatoImporta && respondidas.length < minimoPares;

    return {
      origem,
      convidados: daOrigem.length,
      respondidas: respondidas.length,
      media: respondidas.length === 0 || poucas
        ? null
        : arredondar(respondidas.reduce((s, e) => s + (e.nota ?? 0), 0) / respondidas.length),
      omitidaPorAnonimato: poucas && respondidas.length > 0,
    };
  }).filter(r => r.convidados > 0);
}

/**
 * A diferença entre como a pessoa se vê e como o gestor a vê.
 *
 * É o número mais útil do ciclo, e o único que aponta para uma conversa
 * específica: quem se avalia bem acima recebeu pouco feedback ao longo do ano;
 * quem se avalia bem abaixo pode estar sendo subestimado — inclusive por si.
 *
 * Positivo = a pessoa se vê melhor que o gestor a vê.
 */
export function divergenciaAutoavaliacao(
  notaGestor: number | null,
  notaAuto: number | null,
): number | null {
  if (notaGestor === null || notaAuto === null) return null;
  return arredondar(notaAuto - notaGestor);
}

/* ── Calibração ───────────────────────────────────────────────────────────── */

export type NotaDoCiclo = {
  gestorId: string | null;
  gestorNome: string;
  nota: number;
};

export type LinhaCalibracao = {
  gestorId: string | null;
  gestorNome: string;
  avaliados: number;
  media: number;
  /** Distância da média geral. Positivo = pontua acima dos demais. */
  desvio: number;
  /** Quantos em cada faixa inteira de nota (0–1, 1–2, …). */
  distribuicao: number[];
};

export type Calibracao = {
  ciclo: string;
  totalAvaliados: number;
  mediaGeral: number | null;
  gestores: LinhaCalibracao[];
};

/**
 * Compara a régua de cada gestor no mesmo ciclo.
 *
 * NÃO ajusta nota nenhuma. A calibração aqui é informação para a reunião entre
 * gestores, não um fator que o sistema aplica: reescalar notas por trás faria
 * a nota que a pessoa recebeu deixar de ser a que o gestor deu, e ninguém
 * conseguiria explicar a diferença.
 *
 * Gestores com um único avaliado entram na lista mesmo assim — omiti-los
 * esconderia justamente as equipes pequenas, onde uma nota isolada pesa mais.
 */
export function calibrar(ciclo: string, notas: NotaDoCiclo[], escalaMaxima = 5): Calibracao {
  if (notas.length === 0) {
    return { ciclo, totalAvaliados: 0, mediaGeral: null, gestores: [] };
  }

  const mediaGeral = arredondar(notas.reduce((s, n) => s + n.nota, 0) / notas.length);

  const porGestor = new Map<string, NotaDoCiclo[]>();
  for (const n of notas) {
    const chave = n.gestorId ?? "__sem_gestor__";
    porGestor.set(chave, [...(porGestor.get(chave) ?? []), n]);
  }

  const gestores: LinhaCalibracao[] = [...porGestor.entries()].map(([chave, doGestor]) => {
    const media = arredondar(doGestor.reduce((s, n) => s + n.nota, 0) / doGestor.length);
    const distribuicao = new Array(escalaMaxima).fill(0);
    for (const n of doGestor) {
      // Nota cheia cai na última faixa em vez de estourar o array.
      const faixa = Math.min(escalaMaxima - 1, Math.max(0, Math.ceil(n.nota) - 1));
      distribuicao[faixa]++;
    }
    return {
      gestorId: chave === "__sem_gestor__" ? null : chave,
      gestorNome: doGestor[0].gestorNome,
      avaliados: doGestor.length,
      media,
      desvio: arredondar(media - mediaGeral),
      distribuicao,
    };
  });

  // Maior desvio primeiro, em módulo: a reunião de calibração começa pelos
  // extremos, que são onde a régua mais destoa.
  gestores.sort((a, b) => Math.abs(b.desvio) - Math.abs(a.desvio));

  return { ciclo, totalAvaliados: notas.length, mediaGeral, gestores };
}

/** Uma casa decimal: nota de desempenho não tem precisão de centésimo. */
function arredondar(n: number): number {
  return Math.round(n * 10) / 10;
}
