import type { ExtracaoAgenda } from './aurelia-ia.service';
import { HORA_FALADA, NUMERO_FALADO, partesHoraFalada } from './agenda-portugues';

/** Same grammar for typed messages and ASR output. No persistence or defaults. */
export function comandoAgenda(texto: string): ExtracaoAgenda | null {
  if (texto.length > 1000 || variosCompromissos(texto)) return null;
  // Preserve numeric clock punctuation before normalizing speech punctuation.
  let t = texto.trim().replace(/…/g, ' ').replace(/(?<!\d)[:,;.!?]|[:,;.!?](?!\d)/g, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(/^aur[eé]li[ao]\s+/i, '');
  const prefixo = /^anota\s+a[ií](?:\s+(?:pra|para)\s+mim)?\s*/i;
  const acao = /^(?:marque|marca|agende|agendar|registre|coloca|coloque|tenho(?!\s+que\b)|quero agendar)\s+/i;
  const explicito = prefixo.test(t) || acao.test(t);
  if (prefixo.test(t)) t = t.replace(prefixo, '');
  t = t.replace(acao, '');
  if (/^tenho\s+que\b/i.test(t)) return null;
  // Sem prefixo, qualquer título acompanhado de dia e horário é um pedido
  // de agenda (por exemplo, “Futebol Arthur hoje às 17h”). A ausência de
  // data/horário continua impedindo falsos positivos no fim da função.
  t = t.replace(new RegExp(`([àa]s\\s+)${HORA_FALADA}\\s+n[aã]o\\s+(?:[ée]\\s+)?(?:[àa]s\\s+)?(${HORA_FALADA})$`, 'i'), '$1$2');
  if (/\b(?:cancelar|excluir|apagar|reagendar|toda|todo|diariamente|semanalmente|mensalmente)\b/i.test(t)) return null;
  const r: ExtracaoAgenda = { acao:'criar', titulo:'', dia:'', hora:'', duracao:'' };
  const dur = t.match(/\s+(?:por|com dura[çc][aã]o de)\s+(.+)$/i);
  if (dur) { r.duracao=dur[1]; t=t.slice(0,dur.index).trim(); }
  const dia = t.match(new RegExp(`(?:^|\\s)(?:(?:para|na|no)\\s+)?(hoje|amanh[ãa]|(?:segunda|ter[çc]a|quarta|quinta|sexta)(?:-feira)?|s[áa]bado|domingo|(?:dia\\s+)?(?:\\d{1,2}|${NUMERO_FALADO})(?:\\s+(?:do|de)\\s+(?:\\d{1,2}|janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\\s+de\\s+\\d{4})?|\\/\\d{1,2}(?:\\/\\d{4})?))(?=\\s|$)`, 'i'));
  if (dia) { r.dia=dia[1]; t=t.slice(0,dia.index)+' '+t.slice(dia.index!+dia[0].length); }
  const hora = t.match(new RegExp(`\\s+(?:(?:[àa]s|ao)\\s+)?(${HORA_FALADA})$`, 'i'));
  if (hora) { r.hora=hora[1]; t=t.slice(0,hora.index); }
  r.titulo=t.trim().replace(/\s+/g,' ');
  if (!explicito && !r.dia && !r.hora) return null;
  return r;
}

export function horarioAmbiguo(texto: string): boolean {
  const p = partesHoraFalada(texto);
  return !!p && p.escrita && p.hora >= 1 && p.hora <= 12 && !p.periodo;
}

export function variosCompromissos(texto: string): boolean {
  return /\b(?:e|tamb[eé]m|depois)\s+(?:marque|marca|agende|registre|coloca)\b/i.test(texto) ||
    new RegExp(`[àa]s\\s+${HORA_FALADA}\\s+e\\s+.+?\\s+[àa]s\\s+${HORA_FALADA}`, 'i').test(texto);
}
