/** Normaliza apenas informações presentes no número ou no DDD informado. */
export function corrigirTelefoneLead(value: unknown, dddPadrao = '') {
  const original = String(value ?? '').trim();
  let texto = original.replace(/^['=]+/, '').trim();
  if (/^\d+(?:[.,]\d+)?e\+?\d+$/i.test(texto)) {
    const numero = Number(texto.replace(',', '.'));
    if (Number.isSafeInteger(numero) && numero >= 0) texto = String(numero);
  }
  texto = texto.replace(/^(\+?\d+)[.,]0+$/, '$1');
  if (/[^\d\s+().\-/]/.test(texto)) return { numero: '', exibicao: original, corrigido: false };
  let digits = texto.replace(/\D/g, '');
  if (texto.startsWith('+') && (!digits.startsWith('55') || ![12, 13].includes(digits.length))) return { numero: '', exibicao: original, corrigido: false };
  if (digits.startsWith('0055') && [14, 15].includes(digits.length)) digits = digits.slice(2);
  if (digits.startsWith('0') && [11, 12].includes(digits.length)) digits = digits.slice(1);
  const ddd = /^\s*[1-9]\d\s*$/.test(dddPadrao) ? dddPadrao.trim() : '';
  if ([8, 9].includes(digits.length) && ddd) digits = ddd + digits;
  if ([10, 11].includes(digits.length)) digits = '55' + digits;
  const numero = /^55[1-9]\d{9,10}$/.test(digits) ? digits : '';
  const exibicao = numero ? '+' + numero : original;
  return { numero, exibicao, corrigido: !!numero && exibicao !== original };
}
