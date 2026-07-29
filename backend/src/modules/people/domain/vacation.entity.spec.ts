import {
  DIAS_POR_PERIODO, VACATION_PERIOD_STATUS,
  periodosAquisitivos, statusDoPeriodo, saldoDoPeriodo, saldoDisponivel,
  periodosVencendo, validarSolicitacao, diffEmDias, MINIMO_DIAS_FRACIONAMENTO,
} from "./vacation.entity";

const d = (iso: string) => new Date(`${iso}T00:00:00`);

describe("períodos aquisitivos", () => {
  it("gera um período do primeiro ao último dia dos 12 meses", () => {
    const p = periodosAquisitivos(d("2025-03-10"), d("2025-06-01"));
    expect(p).toHaveLength(1);
    expect(p[0].inicio).toEqual(d("2025-03-10"));
    expect(p[0].fim).toEqual(d("2026-03-09"));
    // Concessivo: 12 meses após o fim do aquisitivo.
    expect(p[0].limiteConcessivo).toEqual(d("2027-03-09"));
  });

  it("acumula um período por ano de casa", () => {
    expect(periodosAquisitivos(d("2023-01-15"), d("2026-07-28"))).toHaveLength(4);
  });

  it("não gera período para admissão futura", () => {
    expect(periodosAquisitivos(d("2027-01-01"), d("2026-07-28"))).toHaveLength(0);
  });

  // 31/jan + 12 meses não pode escorregar para março.
  it("lida com admissão em dia que não existe no mês seguinte", () => {
    const p = periodosAquisitivos(d("2024-01-31"), d("2025-06-01"));
    expect(p[0].fim).toEqual(d("2025-01-30"));
  });

  it("dá 30 dias de direito por período", () => {
    expect(periodosAquisitivos(d("2024-01-01"), d("2025-06-01"))[0].diasDireito)
      .toBe(DIAS_POR_PERIODO);
  });
});

describe("situação do período", () => {
  const base = {
    inicio: d("2024-01-01"), fim: d("2024-12-31"),
    limiteConcessivo: d("2025-12-31"), diasDireito: 30, diasGozados: 0,
  };

  it("é EM_AQUISICAO enquanto os 12 meses não fecham", () => {
    expect(statusDoPeriodo(base, d("2024-06-15"))).toBe(VACATION_PERIOD_STATUS.EM_AQUISICAO);
  });

  // A comparação é por dia: no último dia ainda está adquirindo.
  it("continua EM_AQUISICAO no último dia do período", () => {
    expect(statusDoPeriodo(base, d("2024-12-31"))).toBe(VACATION_PERIOD_STATUS.EM_AQUISICAO);
  });

  it("vira ADQUIRIDO no dia seguinte ao fim", () => {
    expect(statusDoPeriodo(base, d("2025-01-01"))).toBe(VACATION_PERIOD_STATUS.ADQUIRIDO);
  });

  it("é GOZADO quando todos os dias foram usados", () => {
    expect(statusDoPeriodo({ ...base, diasGozados: 30 }, d("2025-06-01")))
      .toBe(VACATION_PERIOD_STATUS.GOZADO);
  });

  // Passar do concessivo com saldo é passivo trabalhista — precisa ser visível.
  it("é VENCIDO depois do limite concessivo com saldo", () => {
    expect(statusDoPeriodo(base, d("2026-01-01"))).toBe(VACATION_PERIOD_STATUS.VENCIDO);
  });

  it("gozado por inteiro não vence", () => {
    expect(statusDoPeriodo({ ...base, diasGozados: 30 }, d("2026-01-01")))
      .toBe(VACATION_PERIOD_STATUS.GOZADO);
  });
});

describe("saldo", () => {
  const periodo = (gozados: number, fim: string, limite: string) => ({
    inicio: d("2024-01-01"), fim: d(fim), limiteConcessivo: d(limite),
    diasDireito: 30, diasGozados: gozados,
  });

  it("desconta o que já foi gozado", () => {
    expect(saldoDoPeriodo(periodo(12, "2024-12-31", "2025-12-31"))).toBe(18);
  });

  it("nunca fica negativo", () => {
    expect(saldoDoPeriodo(periodo(45, "2024-12-31", "2025-12-31"))).toBe(0);
  });

  it("soma apenas períodos adquiridos e no prazo", () => {
    const periodos = [
      periodo(0, "2024-12-31", "2025-12-31"), // vencido em 2026
      periodo(10, "2025-12-31", "2026-12-31"), // adquirido, saldo 20
      { ...periodo(0, "2026-12-31", "2027-12-31") }, // ainda em aquisição
    ];
    expect(saldoDisponivel(periodos, d("2026-07-28"))).toBe(20);
  });
});

