import {
  acoesDisponiveis, camposFaltantesRegistro, colaboradorLeConteudo, proximoStatus,
  realizacaoValida, validarAcao,
} from "./feedback-desempenho.entity";

const estado = (status: string, exclusaoStatus: string | null = null) => ({ status, exclusaoStatus });

describe("fluxo do RH, na ordem", () => {
  it("percorre as 4 etapas: registro → reunião → ciência → encerrado", () => {
    let s: any = "REGISTRADO";

    expect(validarAcao("agendar_reuniao", "gestor", estado(s))).toBeNull();
    s = proximoStatus("agendar_reuniao", s);
    expect(s).toBe("REUNIAO_AGENDADA");

    expect(validarAcao("registrar_reuniao", "gestor", estado(s))).toBeNull();
    s = proximoStatus("registrar_reuniao", s);
    expect(s).toBe("AGUARDANDO_CIENCIA");

    expect(validarAcao("registrar_ciencia", "colaborador", estado(s))).toBeNull();
    s = proximoStatus("registrar_ciencia", s);
    expect(s).toBe("ENCERRADO");

    expect(acoesDisponiveis("gestor", estado(s))).toEqual(["solicitar_exclusao"]);
    expect(acoesDisponiveis("colaborador", estado(s))).toEqual([]);
  });

  it("não pula etapa: sem reunião agendada não se registra reunião", () => {
    expect(validarAcao("registrar_reuniao", "gestor", estado("REGISTRADO"))).toBe("etapa_errada");
  });

  it("colaborador só dá ciência depois da reunião realizada", () => {
    expect(validarAcao("registrar_ciencia", "colaborador", estado("REUNIAO_AGENDADA"))).toBe("etapa_errada");
    expect(validarAcao("registrar_ciencia", "colaborador", estado("ENCERRADO"))).toBe("etapa_errada");
  });

  it("só o gestor conduz; só o colaborador dá ciência", () => {
    expect(validarAcao("agendar_reuniao", "colaborador", estado("REGISTRADO"))).toBe("papel_nao_permitido");
    expect(validarAcao("registrar_ciencia", "gestor", estado("AGUARDANDO_CIENCIA"))).toBe("papel_nao_permitido");
    expect(validarAcao("agendar_reuniao", "rh", estado("REGISTRADO"))).toBe("papel_nao_permitido");
  });

  it("texto só muda antes da reunião — depois o colaborador já leu", () => {
    expect(validarAcao("editar", "gestor", estado("REGISTRADO"))).toBeNull();
    expect(validarAcao("editar", "gestor", estado("REUNIAO_AGENDADA"))).toBeNull();
    expect(validarAcao("editar", "gestor", estado("AGUARDANDO_CIENCIA"))).toBe("etapa_errada");
    expect(validarAcao("editar", "gestor", estado("ENCERRADO"))).toBe("etapa_errada");
  });

  it("reagendar mantém a etapa", () => {
    expect(validarAcao("reagendar_reuniao", "gestor", estado("REUNIAO_AGENDADA"))).toBeNull();
    expect(proximoStatus("reagendar_reuniao", "REUNIAO_AGENDADA")).toBe("REUNIAO_AGENDADA");
    expect(validarAcao("reagendar_reuniao", "gestor", estado("REGISTRADO"))).toBe("etapa_errada");
  });
});

describe("exclusão com aprovação do RH", () => {
  it("gestor pede em qualquer etapa, inclusive depois de encerrado", () => {
    for (const s of ["REGISTRADO", "REUNIAO_AGENDADA", "AGUARDANDO_CIENCIA", "ENCERRADO"]) {
      expect(validarAcao("solicitar_exclusao", "gestor", estado(s))).toBeNull();
    }
  });

  it("colaborador e RH não pedem exclusão; gestor não decide", () => {
    expect(validarAcao("solicitar_exclusao", "colaborador", estado("ENCERRADO"))).toBe("papel_nao_permitido");
    expect(validarAcao("solicitar_exclusao", "rh", estado("ENCERRADO"))).toBe("papel_nao_permitido");
    expect(validarAcao("decidir_exclusao", "gestor", estado("REGISTRADO", "PENDENTE"))).toBe("papel_nao_permitido");
  });

  it("RH só decide o que está pendente", () => {
    expect(validarAcao("decidir_exclusao", "rh", estado("REGISTRADO", "PENDENTE"))).toBeNull();
    expect(validarAcao("decidir_exclusao", "rh", estado("REGISTRADO"))).toBe("exclusao_nao_pendente");
    expect(validarAcao("decidir_exclusao", "rh", estado("REGISTRADO", "REPROVADA"))).toBe("exclusao_nao_pendente");
  });

  it("pedido pendente para o fluxo inteiro", () => {
    const pendente = estado("AGUARDANDO_CIENCIA", "PENDENTE");
    expect(validarAcao("registrar_ciencia", "colaborador", pendente)).toBe("exclusao_pendente");
    expect(validarAcao("editar", "gestor", estado("REGISTRADO", "PENDENTE"))).toBe("exclusao_pendente");
    expect(validarAcao("solicitar_exclusao", "gestor", pendente)).toBe("exclusao_ja_pendente");
    expect(acoesDisponiveis("gestor", pendente)).toEqual([]);
    expect(acoesDisponiveis("rh", pendente)).toEqual(["decidir_exclusao"]);
  });

  it("depois de reprovada, o fluxo volta a andar e pode-se pedir de novo", () => {
    const reprovada = estado("AGUARDANDO_CIENCIA", "REPROVADA");
    expect(validarAcao("registrar_ciencia", "colaborador", reprovada)).toBeNull();
    expect(validarAcao("solicitar_exclusao", "gestor", reprovada)).toBeNull();
  });
});

describe("leitura e validações", () => {
  it("colaborador lê o conteúdo só depois da reunião", () => {
    expect(colaboradorLeConteudo("REGISTRADO")).toBe(false);
    expect(colaboradorLeConteudo("REUNIAO_AGENDADA")).toBe(false);
    expect(colaboradorLeConteudo("AGUARDANDO_CIENCIA")).toBe(true);
    expect(colaboradorLeConteudo("ENCERRADO")).toBe(true);
  });

  it("pontos fortes e oportunidades são obrigatórios, espaço em branco não conta", () => {
    expect(camposFaltantesRegistro({ pontosFortes: "Entrega", oportunidades: "Prazo" })).toEqual([]);
    expect(camposFaltantesRegistro({ pontosFortes: "  ", oportunidades: null }))
      .toEqual(["pontos fortes", "oportunidades de desenvolvimento"]);
  });

  it("reunião realizada não pode estar no futuro", () => {
    const agora = new Date("2026-09-17T15:00:00Z");
    expect(realizacaoValida(new Date("2026-09-17T14:00:00Z"), agora)).toBe(true);
    expect(realizacaoValida(new Date("2026-09-17T15:04:00Z"), agora)).toBe(true);
    expect(realizacaoValida(new Date("2026-09-18T15:00:00Z"), agora)).toBe(false);
  });
});
