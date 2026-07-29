import {
  estaVigente, haSobreposicao, validarConcessao, custoVigente, categoriaValida,
} from "./benefit.entity";

const d = (iso: string) => new Date(`${iso}T00:00:00`);

describe("vigência da concessão", () => {
  it("é vigente entre início e fim", () => {
    expect(estaVigente({ inicio: d("2026-01-01"), fim: d("2026-12-31") }, d("2026-06-15"))).toBe(true);
  });

  // Fim nulo não é "encerrado sem data": é "ainda vale".
  it("sem data de fim, continua vigente", () => {
    expect(estaVigente({ inicio: d("2026-01-01"), fim: null }, d("2030-01-01"))).toBe(true);
  });

  it("inclui as duas pontas", () => {
    const c = { inicio: d("2026-01-01"), fim: d("2026-12-31") };
    expect(estaVigente(c, d("2026-01-01"))).toBe(true);
    expect(estaVigente(c, d("2026-12-31"))).toBe(true);
  });

  it("não é vigente antes de começar", () => {
    expect(estaVigente({ inicio: d("2026-06-01"), fim: null }, d("2026-01-01"))).toBe(false);
  });

  it("não é vigente depois de encerrada", () => {
    expect(estaVigente({ inicio: d("2026-01-01"), fim: d("2026-03-31") }, d("2026-04-01"))).toBe(false);
  });

  // A hora do dia não pode decidir vigência.
  it("ignora hora do dia", () => {
    const c = { inicio: new Date("2026-01-01T23:00:00"), fim: null };
    expect(estaVigente(c, new Date("2026-01-01T09:00:00"))).toBe(true);
  });
});

describe("sobreposição", () => {
  it("acusa períodos que se cruzam", () => {
    expect(haSobreposicao(
      { inicio: d("2026-01-01"), fim: d("2026-06-30") },
      { inicio: d("2026-06-01"), fim: d("2026-12-31") },
    )).toBe(true);
  });

  it("aceita períodos que não se tocam", () => {
    expect(haSobreposicao(
      { inicio: d("2026-01-01"), fim: d("2026-05-31") },
      { inicio: d("2026-06-01"), fim: null },
    )).toBe(false);
  });

  // Uma concessão vigente bloqueia qualquer início posterior.
  it("concessão sem fim conflita com qualquer início posterior", () => {
    expect(haSobreposicao(
      { inicio: d("2026-01-01"), fim: null },
      { inicio: d("2028-01-01"), fim: null },
    )).toBe(true);
  });

  it("encostar em um dia já é sobreposição", () => {
    expect(haSobreposicao(
      { inicio: d("2026-01-01"), fim: d("2026-06-30") },
      { inicio: d("2026-06-30"), fim: null },
    )).toBe(true);
  });
});

describe("validação da concessão", () => {
  it("aceita concessão sem conflito", () => {
    expect(validarConcessao({ inicio: d("2026-01-01") }).valido).toBe(true);
  });

  it("recusa fim anterior ao início", () => {
    const r = validarConcessao({ inicio: d("2026-06-01"), fim: d("2026-01-01") });
    expect(r.valido).toBe(false);
    expect(r.motivo).toBe("periodo_invertido");
  });

  it("recusa valor negativo", () => {
    const r = validarConcessao({ inicio: d("2026-01-01"), valor: -50 });
    expect(r.valido).toBe(false);
    expect(r.motivo).toBe("valor_negativo");
  });

  it("aceita valor zero — benefício sem custo direto existe", () => {
    expect(validarConcessao({ inicio: d("2026-01-01"), valor: 0 }).valido).toBe(true);
  });

  it("recusa sobreposição com concessão existente", () => {
    const r = validarConcessao({
      inicio: d("2026-03-01"),
      existentes: [{ inicio: d("2026-01-01"), fim: null }],
    });
    expect(r.valido).toBe(false);
    expect(r.motivo).toBe("sobreposicao");
    expect(r.detalhe).toContain("vigente");
  });

  it("aceita nova concessão depois da anterior encerrada", () => {
    const r = validarConcessao({
      inicio: d("2026-07-01"),
      existentes: [{ inicio: d("2026-01-01"), fim: d("2026-06-30") }],
    });
    expect(r.valido).toBe(true);
  });
});

describe("custo vigente", () => {
  const hoje = d("2026-06-15");

  it("soma apenas o que está vigente", () => {
    const custo = custoVigente([
      { inicio: d("2026-01-01"), fim: null, valor: 500 },        // vigente
      { inicio: d("2026-01-01"), fim: d("2026-03-31"), valor: 300 }, // encerrado
      { inicio: d("2026-12-01"), fim: null, valor: 900 },        // futuro
    ], hoje);
    expect(custo).toBe(500);
  });

  // Benefício sem valor não some do custo, apenas não soma.
  it("trata valor ausente como zero", () => {
    expect(custoVigente([{ inicio: d("2026-01-01"), fim: null }], hoje)).toBe(0);
  });
});

describe("categoria", () => {
  it("aceita categoria conhecida", () => {
    expect(categoriaValida("saude")).toBe(true);
  });

  it("recusa categoria inventada", () => {
    expect(categoriaValida("carro_da_empresa")).toBe(false);
  });
});
