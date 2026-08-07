import {
  calcularPrazos, situacaoPrazo, protocoloTempestivo, estaProrrogada,
  proximaValidade, mesesDeAnos, formatarCodigo, distancias, gravidade,
  contaNoRadar, FOLGA_INTERNA_PADRAO_DIAS,
} from "./obrigacao.entity";

/**
 * Os casos abaixo vieram da planilha real do cliente (sgi.xlsx), não de
 * exemplos inventados: são as linhas que a planilha classificava errado, e a
 * razão de o módulo existir.
 */

const dia = (iso: string) => new Date(`${iso}T00:00:00`);

describe("calcularPrazos", () => {
  it("reproduz a fórmula da planilha: fatal = validade − prazo do órgão", () => {
    // Linha 3 da aba Meio Ambiente: LO 709/2008, validade 31/07/2012, 120 dias.
    const { prazoFatalEm, prazoInternoEm } = calcularPrazos({
      dataValidade: dia("2012-07-31"),
      prazoMinimoDias: 120,
    });
    expect(prazoFatalEm).toEqual(dia("2012-04-02"));
    // E o interno é o fatal menos a folga de 60 — o "−60" que estava embutido
    // na fórmula G = E−F−60.
    expect(prazoInternoEm).toEqual(dia("2012-02-02"));
  });

  it("com prazo mínimo zero, o fatal é a própria validade", () => {
    const { prazoFatalEm, prazoInternoEm } = calcularPrazos({
      dataValidade: dia("2026-12-22"),
      prazoMinimoDias: 0,
    });
    expect(prazoFatalEm).toEqual(dia("2026-12-22"));
    expect(prazoInternoEm).toEqual(dia("2026-10-23"));
  });

  it("a folga da obrigação vence a da categoria, que vence o padrão", () => {
    const base = { dataValidade: dia("2026-12-31"), prazoMinimoDias: 0 };
    expect(calcularPrazos({ ...base }).folgaAplicadaDias).toBe(FOLGA_INTERNA_PADRAO_DIAS);
    expect(calcularPrazos({ ...base, folgaCategoriaDias: 90 }).folgaAplicadaDias).toBe(90);
    expect(calcularPrazos({ ...base, folgaCategoriaDias: 90, folgaInternaDias: 30 }).folgaAplicadaDias).toBe(30);
  });

  it("folga zero é uma escolha válida, não um campo em branco", () => {
    const r = calcularPrazos({ dataValidade: dia("2026-12-31"), folgaInternaDias: 0 });
    expect(r.folgaAplicadaDias).toBe(0);
    expect(r.prazoInternoEm).toEqual(dia("2026-12-31"));
  });

  it("o prazo interno pende do fatal DIGITADO, não do calculado", () => {
    const r = calcularPrazos({
      dataValidade: dia("2026-12-31"),
      prazoMinimoDias: 120,
      prazoFatalManual: dia("2026-06-30"),
      folgaInternaDias: 30,
    });
    expect(r.prazoFatalEm).toEqual(dia("2026-06-30"));
    expect(r.prazoInternoEm).toEqual(dia("2026-05-31"));
    expect(r.manual).toBe(true);
  });

  it("sem validade, não há prazo a calcular", () => {
    const r = calcularPrazos({ dataValidade: null, prazoMinimoDias: 120 });
    expect(r.prazoFatalEm).toBeNull();
    expect(r.prazoInternoEm).toBeNull();
  });
});

describe("protocoloTempestivo", () => {
  it("protocolo dentro do prazo fatal é tempestivo", () => {
    expect(protocoloTempestivo({
      protocoloEm: dia("2026-06-01"), prazoFatalEm: dia("2026-06-30"),
    })).toBe(true);
  });

  it("protocolo no próprio dia do prazo fatal ainda vale", () => {
    expect(protocoloTempestivo({
      protocoloEm: dia("2026-06-30"), prazoFatalEm: dia("2026-06-30"),
    })).toBe(true);
  });

  it("protocolo depois do prazo fatal NÃO é tempestivo", () => {
    // ABIO 960/2018: prazo fatal 30/06/2026, anotado à mão na planilha como
    // "Sem Renovação Automática (Fora do Prazo)".
    expect(protocoloTempestivo({
      protocoloEm: dia("2026-07-15"), prazoFatalEm: dia("2026-06-30"),
    })).toBe(false);
  });

  it("sem protocolo não há tempestividade", () => {
    expect(protocoloTempestivo({ prazoFatalEm: dia("2026-06-30") })).toBe(false);
  });
});

describe("estaProrrogada", () => {
  it("exige regra de renovação automática E protocolo tempestivo", () => {
    const protocolo = { protocoloEm: dia("2026-06-01"), prazoFatalEm: dia("2026-06-30") };
    expect(estaProrrogada({ ...protocolo, renovacaoAutomatica: true })).toBe(true);
    expect(estaProrrogada({ ...protocolo, renovacaoAutomatica: false })).toBe(false);
    expect(estaProrrogada({ renovacaoAutomatica: true })).toBe(false);
  });
});

