const ZONA = "America/Sao_Paulo";
export function partesSaoPaulo(data: Date) {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(data);
  return Object.fromEntries(partes.map(p => [p.type, p.value]));
}
export function diaSaoPaulo(data: Date): string {
  const p = partesSaoPaulo(data); return `${p.year}-${p.month}-${p.day}`;
}
export function somarDias(dia: string, dias: number): string {
  const d = new Date(dia + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10);
}
export function instanteSaoPaulo(dia: string, hora = "00", minuto = "00", segundo = "00"): Date {
  const alvo = Date.parse(`${dia}T${hora}:${minuto}:${segundo}Z`);
  let tentativa = alvo;
  for (let i = 0; i < 4; i++) {
    const p = partesSaoPaulo(new Date(tentativa));
    const local = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    const diferenca = alvo - local;
    if (!diferenca) return new Date(tentativa);
    tentativa += diferenca;
  }
  throw new Error("Horário local inválido");
}

/** Ocorrência no dia, sem percorrer centenas de repetições diárias antigas.
 * Mensal mantém a regra de avanço de calendário atualmente usada na Agenda.
 */
export function ocorrenciaNoDia(evento: any, dia: string, inicioDia: Date, fimDia: Date): any | null {
  const inicio = new Date(evento.inicio), fim = evento.fim ? new Date(evento.fim) : null;
  if (!evento.recorrencia) return inicio < fimDia && (fim ? fim > inicioDia : inicio >= inicioDia) ? evento : null;
  const origem = partesSaoPaulo(inicio), diaOrigem = `${origem.year}-${origem.month}-${origem.day}`;
  const diferenca = (Date.parse(dia + "T00:00:00Z") - Date.parse(diaOrigem + "T00:00:00Z")) / 86400000;
  if (diferenca < 0) return null;
  if (evento.recorrencia === "SEMANAL" && diferenca % 7) return null;
  if (evento.recorrencia === "QUINZENAL" && diferenca % 14) return null;
  if (evento.recorrencia === "MENSAL") {
    const atual = new Date(diaOrigem + "T12:00:00Z"), limite = new Date(dia + "T12:00:00Z");
    let passos = 0;
    while (atual < limite && passos++ < 1200) atual.setUTCMonth(atual.getUTCMonth() + 1);
    if (atual.toISOString().slice(0, 10) !== dia) return null;
  } else if (!["DIARIA", "SEMANAL", "QUINZENAL"].includes(evento.recorrencia)) return null;
  const ocorrencia = instanteSaoPaulo(dia, origem.hour, origem.minute, origem.second);
  if (ocorrencia < inicio || (evento.recorrenciaFim && ocorrencia > new Date(evento.recorrenciaFim))) return null;
  return { ...evento, inicio: ocorrencia, fim: fim ? new Date(ocorrencia.getTime() + fim.getTime() - inicio.getTime()) : null };
}

export function dataTarefa(texto: string, agora: Date): { titulo: string; dia: string } | null {
  let titulo = texto.trim(), dia = diaSaoPaulo(agora);
  if (/^(hoje|amanh[aã]|\d{1,2}\/\d{1,2}(?:\/\d{4})?)$/i.test(titulo)) return null;
  const data = titulo.match(/\s+(hoje|amanh[aã]|\d{1,2}\/\d{1,2}(?:\/\d{4})?)$/i);
  if (data) {
    titulo = titulo.slice(0, data.index).trim();
    if (/amanh/i.test(data[1])) dia = somarDias(dia, 1);
    else if (data[1].includes("/")) {
      const [d, m, y] = data[1].split("/").map(Number), ano = y || Number(dia.slice(0, 4));
      const candidato = new Date(Date.UTC(ano, m - 1, d));
      if (candidato.getUTCFullYear() !== ano || candidato.getUTCMonth() !== m - 1 || candidato.getUTCDate() !== d) return null;
      dia = candidato.toISOString().slice(0, 10);
    }
  }
  return titulo.length >= 2 && titulo.length <= 200 && !/[\r\n]/.test(titulo) ? { titulo, dia } : null;
}
