/**
 * Indicadores de pessoas — regras puras.
 *
 * Ficam aqui porque turnover mal calculado vira decisão errada de contratação,
 * e a fórmula precisa ser testável sem banco.
 */

/**
 * Turnover do período, em porcentagem.
 *
 * Fórmula clássica de RH: média entre admissões e desligamentos sobre o
 * efetivo médio. Usar só desligamentos (o que muita planilha faz) mede
 * evasão, não rotatividade — e uma empresa que dobra de tamanho apareceria
 * com turnover baixíssimo mesmo trocando meio time.
 */
export function turnover(params: {
  admissoes: number;
  desligamentos: number;
  efetivoInicial: number;
  efetivoFinal: number;
}): number {
  const { admissoes, desligamentos, efetivoInicial, efetivoFinal } = params;
  const efetivoMedio = (efetivoInicial + efetivoFinal) / 2;
  // Empresa que começou e terminou o período sem ninguém não tem turnover
  // "infinito" — não tem turnover.
  if (efetivoMedio <= 0) return 0;
  return arredondar(((admissoes + desligamentos) / 2 / efetivoMedio) * 100);
}

/** Tempo médio de casa em meses, considerando só quem está ativo. */
export function tempoMedioDeCasaMeses(
  admissoes: (Date | null)[],
  hoje: Date = new Date(),
): number {
  const validas = admissoes.filter((d): d is Date => !!d && d <= hoje);
  if (validas.length === 0) return 0;
  const soma = validas.reduce((total, d) => total + mesesEntre(d, hoje), 0);
  return arredondar(soma / validas.length);
}

export function mesesEntre(de: Date, ate: Date): number {
  const anos = ate.getFullYear() - de.getFullYear();
  const meses = ate.getMonth() - de.getMonth();
  const ajusteDia = ate.getDate() < de.getDate() ? -1 : 0;
  return Math.max(0, anos * 12 + meses + ajusteDia);
}

/** Uma casa decimal: precisão maior que isso é ruído em indicador de RH. */
export function arredondar(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Distribuição em fatias ordenadas da maior para a menor, com percentual.
 *
 * "Sem informação" fica sempre por último mesmo quando é a maior fatia: é
 * lacuna de cadastro, não uma categoria — deixá-la no topo esconde o dado real.
 */
export function distribuicao(
  itens: { chave: string | null; total: number }[],
  rotulos: Map<string, string>,
  rotuloVazio = "Sem informação",
): { rotulo: string; total: number; percentual: number }[] {
  const soma = itens.reduce((s, i) => s + i.total, 0);
  const linhas = itens.map(i => ({
    rotulo: i.chave ? (rotulos.get(i.chave) ?? "—") : rotuloVazio,
    total: i.total,
    percentual: soma > 0 ? arredondar((i.total / soma) * 100) : 0,
    vazio: !i.chave,
  }));

  return linhas
    .sort((a, b) => {
      if (a.vazio !== b.vazio) return a.vazio ? 1 : -1;
      return b.total - a.total;
    })
    .map(({ vazio, ...resto }) => resto);
}

/* ── Exportação CSV ───────────────────────────────────────────────────────── */

/**
 * Escapa um campo para CSV.
 *
 * O prefixo em `=`, `+`, `-` e `@` é defesa contra fórmula: um nome gravado
 * como `=CMD()` vira execução quando o arquivo abre no Excel. Aspa simples à
 * frente neutraliza sem sujar o valor visível.
 */
export function campoCsv(valor: unknown): string {
  if (valor === null || valor === undefined) return "";

  let texto = valor instanceof Date
    ? valor.toLocaleDateString("pt-BR")
    : String(valor);

  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;

  if (/[";\n\r]/.test(texto)) texto = `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

/**
 * Monta o CSV completo.
 *
 * Separador `;` e BOM: o Excel em pt-BR abre CSV com vírgula tudo em uma
 * coluna só, e sem BOM come os acentos.
 */
export function montarCsv(cabecalho: string[], linhas: unknown[][]): string {
  const corpo = [cabecalho, ...linhas]
    .map(linha => linha.map(campoCsv).join(";"))
    .join("\r\n");
  return `﻿${corpo}`;
}