describe("situacaoPrazo", () => {
  const hoje = dia("2026-08-06");

  it("vigente quando ainda não chegou nem no prazo interno", () => {
    expect(situacaoPrazo({
      dataValidade: dia("2029-04-24"),
      prazoFatalEm: dia("2028-12-25"),
      prazoInternoEm: dia("2028-10-26"),
    }, hoje)).toBe("vigente");
  });

  it("renovação devida quando o prazo interno passou e o fatal não", () => {
    // AVCB da Sede Administrativa: interno 18/06/2026, fatal/validade 17/08/2026.
    // Na planilha, o Status dizia "Válida" e a Observação estava VAZIA.
    expect(situacaoPrazo({
      dataValidade: dia("2026-08-17"),
      prazoFatalEm: dia("2026-08-17"),
      prazoInternoEm: dia("2026-06-18"),
    }, hoje)).toBe("renovacao_devida");
  });

  it("prazo fatal vencido quando não dá mais para protocolar a tempo", () => {
    // ABIO 960/2018: validade 29/08/2026, fatal 30/06/2026.
    expect(situacaoPrazo({
      dataValidade: dia("2026-08-29"),
      prazoFatalEm: dia("2026-06-30"),
      prazoInternoEm: dia("2026-05-01"),
    }, hoje)).toBe("prazo_fatal_vencido");
  });

  it("vencida quando a validade passou sem protocolo", () => {
    expect(situacaoPrazo({ dataValidade: dia("2026-08-05") }, hoje)).toBe("vencida");
  });

  it("prorrogada: vencida no papel, regular por protocolo tempestivo", () => {
    // LO 709/2008 — validade em 2012, e a planilha a mantém "Válida -
    // Renovação Automática" até hoje. Sem este caso, o painel acusaria
    // vencimento permanente e o alerta viraria ruído.
    expect(situacaoPrazo({
      dataValidade: dia("2012-07-31"),
      prazoFatalEm: dia("2012-04-02"),
      renovacaoAutomatica: true,
      protocoloEm: dia("2012-03-01"),
    }, hoje)).toBe("prorrogada");
  });

  it("renovação automática com protocolo ATRASADO continua vencida", () => {
    expect(situacaoPrazo({
      dataValidade: dia("2012-07-31"),
      prazoFatalEm: dia("2012-04-02"),
      renovacaoAutomatica: true,
      protocoloEm: dia("2012-07-30"),
    }, hoje)).toBe("vencida");
  });

  it("renovação automática sem protocolo nenhum continua vencida", () => {
    // O caso perigoso: a flag ligada não pode, sozinha, silenciar o alerta.
    expect(situacaoPrazo({
      dataValidade: dia("2012-07-31"),
      renovacaoAutomatica: true,
    }, hoje)).toBe("vencida");
  });

  it("vence hoje ainda é válida — o dia inteiro conta", () => {
    expect(situacaoPrazo({
      dataValidade: hoje, prazoFatalEm: hoje, prazoInternoEm: hoje,
    }, hoje)).toBe("vigente");
  });

  it("sem validade não há o que classificar", () => {
    expect(situacaoPrazo({ dataValidade: null }, hoje)).toBe("sem_validade");
  });
});

describe("distancias", () => {
  it("conta dias restantes e negativos para marcos passados", () => {
    const d = distancias({
      dataValidade: dia("2026-08-17"),
      prazoFatalEm: dia("2026-08-17"),
      prazoInternoEm: dia("2026-06-18"),
    }, dia("2026-08-06"));
    expect(d.diasParaValidade).toBe(11);
    expect(d.diasParaPrazoFatal).toBe(11);
    expect(d.diasParaPrazoInterno).toBe(-49);
  });
});

describe("proximaValidade", () => {
  it("soma meses de calendário, não 365 dias", () => {
    expect(proximaValidade(dia("2025-09-30"), 36)).toEqual(dia("2028-09-30"));
  });

  it("recua para o último dia quando o dia não existe no mês de destino", () => {
    // 31/01 + 1 mês transbordaria para 03/03; um prazo administrativo termina
    // no último dia de fevereiro.
    expect(proximaValidade(dia("2026-01-31"), 1)).toEqual(dia("2026-02-28"));
  });

  it("sem periodicidade não há sugestão", () => {
    expect(proximaValidade(dia("2026-01-01"), null)).toBeNull();
    expect(proximaValidade(dia("2026-01-01"), 0)).toBeNull();
  });
});

describe("auxiliares", () => {
  it("converte os anos da planilha em meses", () => {
    expect(mesesDeAnos(3)).toBe(36);
    expect(mesesDeAnos(null)).toBeNull();
  });

  it("formata o código sequencial legível", () => {
    expect(formatarCodigo(1)).toBe("OBR-0001");
    expect(formatarCodigo(1234)).toBe("OBR-1234");
  });

  it("ordena a gravidade do tranquilo ao crítico", () => {
    expect(gravidade("vigente")).toBeLessThan(gravidade("renovacao_devida"));
    expect(gravidade("renovacao_devida")).toBeLessThan(gravidade("prazo_fatal_vencido"));
    expect(gravidade("prazo_fatal_vencido")).toBeLessThan(gravidade("vencida"));
    // Prorrogada é mais tranquila que vigente: já foi resolvida.
    expect(gravidade("prorrogada")).toBeLessThan(gravidade("vigente"));
  });

  it("tira do radar o que foi cancelado ou arquivado", () => {
    expect(contaNoRadar("ativa")).toBe(true);
    expect(contaNoRadar("em_renovacao")).toBe(true);
    expect(contaNoRadar("cancelada")).toBe(false);
    expect(contaNoRadar("arquivada")).toBe(false);
  });
});