describe("alerta de vencimento", () => {
  const periodo = {
    inicio: d("2024-01-01"), fim: d("2024-12-31"),
    limiteConcessivo: d("2026-09-15"), diasDireito: 30, diasGozados: 0,
  };

  it("acusa período que vence dentro da janela", () => {
    expect(periodosVencendo([periodo], d("2026-07-28"), 60)).toHaveLength(1);
  });

  it("ignora período longe do vencimento", () => {
    expect(periodosVencendo([periodo], d("2026-01-01"), 60)).toHaveLength(0);
  });

  it("ignora período já vencido — deixou de ser alerta e virou passivo", () => {
    expect(periodosVencendo([periodo], d("2026-10-01"), 60)).toHaveLength(0);
  });
});

describe("validação da solicitação", () => {
  const ok = { inicio: d("2026-08-03"), fim: d("2026-08-17"), saldo: 30 };

  it("aceita período dentro do saldo", () => {
    const r = validarSolicitacao(ok);
    expect(r.valido).toBe(true);
    expect(r.dias).toBe(15); // inclusivo nas duas pontas
  });

  // Férias remuneram dias corridos, incluindo fim de semana — diferente da
  // contagem de capacidade, que usa dias úteis.
  it("conta dias corridos, não úteis", () => {
    const r = validarSolicitacao({ ...ok, inicio: d("2026-08-01"), fim: d("2026-08-30") });
    expect(r.dias).toBe(30);
  });

  it("recusa quando passa do saldo", () => {
    const r = validarSolicitacao({ ...ok, saldo: 10 });
    expect(r.valido).toBe(false);
      expect(r.motivo).toBe("sem_saldo");
      expect(r.detalhe).toContain("10");
  });

  it("recusa data final anterior à inicial", () => {
    const r = validarSolicitacao({ ...ok, inicio: d("2026-08-17"), fim: d("2026-08-03") });
    expect(r.valido).toBe(false);
    expect(r.motivo).toBe("periodo_invertido");
  });

  it("recusa fracionamento abaixo do mínimo", () => {
    const r = validarSolicitacao({ ...ok, inicio: d("2026-08-03"), fim: d("2026-08-05") });
    expect(r.valido).toBe(false);
      expect(r.motivo).toBe("fracionamento_minimo");
      expect(r.detalhe).toContain(String(MINIMO_DIAS_FRACIONAMENTO));
  });

  it("recusa sobreposição com ausência existente", () => {
    const r = validarSolicitacao({
      ...ok,
      ocupados: [{ dataInicio: "2026-08-10", dataFim: "2026-08-12" }],
    });
    expect(r.valido).toBe(false);
    expect(r.motivo).toBe("sobreposicao");
  });

  it("aceita quando a ausência existente não encosta no período", () => {
    const r = validarSolicitacao({
      ...ok,
      ocupados: [{ dataInicio: "2026-09-01", dataFim: "2026-09-05" }],
    });
    expect(r.valido).toBe(true);
  });

  // Encostar é sobrepor: terminar no mesmo dia que outra começa é conflito.
  it("trata borda coincidente como sobreposição", () => {
    const r = validarSolicitacao({
      ...ok,
      ocupados: [{ dataInicio: "2026-08-17", dataFim: "2026-08-20" }],
    });
    expect(r.valido).toBe(false);
  });
});

describe("diffEmDias", () => {
  it("ignora hora do dia", () => {
    expect(diffEmDias(new Date("2026-08-01T23:00:00"), new Date("2026-08-02T01:00:00"))).toBe(1);
  });

  it("é zero no mesmo dia", () => {
    expect(diffEmDias(d("2026-08-01"), d("2026-08-01"))).toBe(0);
  });
});
