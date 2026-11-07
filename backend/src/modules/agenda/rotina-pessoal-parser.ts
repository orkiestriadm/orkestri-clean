import { diaSaoPaulo, instanteSaoPaulo, somarDias } from './whatsapp-rotina-datas';

export const normalizarRotina = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export function textoRotina(s: string) { return s.trim().replace(/^aur[eé]li[ao][,!:]?\s*/i, '').replace(/[.!?]+$/, '').trim(); }
export function interpretarLembrete(texto: string, agora = new Date(), manha = '09:00'): { titulo: string; quando: Date; padrao: boolean } | null {
  let t = textoRotina(texto).replace(/^me lembre\s+(?:de\s+)?/i, '');
  if (!/^me lembre\b/i.test(textoRotina(texto))) return null;
  const relativo = t.match(/\bdaqui\s+(?:a\s+)?(\d+)\s*(minutos?|min|m|horas?|h|dias?|d)\b/i);
  let quando: Date, padrao = false;
  if (relativo) {
    const n = Number(relativo[1]), unidade = relativo[2].toLowerCase();
    if (n < 1 || n > 525600) return null;
    quando = new Date(agora.getTime() + n * (unidade.startsWith('d') ? 86400000 : unidade.startsWith('h') ? 3600000 : 60000));
    t = t.replace(relativo[0], '');
  } else {
    const dia = t.match(/\b(amanh[aã]|hoje|dia\s+\d{1,2}\/\d{1,2}(?:\/\d{4})?)(?=\s|$)/i);
    if (!dia) return null;
    let data = diaSaoPaulo(agora);
    if (/amanh/i.test(dia[0])) data = somarDias(data, 1);
    else if (/^dia/i.test(dia[0])) {
      const [d,m,y] = dia[0].replace(/^dia\s+/i,'').split('/').map(Number);
      const ano = y || +data.slice(0,4), teste = new Date(Date.UTC(ano,m-1,d));
      if (teste.getUTCFullYear() !== ano || teste.getUTCMonth() !== m-1 || teste.getUTCDate() !== d) return null;
      data = teste.toISOString().slice(0,10);
    }
    t = t.replace(dia[0], '');
    const periodo = t.match(/(?:pela|de|à|a)\s+(manh[aã]|tarde|noite)(?=\s|$)/i);
    const hora = t.match(/(?:às|as)\s+(\d{1,2})(?:(?::|h)(\d{2}))?\s*h?\b/i);
    let h: string, m: string;
    if (hora) { h = hora[1]; m = hora[2] || '00'; t = t.replace(hora[0], ''); }
    else if (periodo) {
      const p = normalizarRotina(periodo[1]);
      [h,m] = (p === 'manha' ? manha : p === 'tarde' ? '14:00' : '19:00').split(':'); padrao = true;
    } else return null;
    if (+h > 23 || +m > 59) return null;
    if (periodo) t = t.replace(periodo[0], '');
    quando = instanteSaoPaulo(data, h.padStart(2,'0'), m.padStart(2,'0'));
  }
  const titulo = t.replace(/^\s*de\s+/i, '').replace(/\s+/g, ' ').trim();
  if (titulo.length < 2 || titulo.length > 200 || !Number.isFinite(quando.getTime()) || quando <= agora || quando.getTime() - agora.getTime() > 366 * 86400000) return null;
  return { titulo, quando, padrao };
}
