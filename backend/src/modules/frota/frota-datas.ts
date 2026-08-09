/**
 * Janelas de data para registros da frota cujo campo de data principal é
 * opcional.
 *
 * `ManutencaoVeiculo.data` e `RevisaoVeiculo.dataRealizada` são nuláveis e na
 * base ficam vazios com frequência (medido em 2026-07-24: 0 de 20 OS tinham
 * `data`; 12 de 52 revisões tinham `dataRealizada`). Filtrar apenas por esses
 * campos descartava os registros em silêncio — o relatório de Custos zerava a
 * manutenção assim que um período era selecionado.
 *
 * A ordem do fallback é a mesma usada para exibir a data do registro, então ele
 * cai sempre no mesmo período em que aparece para o usuário.
 *
 * Usado pelo dashboard (frota.module.ts) e pelos relatórios
 * (frota-relatorios.service.ts) — manter uma definição só.
 */

/** OS: `data` quando existe, senão `dataAbertura`. */
export function janelaManutencao(range: any) {
  if (!range) return {};
  return { OR: [{ data: range }, { data: null, dataAbertura: range }] };
}

/** Revisão: `dataRealizada` quando existe, senão `dataPrevista`. */
export function janelaRevisao(range: any) {
  if (!range) return {};
  return { OR: [{ dataRealizada: range }, { dataRealizada: null, dataPrevista: range }] };
}

/** Data efetiva de uma OS, para exibição/agrupamento. */
export function dataEfetivaManutencao(m: any): Date | null {
  return m?.data || m?.dataAbertura || null;
}

/** Data efetiva de uma revisão, para exibição/agrupamento. */
export function dataEfetivaRevisao(r: any): Date | null {
  return r?.dataRealizada || r?.dataPrevista || null;
}

/**
 * Converte "YYYY-MM-DD" vindo da query em meia-noite LOCAL.
 *
 * `new Date("2026-07-01")` é interpretado como UTC. No container, que roda
 * `TZ=America/Sao_Paulo`, isso vira **30/06 às 21:00** — o filtro passa a
 * incluir três horas do dia anterior. O `frota-relatorios.service.ts` já
 * resolvia isso com um `diaLocal()` privado desde julho/2026, mas a correção
 * nunca chegou ao `frota.module.ts`, que continuava com `new Date()` cru no
 * dashboard executivo e na análise de consumo.
 *
 * Também valida: antes, `?from=abacaxi` produzia um `Invalid Date` que só
 * estourava lá dentro do Prisma, devolvendo **500** para o que é erro do
 * cliente. Agora falha cedo, e quem chama converte em 400.
 *
 * @param fimDoDia usa 23:59:59.999 — para o lado `lte` de um intervalo.
 * @returns `null` quando o valor é vazio; lança `RangeError` quando é inválido.
 */
export function dataQueryLocal(valor: any, fimDoDia = false): Date | null {
  if (valor === undefined || valor === null || valor === "") return null;

  const s = String(valor).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) throw new RangeError(`Data inválida: "${s}". Use o formato AAAA-MM-DD.`);

  const ano = Number(m[1]), mes = Number(m[2]), dia = Number(m[3]);
  const d = new Date(ano, mes - 1, dia);
  // Rejeita 2026-02-31 e afins, que o Date silenciosamente rola para março.
  if (isNaN(d.getTime()) || d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) {
    throw new RangeError(`Data inválida: "${s}".`);
  }

  if (fimDoDia) d.setHours(23, 59, 59, 999);
  return d;
}
