import {
  diaSaoPaulo,
  somarDias,
  instanteSaoPaulo,
} from "../agenda/whatsapp-rotina-datas";

/** Data e hora explícitas; datas inválidas nunca são corrigidas silenciosamente. */
export function novaDataCompromisso(
  texto: string,
  agora = new Date(),
): Date | null {
  const t = texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const match = t.match(
    /^(hoje|amanha|\d{1,2}\/\d{1,2}(?:\/\d{4})?)\s+(?:as\s+)?(\d{1,2})(?::([0-5]\d)|h(?:([0-5]\d))?)$/,
  );
  if (!match) return null;
  const hoje = diaSaoPaulo(agora);
  let dia =
    match[1] === "hoje"
      ? hoje
      : match[1] === "amanha"
        ? somarDias(hoje, 1)
        : "";
  if (!dia) {
    const [d, m, y] = match[1].split("/").map(Number),
      ano = y || Number(hoje.slice(0, 4));
    if (ano < 2000 || ano > 2199) return null;
    const teste = new Date(Date.UTC(ano, m - 1, d));
    if (
      teste.getUTCFullYear() !== ano ||
      teste.getUTCMonth() !== m - 1 ||
      teste.getUTCDate() !== d
    )
      return null;
    dia = teste.toISOString().slice(0, 10);
  }
  const hora = Number(match[2]),
    minuto = Number(match[3] || match[4] || 0);
  if (hora > 23) return null;
  try {
    const data = instanteSaoPaulo(
      dia,
      String(hora).padStart(2, "0"),
      String(minuto).padStart(2, "0"),
    );
    return data > agora ? data : null;
  } catch {
    return null;
  }
}

export function horarioCompromisso(data: Date): string {
  return data.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}
