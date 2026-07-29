import { dataBR } from "./datas";

/**
 * Guarda contra o erro de um dia.
 *
 * O defeito original era `toLocaleDateString("pt-BR")` sobre um `Date` de coluna
 * DATE: o Prisma devolve meia-noite UTC e o processo roda em America/Sao_Paulo,
 * então 29/07 saía como 28/07 em vigência de salário, admissão e férias. O dado
 * no banco estava certo; só o texto mentia.
 *
 * Os casos abaixo fixam a leitura pelos componentes UTC, que é o que torna o
 * resultado igual em qualquer fuso — inclusive no servidor de produção, onde o
 * deslocamento é negativo e o bug aparecia.
 */
describe("dataBR", () => {
  it("mantém o dia de um DATE em meia-noite UTC", () => {
    expect(dataBR(new Date("2026-07-29T00:00:00.000Z"))).toBe("29/07/2026");
  });

  it("aceita a string sem hora, como vem do formulário", () => {
    expect(dataBR("2026-07-29")).toBe("29/07/2026");
  });

  it("preenche dia e mês com zero à esquerda", () => {
    expect(dataBR("2026-01-05")).toBe("05/01/2026");
  });

  it("não recua na virada do ano", () => {
    expect(dataBR(new Date("2027-01-01T00:00:00.000Z"))).toBe("01/01/2027");
  });

  it("devolve vazio para ausência de data, não 'Invalid Date'", () => {
    expect(dataBR(null)).toBe("");
    expect(dataBR(undefined)).toBe("");
    expect(dataBR("")).toBe("");
    expect(dataBR("nao é data")).toBe("");
  });
});
