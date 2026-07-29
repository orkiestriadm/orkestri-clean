import {
  salarioVigente, variacaoPercentual, historicoComVariacao, posicaoNaFaixa,
  percentualNaFaixa, faixaValida, validarMudanca, mesesDesde, motivoValido,
} from "./salary.entity";

const d = (iso: string) => new Date(`${iso}T00:00:00`);
const r = (valor: number, iso: string, motivo = "merito") =>
  ({ valor, vigenciaInicio: d(iso), motivo });

describe("salário vigente", () => {
  const hoje = d("2026-07-29");

  it("pega o mais recente já vigente", () => {
    const h = [r(5000, "2024-01-01", "admissao"), r(6000, "2025-06-01"), r(7000, "2026-03-01")];
    expect(salarioVigente(h, hoje)?.valor).toBe(7000);
  });

  // Aumento combinado e lançado antes de valer não pode subir o custo hoje.
  it("ignora vigência futura", () => {
    const h = [r(7000, "2026-03-01"), r(9000, "2026-12-01")];
    expect(salarioVigente(h, hoje)?.valor).toBe(7000);
  });

  it("vigência que começa hoje já vale", () => {
    expect(salarioVigente([r(8000, "2026-07-29")], hoje)?.valor).toBe(8000);
  });

  it("devolve null sem histórico", () => {
    expect(salarioVigente([], hoje)).toBeNull();
  });

  it("devolve null quando tudo é futuro", () => {
    expect(salarioVigente([r(9000, "2027-01-01")], hoje)).toBeNull();
  });
});

describe("variação percentual", () => {
  it("calcula o aumento", () => {
    expect(variacaoPercentual(5000, 6000)).toBe(20);
  });

  it("calcula a redução", () => {
    expect(variacaoPercentual(6000, 5400)).toBe(-10);
  });

  it("arredonda para uma casa", () => {
    expect(variacaoPercentual(3000, 3100)).toBe(3.3);
  });

  // "0%" e "primeiro salário" são coisas diferentes na tela.
  it("é null sem base de comparação", () => {
    expect(variacaoPercentual(null, 5000)).toBeNull();
  });

  it("é null quando a base é zero", () => {
    expect(variacaoPercentual(0, 5000)).toBeNull();
  });
});

describe("histórico com variação", () => {
  it("ordena do mais recente e calcula cada variação", () => {
    const h = historicoComVariacao([
      r(5000, "2024-01-01", "admissao"),
      r(7000, "2026-03-01", "promocao"),
      r(6000, "2025-06-01"),
    ]);
    expect(h.map(x => x.valor)).toEqual([7000, 6000, 5000]);
    expect(h[0].variacaoPercentual).toBeCloseTo(16.7, 1);
    expect(h[1].variacaoPercentual).toBe(20);
    // A admissão não tem antes — nada a comparar.
    expect(h[2].variacaoPercentual).toBeNull();
  });

  it("aguenta histórico de um registro só", () => {
    const h = historicoComVariacao([r(5000, "2024-01-01", "admissao")]);
    expect(h[0].variacaoPercentual).toBeNull();
  });
});

describe("posição na faixa", () => {
  const faixa = { minimo: 5000, medio: 7000, maximo: 9000 };

  it("acusa abaixo do mínimo", () => {
    expect(posicaoNaFaixa(4500, faixa)).toBe("abaixo");
  });

  it("acusa acima do máximo", () => {
    expect(posicaoNaFaixa(9500, faixa)).toBe("acima");
  });

  it("dentro inclui as bordas", () => {
    expect(posicaoNaFaixa(5000, faixa)).toBe("dentro");
    expect(posicaoNaFaixa(9000, faixa)).toBe("dentro");
  });

  it("sem faixa não classifica", () => {
    expect(posicaoNaFaixa(7000, { minimo: null, medio: null, maximo: null })).toBe("sem_faixa");
  });

  it("faixa só com mínimo ainda acusa abaixo", () => {
    expect(posicaoNaFaixa(4000, { minimo: 5000, medio: null, maximo: null })).toBe("abaixo");
  });
});

