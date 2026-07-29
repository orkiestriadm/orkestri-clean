import {
  TRAINING_STATUS, REVIEW_STATUS, podeTransicionar, calcularValidade,
  situacaoCertificacao, validarAvaliacao, progressoPonderado, cicloValido,
  diasEntre, NOTA_MAXIMA,
} from "./development.entity";

const d = (iso: string) => new Date(`${iso}T00:00:00`);

describe("ciclo de vida do treinamento", () => {
  it("planejado pode começar", () => {
    expect(podeTransicionar(TRAINING_STATUS.PLANEJADO, TRAINING_STATUS.EM_ANDAMENTO)).toBe(true);
  });

  // Curso de meio dia é registrado direto como concluído.
  it("planejado pode ir direto a concluído", () => {
    expect(podeTransicionar(TRAINING_STATUS.PLANEJADO, TRAINING_STATUS.CONCLUIDO)).toBe(true);
  });

  // Reabrir apagaria a validade do certificado já emitido.
  it("concluído é final", () => {
    expect(podeTransicionar(TRAINING_STATUS.CONCLUIDO, TRAINING_STATUS.EM_ANDAMENTO)).toBe(false);
    expect(podeTransicionar(TRAINING_STATUS.CONCLUIDO, TRAINING_STATUS.CANCELADO)).toBe(false);
  });

  it("cancelado é final", () => {
    expect(podeTransicionar(TRAINING_STATUS.CANCELADO, TRAINING_STATUS.PLANEJADO)).toBe(false);
  });

  it("em andamento não volta a planejado", () => {
    expect(podeTransicionar(TRAINING_STATUS.EM_ANDAMENTO, TRAINING_STATUS.PLANEJADO)).toBe(false);
  });
});

describe("validade do certificado", () => {
  it("soma os meses de validade à conclusão", () => {
    expect(calcularValidade(d("2026-03-10"), 24)).toEqual(d("2028-03-10"));
  });

  it("curso sem validade não gera vencimento", () => {
    expect(calcularValidade(d("2026-03-10"), null)).toBeNull();
  });

  it("validade zero equivale a não expirar", () => {
    expect(calcularValidade(d("2026-03-10"), 0)).toBeNull();
  });

  // 31/jan + 1 mês não pode virar 3/mar.
  it("não transborda em mês curto", () => {
    expect(calcularValidade(d("2026-01-31"), 1)).toEqual(d("2026-02-28"));
  });
});

describe("situação da certificação", () => {
  const hoje = d("2026-07-29");

  it("sem validade não tem situação de vencimento", () => {
    expect(situacaoCertificacao(null, hoje)).toBe("sem_validade");
  });

  it("é vigente quando falta muito", () => {
    expect(situacaoCertificacao(d("2027-01-01"), hoje)).toBe("vigente");
  });

  it("avisa dentro da janela de 60 dias", () => {
    expect(situacaoCertificacao(d("2026-09-01"), hoje)).toBe("vence_em_breve");
  });

  it("é vencida depois da data", () => {
    expect(situacaoCertificacao(d("2026-07-01"), hoje)).toBe("vencida");
  });

  // Vencer hoje ainda vale hoje.
  it("no próprio dia ainda não venceu", () => {
    expect(situacaoCertificacao(hoje, hoje)).toBe("vence_em_breve");
  });
});

describe("validação da avaliação", () => {
  it("aceita ciclo e nota válidos", () => {
    expect(validarAvaliacao({ ciclo: "2026.1", nota: 4 }).valido).toBe(true);
  });

  it("aceita ciclo só com o ano", () => {
    expect(cicloValido("2026")).toBe(true);
  });

  it("recusa ciclo fora do formato", () => {
    const r = validarAvaliacao({ ciclo: "primeiro semestre" });
    expect(r.valido).toBe(false);
    expect(r.motivo).toBe("ciclo_invalido");
  });

  it("recusa semestre inexistente", () => {
    expect(cicloValido("2026.3")).toBe(false);
  });

  it("recusa nota fora da escala", () => {
    const r = validarAvaliacao({ ciclo: "2026", nota: NOTA_MAXIMA + 1 });
    expect(r.valido).toBe(false);
    expect(r.motivo).toBe("nota_fora_da_escala");
  });

  // Editar avaliação finalizada reescreveria o que o colaborador já viu.
  it("recusa alterar avaliação já finalizada", () => {
    const r = validarAvaliacao({ ciclo: "2026", statusAtual: REVIEW_STATUS.FINALIZADA });
    expect(r.valido).toBe(false);
    expect(r.motivo).toBe("ja_finalizada");
  });

  it("recusa finalizar sem nota", () => {
    const r = validarAvaliacao({ ciclo: "2026", nota: null, finalizando: true });
    expect(r.valido).toBe(false);
    expect(r.motivo).toBe("sem_nota");
  });

  it("permite salvar rascunho sem nota", () => {
    expect(validarAvaliacao({ ciclo: "2026", nota: null }).valido).toBe(true);
  });

  it("recusa o avaliado como próprio avaliador", () => {
    const r = validarAvaliacao({ ciclo: "2026", colaboradorId: "abc", avaliadorId: "abc" });
    expect(r.valido).toBe(false);
    expect(r.motivo).toBe("auto_avaliacao");
  });

  it("aceita avaliador diferente do avaliado", () => {
    expect(validarAvaliacao({ ciclo: "2026", colaboradorId: "abc", avaliadorId: "xyz" }).valido).toBe(true);
  });
});

describe("progresso ponderado das metas", () => {
  // Média simples daria 50; o peso 5 puxa o número para a meta que importa.
  it("pondera pelo peso", () => {
    expect(progressoPonderado([
      { peso: 5, progresso: 100 },
      { peso: 1, progresso: 0 },
    ])).toBe(83);
  });

  it("é zero sem metas", () => {
    expect(progressoPonderado([])).toBe(0);
  });

  it("não estoura acima de 100", () => {
    expect(progressoPonderado([{ peso: 1, progresso: 300 }])).toBe(100);
  });

  it("trata progresso negativo como zero", () => {
    expect(progressoPonderado([{ peso: 1, progresso: -20 }])).toBe(0);
  });

  // Peso zero em todas as metas não pode dividir por zero.
  it("não divide por zero quando todo peso é zero", () => {
    expect(progressoPonderado([{ peso: 0, progresso: 80 }])).toBe(0);
  });
});

describe("diasEntre", () => {
  it("ignora hora do dia", () => {
    expect(diasEntre(new Date("2026-08-01T23:00:00"), new Date("2026-08-02T01:00:00"))).toBe(1);
  });

  it("é negativo para data passada", () => {
    expect(diasEntre(d("2026-08-10"), d("2026-08-01"))).toBe(-9);
  });
});
