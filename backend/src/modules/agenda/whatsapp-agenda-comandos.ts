import type { ExtracaoAgenda } from './aurelia-ia.service';

/** Same grammar for typed messages and ASR output. No persistence or defaults. */
export function comandoAgenda(texto: string): ExtracaoAgenda | null {
  if (texto.length > 1000) return null;
  // Preserve numeric clock punctuation before normalizing speech punctuation.
  let t = texto.trim().replace(/(?<!\d)[:,;.!?]|[:,;.!?](?!\d)/g, ' ').replace(/\s+/g, ' ').trim();
  const prefixo = /^(?:aur[eé]li[ao]\s+)?anota\s+a[ií]\s+(?:pra|para)\s+mim\b\s*/i;
  const acao = /^(?:marque|marca|agende|agendar|tenho(?!\s+que\b)|quero agendar)\s+/i;
  const explicito = prefixo.test(t) || acao.test(t);
  if (prefixo.test(t)) t = t.replace(prefixo, '');
  t = t.replace(acao, '');
  if (!explicito && !/^(?:dentista|academia|cardiologista|reuni[aã]o)\b/i.test(t)) return null;
  if (/\b(?:cancelar|excluir|apagar|reagendar|toda|todo|diariamente|semanalmente|mensalmente)\b/i.test(t)) return null;
  const r: ExtracaoAgenda = { acao:'criar', titulo:'', dia:'', hora:'', duracao:'' };
  const dur = t.match(/\s+por\s+(.+)$/i);
  if (dur) { r.duracao=dur[1]; t=t.slice(0,dur.index).trim(); }
  const dia = t.match(/\b(?:hoje|amanh[ãa]|(?:segunda|ter[çc]a|quarta|quinta|sexta)(?:-feira)?|s[áa]bado|domingo|(?:dia\s+)?\d{1,2}(?:\s+(?:do|de)\s+(?:\d{1,2}|[a-zç]+)(?:\s+de\s+\d{4})?|\/\d{1,2}(?:\/\d{4})?))(?=\s|$)/i);
  if (dia) { r.dia=dia[0]; t=t.slice(0,dia.index)+' '+t.slice(dia.index!+dia[0].length); }
  const hora = t.match(/\s+(?:[àa]s\s+)?((?:\d{1,2}(?::\d{2}|h\d{0,2})?|uma|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze)(?:\s+horas?)?(?:\s+e\s+(?:meia|trinta))?(?:\s+(?:da|[àa])\s+(?:manh[ãa]|tarde|noite))?|meio[- ]dia|meia[- ]noite)$/i);
  if (hora) { r.hora=hora[1]; t=t.slice(0,hora.index); }
  r.titulo=t.trim().replace(/\s+/g,' ');
  if (!explicito && !r.dia && !r.hora) return null;
  return r;
}

export function horarioAmbiguo(texto: string): boolean {
  return /^(?:[àa]s\s+)?(?:uma|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|(?:[1-9]|1[012])\s+horas?)(?:\s+horas?)?(?:\s+e\s+(?:meia|trinta))?$/i.test(texto.trim());
}
