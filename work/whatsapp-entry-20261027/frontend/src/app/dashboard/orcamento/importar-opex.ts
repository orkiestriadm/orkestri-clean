/**
 * Leitura da planilha OPEX.
 *
 * A versão anterior tinha as colunas CRAVADAS no código (conta=0, despesa=5,
 * 2025=8..19, 2026 previsto=21..32, 2026 realizado=49..60) e os anos escritos à
 * mão. Isso quebrou em silêncio quando a planilha ganhou uma coluna de 2027: o
 * bloco 49..60 deixou de ser "realizado de 2026" e passou a ser "orçado de
 * 2027", então o importador gravaria o ORÇAMENTO DE UM ANO como REALIZADO DE
 * OUTRO — sem erro nenhum na tela.
 *
 * Aqui as colunas são DESCOBERTAS: procura-se, na linha de cabeçalho, sequências
 * de doze datas mensais do mesmo ano. Cada sequência é um bloco. O ano vem da
 * própria data, não de um literal no código, então 2028 funciona sozinho.
 *
 * O que não dá para descobrir com segurança — se um bloco é orçado ou
 * realizado — é CHUTADO com um padrão e MOSTRADO para o usuário confirmar antes
 * de gravar. Palpite que vira número no sistema sem ninguém ver foi exatamente
 * o defeito anterior.
 *
 * Funções puras de propósito: rodam em Node num teste, contra as planilhas de
 * verdade.
 */

export type TipoBloco = "previsto" | "realizado";

export interface BlocoOpex {
  /** Identificador estável para o React e para a seleção do usuário. */
  id: string;
  ano: number;
  /** Índice da primeira coluna dos 12 meses. */
  colIni: number;
  /** Rótulo da coluna de total logo após o bloco (ex.: "T.Ano 2026_v1"). */
  rotuloTotal: string;
  /** Texto na linha de cima, sobre a primeira coluna (ex.: "2026", "Realizado"). */
  rotuloTopo: string;
  /** Palpite inicial; o usuário confirma ou troca. */
  tipo: TipoBloco;
  /** Quantas linhas de despesa têm algum valor neste bloco. */
  linhas: number;
  /** Soma do bloco — serve para o usuário bater com a planilha antes de gravar. */
  total: number;
}

export interface LeituraOpex {
  contaCol: number;
  despesaCol: number;
  linhaCabecalho: number;
  primeiraLinhaDados: number;
  blocos: BlocoOpex[];
  /** Problemas que impedem a leitura, em português, para a tela mostrar. */
  erros: string[];
}

const ehData = (v: any): Date | null => {
  if (v instanceof Date) return v;
  return null;
};
const texto = (v: any): string => (v == null ? "" : String(v).trim());
const numero = (v: any): number => (typeof v === "number" && isFinite(v) ? v : 0);

/**
 * Acha a linha que rotula as colunas ("Descrição Conta" / "Descrição Despesa").
 * Nas planilhas reais essa linha também carrega os totais, e os dados começam
 * logo abaixo dela.
 */
function acharRotulos(m: any[][]): { linha: number; conta: number; despesa: number } | null {
  for (let r = 0; r < Math.min(m.length, 8); r++) {
    const linha = m[r] || [];
    let conta = -1, despesa = -1;
    for (let c = 0; c < linha.length; c++) {
      const t = texto(linha[c]).toLowerCase();
      if (conta < 0 && /descri.*conta/.test(t)) conta = c;
      if (despesa < 0 && /descri.*despesa/.test(t)) despesa = c;
    }
    if (conta >= 0 && despesa >= 0) return { linha: r, conta, despesa };
  }
  return null;
}

/** A linha de cabeçalho é a que tem mais células de data. */
function acharLinhaCabecalho(m: any[][]): number {
  let melhor = -1, qtd = -1;
  for (let r = 0; r < Math.min(m.length, 8); r++) {
    const n = (m[r] || []).filter((v) => ehData(v)).length;
    if (n > qtd) { qtd = n; melhor = r; }
  }
  return qtd >= 12 ? melhor : -1;
}

/**
 * Varre a linha de cabeçalho procurando doze datas consecutivas de janeiro a
 * dezembro do mesmo ano. Cada sequência dessas é um bloco de um ano.
 */
function acharBlocos(cab: any[], topo: any[]): Omit<BlocoOpex, "linhas" | "total" | "id">[] {
  const achados: Omit<BlocoOpex, "linhas" | "total" | "id">[] = [];
  for (let c = 0; c + 11 < cab.length; c++) {
    const d0 = ehData(cab[c]);
    if (!d0 || d0.getMonth() !== 0) continue;
    const ano = d0.getFullYear();
    let ok = true;
    for (let k = 1; k < 12; k++) {
      const d = ehData(cab[c + k]);
      // O dia é ignorado: uma das planilhas traz 2026-06-07 no lugar de
      // 2026-06-01, e isso não deve invalidar o bloco.
      if (!d || d.getFullYear() !== ano || d.getMonth() !== k) { ok = false; break; }
    }
    if (!ok) continue;
    const rotuloTotal = texto(cab[c + 12]);
    const rotuloTopo = texto(topo[c]);
    achados.push({ ano, colIni: c, rotuloTotal, rotuloTopo, tipo: "previsto" });
    c += 11; // blocos não se sobrepõem
  }
  return achados;
}

