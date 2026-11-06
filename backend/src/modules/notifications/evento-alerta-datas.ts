import {
  diaSaoPaulo,
  somarDias,
  instanteSaoPaulo,
} from "../agenda/whatsapp-rotina-datas";
import { numeroFalado } from '../agenda/agenda-portugues';

const normalizar = (texto: string) => texto.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const meses = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Interpreta só o dia; nunca atribui um horário nem corrige datas impossíveis. */
export function diaCompromisso(texto: string, agora = new Date()): string | null {
  let t = normalizar(texto).replace(/^(?:no |na |para )?dia\s+/, '').replace(/^(?:na|no|para)\s+/, '').replace(/^(\d{1,2})\s+(?:do|de)\s+(\d{1,2})$/, '$1/$2');
  const hoje = diaSaoPaulo(agora);
  const falada = t.match(/^(.+?) de ([a-z]+)(?: de (\d{4}))?$/);
  if (falada && numeroFalado(falada[1]) !== null) t = `${numeroFalado(falada[1])} de ${falada[2]}${falada[3] ? ' de '+falada[3] : ''}`;
  if (t === "hoje") return hoje;
  if (t === "amanha") return somarDias(hoje, 1);
  const semana = ['domingo','segunda','terca','quarta','quinta','sexta','sabado'];
  const indice = semana.indexOf(t.replace(/-feira$/, ''));
  if (indice >= 0) return somarDias(hoje, (indice - new Date(hoje+'T12:00:00Z').getUTCDay() + 7) % 7 || 7);
  const numerica = t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  const escrita = t.match(/^(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?$/);
  if (!numerica && !escrita) return null;
  const dia = Number((numerica || escrita)![1]);
  const mes = numerica ? Number(numerica[2]) : meses.indexOf(escrita![2]) + 1;
  const ano = Number((numerica || escrita)![3] || hoje.slice(0, 4));
  if (ano < 2000 || ano > 2199 || mes < 1 || mes > 12) return null;
  const teste = new Date(Date.UTC(ano, mes - 1, dia));
  return teste.getUTCFullYear() === ano && teste.getUTCMonth() === mes - 1 && teste.getUTCDate() === dia
    ? teste.toISOString().slice(0, 10) : null;
}

export function horaCompromisso(texto: string): string | null {
  const match = normalizar(texto).match(/^(?:as\s+)?(\d{1,2})(?::([0-5]\d)|h(?:([0-5]\d))?)?$/);
  if (!match || Number(match[1]) > 23) return null;
  return match[1].padStart(2, "0") + ":" + (match[2] || match[3] || "00");
}

/** Data e hora explícitas e futuras, inclusive mês escrito em português. */
export function novaDataCompromisso(texto: string, agora = new Date()): Date | null {
  const match = normalizar(texto).match(/^(.+?)\s+(?:as\s+)?(\d{1,2}(?::[0-5]\d|h(?:[0-5]\d)?)?)$/);
  if (!match) return null;
  const dia = diaCompromisso(match[1], agora), hora = horaCompromisso(match[2]);
  if (!dia || !hora) return null;
  try {
    const [h, m] = hora.split(":");
    const data = instanteSaoPaulo(dia, h, m);
    return data > agora ? data : null;
  } catch { return null; }
}

export function horarioCompromisso(data: Date): string {
  return data.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}
