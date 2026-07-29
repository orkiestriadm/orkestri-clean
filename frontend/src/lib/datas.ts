/**
 * Formatação de data.
 *
 * Existe por causa de um erro de um dia: `new Date("2026-07-29").toLocaleDateString("pt-BR")`
 * devolve **28/07/2026** no Brasil. A string sem hora é interpretada como
 * meia-noite UTC e, convertida para UTC-3, volta para o dia anterior.
 *
 * O sintoma é traiçoeiro porque parece certo: a data existe, está no formato
 * certo, só está um dia errada. Vigência de salário, limite para gozar férias,
 * validade de certificado e data de admissão vinham todos deslocados — e o dado
 * no banco estava correto o tempo todo.
 *
 * Coluna DATE não tem fuso: 29 de julho é 29 de julho em qualquer lugar. Então
 * data-só é formatada por recorte de texto, sem passar por `Date`.
 */

/**
 * Reconhece o que veio de uma coluna DATE.
 *
 * Duas formas: "2026-07-29" e "2026-07-29T00:00:00.000Z" — a segunda é como o
 * Prisma serializa DATE no JSON. Meia-noite UTC exata em coluna de timestamp
 * seria ambíguo (21h de Brasília do dia anterior), mas na prática esse valor
 * indica coluna DATE; um instante real não cai exatamente nela.
 */
const SO_DATA = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z?)?$/;

/** dd/mm/aaaa, ou `null` quando não há data. */
export function formatarDataBR(valor: string | Date | null | undefined): string | null {
  if (!valor) return null;

  const texto = typeof valor === "string" ? valor : valor.toISOString();
  const so = SO_DATA.exec(texto);
  if (so) return `${so[3]}/${so[2]}/${so[1]}`;

  const d = new Date(texto);
  if (Number.isNaN(d.getTime())) return null;
  // Com hora, a conversão para o fuso local é o comportamento certo: aí o
  // valor É um instante, e quem lê quer vê-lo no próprio relógio.
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Igual, com traço no lugar do vazio — para célula de tabela. */
export function dataOuTraco(valor: string | Date | null | undefined): string {
  return formatarDataBR(valor) ?? "—";
}
