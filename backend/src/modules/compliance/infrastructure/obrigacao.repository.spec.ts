import { whereDaSituacao } from "./obrigacao.repository";
import {
  situacaoPrazo, estaProrrogada, SituacaoPrazo,
} from "../domain/obrigacao.entity";

/**
 * A mesma regra existe em dois lugares e este teste é o que os mantém juntos.
 *
 *  - `situacaoPrazo()` classifica uma obrigação já carregada (usado na
 *    apresentação, no calendário e no motor de alertas).
 *  - `whereDaSituacao()` traduz a mesma classificação para um WHERE do Prisma
 *    (usado na listagem paginada e nos cartões do painel).
 *
 * Se divergirem, o painel conta uma coisa e a lista filtrada mostra outra — e
 * o defeito seria invisível até alguém somar as duas telas na mão.
 *
 * O avaliador abaixo interpreta o subconjunto de WHERE que a tradução usa
 * (AND, OR, lt, gte, null, igualdade booleana) sobre linhas em memória.
 */

const dia = (iso: string) => new Date(`${iso}T00:00:00`);
const HOJE = dia("2026-08-06");

type Linha = {
  nome: string;
  dataValidade: Date | null;
  prazoFatalEm: Date | null;
  prazoInternoEm: Date | null;
  renovacaoAutomatica: boolean;
  protocoloEm: Date | null;
};

function avaliar(where: any, linha: any): boolean {
  if (where == null) return true;

  return Object.entries(where).every(([chave, condicao]) => {
    if (chave === "AND") return (condicao as any[]).every(c => avaliar(c, linha));
    if (chave === "OR") return (condicao as any[]).some(c => avaliar(c, linha));

    const valor = linha[chave];

    if (condicao === null) return valor == null;
    if (typeof condicao === "boolean") return valor === condicao;

    // Operadores de comparação. Coluna nula nunca satisfaz `lt`/`gte` — é o
    // comportamento do SQL (NULL não é comparável), e a tradução depende disso.
    const op = condicao as Record<string, any>;
    if ("lt" in op) {
      if (valor == null) return false;
      if (!(new Date(valor).getTime() < new Date(op.lt).getTime())) return false;
    }
    if ("gte" in op) {
      if (valor == null) return false;
      if (!(new Date(valor).getTime() >= new Date(op.gte).getTime())) return false;
    }
    return true;
  });
}

/** Materializa a coluna `prorrogacaoVigente`, como o serviço faz ao gravar. */
function comColunaCalculada(l: Linha) {
  return {
    ...l,
    prorrogacaoVigente: estaProrrogada({
      renovacaoAutomatica: l.renovacaoAutomatica,
      protocoloEm: l.protocoloEm,
      prazoFatalEm: l.prazoFatalEm,
      dataValidade: l.dataValidade,
    }),
  };
}

const SITUACOES: SituacaoPrazo[] = [
  "sem_validade", "vigente", "renovacao_devida",
  "prazo_fatal_vencido", "vencida", "prorrogada",
];

/** Casos tirados da planilha real, mais os limites que ela não exercitava. */
const LINHAS: Linha[] = [
  {
    nome: "LI Lote 1 — folgada (2029)",
    dataValidade: dia("2029-04-24"), prazoFatalEm: dia("2028-12-25"),
    prazoInternoEm: dia("2028-10-26"), renovacaoAutomatica: false, protocoloEm: null,
  },
  {
    nome: "AVCB Sede — prazo interno estourado",
    dataValidade: dia("2026-08-17"), prazoFatalEm: dia("2026-08-17"),
    prazoInternoEm: dia("2026-06-18"), renovacaoAutomatica: false, protocoloEm: null,
  },
  {
    nome: "ABIO — prazo fatal estourado, validade em pé",
    dataValidade: dia("2026-08-29"), prazoFatalEm: dia("2026-06-30"),
    prazoInternoEm: dia("2026-05-01"), renovacaoAutomatica: false, protocoloEm: null,
  },
  {
    nome: "LO 709/2008 — vencida e prorrogada por protocolo tempestivo",
    dataValidade: dia("2012-07-31"), prazoFatalEm: dia("2012-04-02"),
    prazoInternoEm: dia("2012-02-02"), renovacaoAutomatica: true, protocoloEm: dia("2012-03-01"),
  },
  {
    nome: "vencida com protocolo ATRASADO — não prorroga",
    dataValidade: dia("2012-07-31"), prazoFatalEm: dia("2012-04-02"),
    prazoInternoEm: dia("2012-02-02"), renovacaoAutomatica: true, protocoloEm: dia("2012-07-30"),
  },
  {
    nome: "vencida com a flag ligada mas SEM protocolo",
    dataValidade: dia("2026-08-05"), prazoFatalEm: dia("2026-08-05"),
    prazoInternoEm: dia("2026-06-06"), renovacaoAutomatica: true, protocoloEm: null,
  },
  {
    nome: "vence hoje",
    dataValidade: HOJE, prazoFatalEm: HOJE, prazoInternoEm: HOJE,
    renovacaoAutomatica: false, protocoloEm: null,
  },
  {
    nome: "prazo interno é hoje",
    dataValidade: dia("2026-12-22"), prazoFatalEm: dia("2026-12-22"),
    prazoInternoEm: HOJE, renovacaoAutomatica: false, protocoloEm: null,
  },
  {
    nome: "sem validade",
    dataValidade: null, prazoFatalEm: null, prazoInternoEm: null,
    renovacaoAutomatica: false, protocoloEm: null,
  },
  {
    nome: "validade sem prazos calculados",
    dataValidade: dia("2027-01-06"), prazoFatalEm: null, prazoInternoEm: null,
    renovacaoAutomatica: false, protocoloEm: null,
  },
  {
    nome: "prorrogada com prazo interno estourado, validade ainda em pé",
    dataValidade: dia("2026-12-22"), prazoFatalEm: dia("2026-08-01"),
    prazoInternoEm: dia("2026-06-01"), renovacaoAutomatica: true, protocoloEm: dia("2026-07-15"),
  },
];

describe("whereDaSituacao × situacaoPrazo", () => {
  it.each(LINHAS.map(l => [l.nome, l] as const))(
    "classifica igual nos dois caminhos: %s",
    (_nome, linha) => {
      const registro = comColunaCalculada(linha);
      const esperada = situacaoPrazo(linha, HOJE);

      const casadas = SITUACOES.filter(s => avaliar(whereDaSituacao(s, HOJE), registro));

      // Exatamente uma situação pode casar — as fatias são mutuamente
      // exclusivas, senão a soma dos cartões do painel passaria do total.
      expect(casadas).toEqual([esperada]);
    },
  );

  it("as fatias cobrem toda a carteira, sem sobra", () => {
    for (const linha of LINHAS) {
      const registro = comColunaCalculada(linha);
      const casadas = SITUACOES.filter(s => avaliar(whereDaSituacao(s, HOJE), registro));
      expect(casadas).toHaveLength(1);
    }
  });

  it("situação desconhecida não filtra nada, em vez de esconder tudo", () => {
    const registro = comColunaCalculada(LINHAS[0]);
    expect(avaliar(whereDaSituacao("inexistente", HOJE), registro)).toBe(true);
  });
});
