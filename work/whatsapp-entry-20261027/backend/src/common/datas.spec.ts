import { dataBR, diaLocal, diasDeCalendario } from "./datas";

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

/**
 * O mesmo erro de um dia, agora na ARITMÉTICA.
 *
 * O `dataBR` consertou a exibição em 2026-07; a conta de prazo continuou
 * errada por mais tempo, em quatro implementações separadas de "início do
 * dia". O sintoma era pior que o texto trocado: item de checklist que vencia
 * hoje aparecia atrasado, e certificação válida até hoje contava como vencida.
 * Ninguém desconfia de uma data que o sistema chama de vencida.
 */
describe("diaLocal", () => {
  it("preserva o dia de uma coluna DATE, que chega em meia-noite UTC", () => {
    // O caso que quebrava: em UTC-3 isto virava 28/07 com setHours(0,0,0,0).
    const d = diaLocal(new Date("2026-07-29T00:00:00.000Z"));
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(29);
  });

  it("usa o dia LOCAL de um instante de verdade", () => {
    // Um `criadoEm` ou `new Date()` não é coluna DATE: o dia certo é o local.
    const agora = new Date(2026, 6, 29, 22, 30);
    const d = diaLocal(agora);
    expect(d.getDate()).toBe(29);
    expect(d.getHours()).toBe(0);
  });

  it("zera a hora nos dois casos", () => {
    expect(diaLocal(new Date("2026-07-29T00:00:00.000Z")).getHours()).toBe(0);
    expect(diaLocal(new Date(2026, 6, 29, 13, 45)).getMinutes()).toBe(0);
  });
});

describe("diasDeCalendario", () => {
  it("conta zero no mesmo dia, qualquer que seja a hora", () => {
    expect(diasDeCalendario(new Date(2026, 6, 29, 8, 0), new Date(2026, 6, 29, 23, 0))).toBe(0);
  });

  it("compara instante de agora contra coluna DATE sem perder um dia", () => {
    // A mistura exata que os prazos fazem: `hoje` é instante, `validade` é DATE.
    const hoje = new Date(2026, 6, 29, 15, 0);
    expect(diasDeCalendario(hoje, new Date("2026-07-29T00:00:00.000Z"))).toBe(0);
    expect(diasDeCalendario(hoje, new Date("2026-08-03T00:00:00.000Z"))).toBe(5);
  });

  it("devolve negativo quando a data já passou", () => {
    const hoje = new Date(2026, 6, 29, 15, 0);
    expect(diasDeCalendario(hoje, new Date("2026-07-24T00:00:00.000Z"))).toBe(-5);
  });

  it("atravessa o fim do mês e o fim do ano", () => {
    expect(diasDeCalendario("2026-01-31", "2026-02-01")).toBe(1);
    expect(diasDeCalendario("2026-12-31", "2027-01-01")).toBe(1);
  });

  it("não é afetado pelo horário de verão", () => {
    // Se a conta fosse em milissegundos puros, um mês com mudança de offset
    // daria 30,96 dias e o arredondamento poderia cair para o dia errado.
    expect(diasDeCalendario("2026-10-01", "2026-11-01")).toBe(31);
  });
});
