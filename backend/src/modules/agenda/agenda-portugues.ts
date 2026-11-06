export const normalAgenda = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const unidades = ['zero','um','dois','tres','quatro','cinco','seis','sete','oito','nove','dez','onze','doze','treze','catorze','quinze','dezesseis','dezessete','dezoito','dezenove'];
export function numeroFalado(s: string): number | null {
  const n = normalAgenda(s).replace(/^uma$/, 'um').replace(/^duas$/, 'dois').replace(/^quatorze$/, 'catorze');
  if (/^\d{1,3}$/.test(n)) return Number(n);
  const i = unidades.indexOf(n);
  if (i >= 0) return i;
  const m = n.match(/^(vinte|trinta|quarenta|cinquenta|sessenta)(?: e (um|dois|tres|quatro|cinco|seis|sete|oito|nove))?$/);
  return m ? ({vinte:20,trinta:30,quarenta:40,cinquenta:50,sessenta:60}[m[1]] + (m[2] ? unidades.indexOf(m[2]) : 0)) : null;
}
export const NUMERO_FALADO = '(?:(?:vinte|trinta|quarenta|cinquenta|sessenta)(?: e (?:um|dois|tr[eê]s|quatro|cinco|seis|sete|oito|nove))?|zero|uma?|duas|dois|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dezesseis|dezessete|dezoito|dezenove|dez|onze|doze|treze|catorze|quatorze|quinze)';
export const HORA_FALADA = `(?:(?:\\d{1,2}(?::\\d{2}|h\\d{0,2})?|${NUMERO_FALADO})(?:\\s+horas?)?(?:\\s+e\\s+(?:meia|\\d{1,2}|${NUMERO_FALADO}))?(?:\\s+(?:da|de|[àa])\\s+(?:manh[ãa]|tarde|noite))?|meio[- ]dia|meia[- ]noite)`;
export function partesHoraFalada(texto: string): { hora: number; minuto: number; periodo?: string; escrita: boolean } | null {
  const n = normalAgenda(texto).replace(/^(?:as|ao)\s+/, '');
  const m = n.match(new RegExp(`^(${NUMERO_FALADO}|\\d{1,2})(?:\\s+horas?)?(?:\\s+e\\s+(meia|\\d{1,2}|${NUMERO_FALADO}))?(?:\\s+(?:da|de|a)\\s+(manha|tarde|noite))?$`, 'i'));
  if (!m) return null;
  const hora = numeroFalado(m[1]), minuto = !m[2] ? 0 : m[2] === 'meia' ? 30 : numeroFalado(m[2]);
  if (hora === null || minuto === null || hora > 23 || minuto > 59) return null;
  return {hora, minuto, periodo:m[3], escrita: !/^\d/.test(m[1]) || /horas?/.test(n)};
}
