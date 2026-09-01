/**
 * Trava os parsers de GASTO e RELATÓRIO (comandos do módulo de Gastos pelo
 * WhatsApp). São a parte mais propensa a erro e a única testável sem subir a
 * aplicação (não dependem de banco, WhatsApp ou permissão).
 */
import "reflect-metadata";
import { parseComandoGasto, parseComandoRelatorio } from "./whatsapp-inbound.module";

// 31/08/2026 10:00 — referência fixa.
const AGORA = new Date(2026, 7, 31, 10, 0, 0);
const ymd = (d: Date) => ({ ano: d.getFullYear(), mes: d.getMonth(), dia: d.getDate() });

describe("parseComandoGasto — valor, forma, parcelas", () => {
  it("à vista com forma de pagamento", () => {
    const r = parseComandoGasto("Gasto: Combustível 200 crédito à vista", AGORA) as any;
    expect(r.valor).toBe(200);
    expect(r.formaPagamento).toBe("CREDITO");
    expect(r.parcelas).toBe(1);
    expect(r.valorParcela).toBeNull();
    expect(r.descricao).toBe("Combustível");
    expect(r.categoria).toBe("Combustível");
  });

  it("parcelado calcula o valor da parcela e lê a data", () => {
    const r = parseComandoGasto("Gasto: TV 2400 crédito 12x 10/09", AGORA) as any;
    expect(r.valor).toBe(2400);
    expect(r.parcelas).toBe(12);
    expect(r.valorParcela).toBe(200);
    expect(r.descricao).toBe("TV");
    expect(ymd(r.dataGasto)).toEqual({ ano: 2026, mes: 8, dia: 10 });
  });

  it("débito vem antes de crédito (cartão de débito)", () => {
    const r = parseComandoGasto("Gastei 45 no mercado no débito", AGORA) as any;
    expect(r.valor).toBe(45);
    expect(r.formaPagamento).toBe("DEBITO");
    expect(r.descricao).toBe("mercado");
    expect(r.categoria).toBe("Mercado");
  });

  it("\"cartão\" sozinho conta como crédito", () => {
    const r = parseComandoGasto("Comprei tênis 300 no cartão", AGORA) as any;
    expect(r.formaPagamento).toBe("CREDITO");
    expect(r.categoria).toBe("Roupas");
  });

  it("sem forma informada → NAO_INFORMADO", () => {
    const r = parseComandoGasto("Gasto: Almoço 35", AGORA) as any;
    expect(r.formaPagamento).toBe("NAO_INFORMADO");
    expect(r.categoria).toBe("Alimentação");
  });

  it("valor em milhar não confunde com parcelas", () => {
    const r = parseComandoGasto("Gasto: Uber 1.250,00 crédito 10x", AGORA) as any;
    expect(r.valor).toBe(1250);
    expect(r.parcelas).toBe(10);
    expect(r.valorParcela).toBe(125);
  });
});

describe("parseComandoGasto — prefixo e faltas", () => {
  it("sem palavra-chave e exigindo prefixo → null", () => {
    expect(parseComandoGasto("Mercado 150 crédito", AGORA, true)).toBeNull();
  });

  it("sem palavra-chave mas SEM exigir prefixo → parseia (usuário só-Gastos)", () => {
    const r = parseComandoGasto("Mercado 150 crédito", AGORA, false) as any;
    expect(r.valor).toBe(150);
    expect(r.formaPagamento).toBe("CREDITO");
  });

  it("texto sem número no modo sem-prefixo → null (ignora)", () => {
    expect(parseComandoGasto("bom dia", AGORA, false)).toBeNull();
  });

  it("comando de gasto sem valor → 'sem_valor'", () => {
    expect(parseComandoGasto("Gasto: reunião", AGORA)).toBe("sem_valor");
  });

  it("comando de evento não é gasto → null", () => {
    expect(parseComandoGasto("Evento: Reunião 27/08 14:00", AGORA)).toBeNull();
  });
});

describe("parseComandoRelatorio — período e forma", () => {
  it("padrão: este mês, total", () => {
    expect(parseComandoRelatorio("Relatório: quanto gastei esse mês", AGORA))
      .toMatchObject({ label: "este mês", forma: "TOTAL" });
  });

  it("semana + débito", () => {
    expect(parseComandoRelatorio("Quanto gastei essa semana no débito", AGORA))
      .toMatchObject({ label: "últimos 7 dias", forma: "DEBITO" });
  });

  it("crédito sem período → este mês", () => {
    expect(parseComandoRelatorio("Relatório no crédito", AGORA))
      .toMatchObject({ label: "este mês", forma: "CREDITO" });
  });

  it("hoje", () => {
    expect(parseComandoRelatorio("Quanto gastei hoje", AGORA))
      .toMatchObject({ label: "hoje", forma: "TOTAL" });
  });

  it("mês passado", () => {
    expect(parseComandoRelatorio("resumo mês passado", AGORA))
      .toMatchObject({ label: "mês passado", forma: "TOTAL" });
  });

  it("frase comum não é relatório → null", () => {
    expect(parseComandoRelatorio("bom dia", AGORA)).toBeNull();
    expect(parseComandoRelatorio("Gasto: mercado 50", AGORA)).toBeNull();
  });
});
