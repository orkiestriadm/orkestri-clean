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