/**
 * Palpite de orçado × realizado, em duas regras, nesta ordem:
 *
 * 1. Se algum rótulo (o total do bloco ou o texto acima dele) disser
 *    "realizado", é realizado. É o que distingue os três blocos de 2026 nas
 *    duas planilhas.
 * 2. Senão, um ano ANTERIOR ao maior ano da planilha, e que apareça uma vez só,
 *    é histórico — ou seja, realizado. É o caso do bloco de 2025, que em uma das
 *    planilhas é rotulado "T.Ano 2025_real" e na outra só "T.Ano 2025".
 *
 * Fora isso, orçado. E o usuário confirma na tela de qualquer jeito.
 */
function palpitarTipo(
  b: Omit<BlocoOpex, "linhas" | "total" | "id">,
  todos: Omit<BlocoOpex, "linhas" | "total" | "id">[],
): TipoBloco {
  const rotulos = `${b.rotuloTotal} ${b.rotuloTopo}`.toLowerCase();
  if (/realiz/.test(rotulos)) return "realizado";
  const maiorAno = Math.max(...todos.map((x) => x.ano));
  const quantosDesseAno = todos.filter((x) => x.ano === b.ano).length;
  if (b.ano < maiorAno && quantosDesseAno === 1) return "realizado";
  return "previsto";
}

/** Lê a planilha inteira e devolve os blocos encontrados, já medidos. */
export function lerPlanilhaOpex(m: any[][]): LeituraOpex {
  const erros: string[] = [];
  const vazio: LeituraOpex = { contaCol: -1, despesaCol: -1, linhaCabecalho: -1, primeiraLinhaDados: -1, blocos: [], erros };

  const rot = acharRotulos(m);
  if (!rot) { erros.push('Não achei as colunas "Descrição Conta" e "Descrição Despesa" nas primeiras linhas.'); return vazio; }

  const linhaCab = acharLinhaCabecalho(m);
  if (linhaCab < 0) { erros.push("Não achei a linha de cabeçalho com as datas dos meses."); return vazio; }

  const crus = acharBlocos(m[linhaCab] || [], m[Math.max(0, linhaCab - 1)] || []);
  if (!crus.length) { erros.push("Não achei nenhum bloco de 12 meses (janeiro a dezembro) na linha de cabeçalho."); return vazio; }

  const primeira = rot.linha + 1;
  const blocos: BlocoOpex[] = crus.map((b, i) => {
    let linhas = 0, total = 0;
    for (let r = primeira; r < m.length; r++) {
      const linha = m[r] || [];
      if (!texto(linha[rot.despesa])) continue;
      let soma = 0;
      for (let k = 0; k < 12; k++) soma += numero(linha[b.colIni + k]);
      if (soma) { linhas++; total += soma; }
    }
    return {
      ...b,
      id: `${b.ano}@${b.colIni}`,
      tipo: palpitarTipo(b, crus),
      linhas,
      total: Math.round(total * 100) / 100,
    };
  });

  return { contaCol: rot.conta, despesaCol: rot.despesa, linhaCabecalho: linhaCab, primeiraLinhaDados: primeira, blocos, erros };
}

export interface EscolhaBloco { id: string; ano: number; tipo: TipoBloco; importar: boolean }

/**
 * Monta o corpo do POST a partir dos blocos que o usuário marcou.
 *
 * Blocos do mesmo ano se juntam num ciclo só: é assim que "orçado de 2026" e
 * "realizado de 2026" viram o mesmo item, com previsto e realizado lado a lado.
 * Escolher dois blocos ORÇADOS do mesmo ano (v1 e v2) é conflito, e a tela
 * impede — aqui o último escolhido venceria, em silêncio.
 */
export function montarPayloadOpex(m: any[][], leitura: LeituraOpex, escolhas: EscolhaBloco[]) {
  const sel = escolhas.filter((e) => e.importar);
  const anos = Array.from(new Set(sel.map((e) => e.ano))).sort();
  const ciclos = anos.map((ano) => {
    const doAno = sel.filter((e) => e.ano === ano);
    const itens: any[] = [];
    for (let r = leitura.primeiraLinhaDados; r < m.length; r++) {
      const linha = m[r] || [];
      const despesa = texto(linha[leitura.despesaCol]);
      if (!despesa) continue;
      const previsto: Record<number, number> = {};
      const realizado: Record<number, number> = {};
      let tem = false;
      for (const e of doAno) {
        const b = leitura.blocos.find((x) => x.id === e.id);
        if (!b) continue;
        for (let k = 0; k < 12; k++) {
          const v = numero(linha[b.colIni + k]);
          if (!v) continue;
          tem = true;
          const arred = Math.round(v * 100) / 100;
          if (e.tipo === "previsto") previsto[k + 1] = arred;
          else realizado[k + 1] = arred;
        }
      }
      if (!tem) continue;
      itens.push({ categoria: texto(linha[leitura.contaCol]) || "SEM CATEGORIA", despesa, previsto, realizado });
    }
    const soRealizado = doAno.every((e) => e.tipo === "realizado");
    return { ano, descricao: `OPEX ${ano}${soRealizado ? " (realizado)" : ""}`, itens };
  });
  return { ciclos };
}