describe("percentual na faixa", () => {
  const faixa = { minimo: 5000, medio: 7000, maximo: 9000 };

  it("meio da faixa é 50%", () => {
    expect(percentualNaFaixa(7000, faixa)).toBe(50);
  });

  it("no mínimo é 0 e no máximo é 100", () => {
    expect(percentualNaFaixa(5000, faixa)).toBe(0);
    expect(percentualNaFaixa(9000, faixa)).toBe(100);
  });

  it("não passa de 100 nem cai abaixo de 0", () => {
    expect(percentualNaFaixa(12000, faixa)).toBe(100);
    expect(percentualNaFaixa(1000, faixa)).toBe(0);
  });

  // Sem os dois extremos não há posição — inventar seria precisão falsa.
  it("é null com faixa incompleta", () => {
    expect(percentualNaFaixa(7000, { minimo: 5000, medio: null, maximo: null })).toBeNull();
  });

  it("é null quando máximo não é maior que mínimo", () => {
    expect(percentualNaFaixa(5000, { minimo: 5000, medio: null, maximo: 5000 })).toBeNull();
  });
});

describe("faixa válida", () => {
  it("aceita faixa coerente", () => {
    expect(faixaValida({ minimo: 5000, medio: 7000, maximo: 9000 })).toBe(true);
  });

  it("recusa mínimo acima do máximo", () => {
    expect(faixaValida({ minimo: 9000, medio: null, maximo: 5000 })).toBe(false);
  });

  it("recusa médio fora do intervalo", () => {
    expect(faixaValida({ minimo: 5000, medio: 12000, maximo: 9000 })).toBe(false);
  });

  it("aceita faixa vazia — cargo sem faixa definida é legítimo", () => {
    expect(faixaValida({ minimo: null, medio: null, maximo: null })).toBe(true);
  });
});

describe("validação da mudança", () => {
  const historico = [r(5000, "2024-01-01", "admissao"), r(6000, "2025-06-01")];

  it("aceita aumento normal", () => {
    const v = validarMudanca({ valor: 7000, vigenciaInicio: d("2026-07-01"), motivo: "merito", historico });
    expect(v.valido).toBe(true);
  });

  it("recusa valor zero ou negativo", () => {
    expect(validarMudanca({ valor: 0, vigenciaInicio: d("2026-07-01"), motivo: "merito" }).motivo)
      .toBe("valor_invalido");
  });

  it("recusa motivo inventado", () => {
    expect(validarMudanca({ valor: 7000, vigenciaInicio: d("2026-07-01"), motivo: "porque_sim" }).motivo)
      .toBe("motivo_desconhecido");
  });

  it("recusa duas mudanças na mesma data", () => {
    const v = validarMudanca({ valor: 7000, vigenciaInicio: d("2025-06-01"), motivo: "merito", historico });
    expect(v.motivo).toBe("vigencia_duplicada");
  });

  // Redução tem restrição legal: o sistema não julga, mas exige rastro.
  it("recusa redução disfarçada de mérito", () => {
    const v = validarMudanca({ valor: 5500, vigenciaInicio: d("2026-07-01"), motivo: "merito", historico });
    expect(v.motivo).toBe("reducao_sem_motivo");
    expect(v.detalhe).toContain("Redução");
  });

  it("aceita redução quando declarada", () => {
    const v = validarMudanca({ valor: 5500, vigenciaInicio: d("2026-07-01"), motivo: "reducao", historico });
    expect(v.valido).toBe(true);
  });

  it("primeiro registro não compara com nada", () => {
    expect(validarMudanca({ valor: 3000, vigenciaInicio: d("2026-01-01"), motivo: "admissao" }).valido)
      .toBe(true);
  });
});

describe("mesesDesde", () => {
  it("conta meses completos", () => {
    expect(mesesDesde(d("2025-01-15"), d("2026-07-29"))).toBe(18);
  });

  it("não conta mês incompleto", () => {
    expect(mesesDesde(d("2026-01-20"), d("2026-07-15"))).toBe(5);
  });

  it("nunca é negativo", () => {
    expect(mesesDesde(d("2027-01-01"), d("2026-07-29"))).toBe(0);
  });
});

describe("motivos", () => {
  it("aceita os do catálogo", () => {
    expect(motivoValido("promocao")).toBe(true);
  });

  it("recusa fora do catálogo", () => {
    expect(motivoValido("aumento_camarada")).toBe(false);
  });
});
