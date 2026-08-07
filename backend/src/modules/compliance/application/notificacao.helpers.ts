/**
 * Reexportações usadas pelo motor de alertas.
 *
 * O motor precisa das regras de domínio, mas importá-las de dois arquivos
 * diferentes (`obrigacao.entity` e `common/datas`) espalharia o acoplamento.
 * Aqui fica o ponto único, e a proteção contra data ausente que o motor exige
 * — ele roda sem ninguém olhando, então uma data nula não pode virar `NaN`
 * silencioso no meio de uma conta de prazo.
 */

import { diasDeCalendario } from "../../../common/datas";

export { situacaoPrazo } from "../domain/obrigacao.entity";

/** `diasDeCalendario` tolerante a nulo — devolve 0 em vez de NaN. */
export function diasEntreSeguro(
  de: Date | string | null | undefined,
  ate: Date | string | null | undefined,
): number {
  if (!de || !ate) return 0;
  const n = diasDeCalendario(de, ate);
  return Number.isFinite(n) ? n : 0;
}
