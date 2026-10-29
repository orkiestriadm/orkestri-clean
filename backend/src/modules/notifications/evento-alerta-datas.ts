import {
  diaSaoPaulo,
  somarDias,
  instanteSaoPaulo,
} from "../agenda/whatsapp-rotina-datas";

const normalizar = (texto: string) => texto.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const meses = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Interpreta só o dia; nunca atribui um horário nem corrige datas impossíveis. */
export function diaCompromisso(texto: string, agora = new Date()): string | null {
  const t = normalizar(texto), hoje = diaSaoPaulo(agora);
  if (t === "hoje") return hoje;
  if (t === "amanha") return somarDias(hoje, 1);
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
