/**
 * Trava o parser de CUSTO (comando "Custo:/Despesa:/Gasto:/Conta:" pelo WhatsApp).
 *
 * O parsing de valor em formato BR e de vencimento é a parte mais propensa a
 * erro e a única testável sem subir a aplicação (não depende de banco, WhatsApp
 * ou permissão). Estes casos são os que foram validados à mão antes do deploy
 * da 1.21.5 — se alguém mexer na regex e reintroduzir um bug, aqui quebra.
 */
import "reflect-metadata";
import { parseComandoCusto } from "./whatsapp-inbound.module";

// 31/08/2026 10:00 — data de referência fixa (nada de "hoje" real no teste).
const AGORA = new Date(2026, 7, 31, 10, 0, 0);

function ymd(d: Date) {
  return { ano: d.getFullYear(), mes: d.getMonth(), dia: d.getDate() };
}

describe("parseComandoCusto — valor em formato BR", () => {
  const casos: Array<[string, number]> = [
    ["Custo: Energia 350,00 vence 10/09", 350],
    ["Despesa Almoço 45", 45],
    ["Conta: Internet R$ 100 vence amanhã", 100],
    ["Custo: Uber 1.250,00", 1250],       // milhar + centavos
    ["Custo: Cafe 3.50", 3.5],            // ponto decimal en
    ["Custo: Material 1.500", 1500],      // ponto de milhar (3 dígitos)
    ["Custo: Aluguel R$ 2.400,00 vence 05/09/2026", 2400],
  ];
  it.each(casos)("%s → R$ %d", (texto, esperado) => {
    const r = parseComandoCusto(texto, AGORA);
    expect(r).not.toBeNull();
    expect(typeof r).toBe("object");
    expect((r as any).valor).toBe(esperado);
  });
});

describe("parseComandoCusto — descrição", () => {
  it("remove valor e conectores, mantém o texto", () => {
    const r = parseComandoCusto("Gasto: Gasolina 200 no cartao hoje", AGORA) as any;
    expect(r.descricao).toBe("Gasolina no cartao");
    expect(r.valor).toBe(200);
  });

  it("pega o ÚLTIMO número quando a descrição tem número solto", () => {
    const r = parseComandoCusto("Custo: Sala 2 aluguel 1500", AGORA) as any;
    expect(r.valor).toBe(1500);
    expect(r.descricao).toBe("Sala 2 aluguel");
  });

  it("prefere o valor com R$ sobre número solto", () => {
    const r = parseComandoCusto("Custo: item 3 R$ 90", AGORA) as any;
    expect(r.valor).toBe(90);
  });
});

describe("parseComandoCusto — vencimento", () => {
  it("dd/mm usa o ano corrente", () => {
    const r = parseComandoCusto("Custo: Energia 350 vence 10/09", AGORA) as any;
    expect(ymd(r.vencimento)).toEqual({ ano: 2026, mes: 8, dia: 10 });
  });

  it("amanhã = dia seguinte", () => {
    const r = parseComandoCusto("Conta: Internet 100 vence amanhã", AGORA) as any;
    expect(ymd(r.vencimento)).toEqual({ ano: 2026, mes: 8, dia: 1 });
  });

  it("sem data → hoje (padrão)", () => {
    const r = parseComandoCusto("Despesa Almoço 45", AGORA) as any;
    expect(ymd(r.vencimento)).toEqual({ ano: 2026, mes: 7, dia: 31 });
  });

  it("dd/mm/aaaa explícito", () => {
    const r = parseComandoCusto("Custo: Aluguel 2400 vence 05/09/2026", AGORA) as any;
    expect(ymd(r.vencimento)).toEqual({ ano: 2026, mes: 8, dia: 5 });
  });
});

describe("parseComandoCusto — não-comandos e faltas", () => {
  it("comando de custo sem valor → 'sem_valor'", () => {
    expect(parseComandoCusto("Custo: reunião", AGORA)).toBe("sem_valor");
  });

  it("comando de custo vazio → 'sem_valor'", () => {
    expect(parseComandoCusto("Custo:", AGORA)).toBe("sem_valor");
  });

  it("comando de evento NÃO é custo → null (cai no parser de evento)", () => {
    expect(parseComandoCusto("Evento: Reunião 27/08 14:00", AGORA)).toBeNull();
  });

  it("frase comum sem prefixo → null (ignorada em silêncio)", () => {
    expect(parseComandoCusto("bom dia, tudo bem?", AGORA)).toBeNull();
  });
});
