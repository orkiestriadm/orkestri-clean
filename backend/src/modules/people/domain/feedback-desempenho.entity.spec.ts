import {
  acoesDisponiveis, camposFaltantesRegistro, colaboradorLeConteudo, consolidarPorGestor,
  diasDeEspera, proximoStatus, realizacaoValida, resumoDoPeriodo, validarAcao,
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

describe("acompanhamento do RH", () => {
  const gestores = [
    { id: "ana", nome: "Ana", liderados: 4 },
    { id: "bruno", nome: "Bruno", liderados: 2 },
    { id: "carla", nome: "Carla", liderados: 3 },
  ];
  const fb = (gestorId: string, collaboratorId: string, status: string, reuniao = true, ciencia = false) =>
    ({ gestorId, collaboratorId, status, temReuniaoRealizada: reuniao, temCiencia: ciencia });

  const feedbacks = [
    fb("ana", "c1", "ENCERRADO", true, true),
    fb("ana", "c2", "AGUARDANDO_CIENCIA", true, false),
    // Dois registros da mesma pessoa contam uma vez na cobertura.
    fb("ana", "c2", "ENCERRADO", true, true),
    fb("bruno", "c9", "REGISTRADO", false, false),
  ];

  it("gestor que não registrou nada aparece na lista, com cobertura zero", () => {
    const linhas = consolidarPorGestor(gestores, feedbacks);
    const carla = linhas.find(l => l.id === "carla")!;
    expect(carla.registrados).toBe(0);
    expect(carla.cobertura).toBe(0);
  });

  it("cobertura conta pessoas alcançadas, não registros", () => {
    const ana = consolidarPorGestor(gestores, feedbacks).find(l => l.id === "ana")!;
    expect(ana.registrados).toBe(3);
    expect(ana.colaboradoresAtingidos).toBe(2);
    expect(ana.cobertura).toBe(50); // 2 de 4 liderados
    expect(ana.cienciaDada).toBe(2);
    expect(ana.reuniaoRealizada).toBe(3);
  });

  // Ana e Bruno empatam em 50% de cobertura; Ana vem antes porque a equipe dela
  // é maior — mesma proporção, mais gente sem feedback.
  it("ordena pela menor cobertura e, no empate, pela equipe maior", () => {
    expect(consolidarPorGestor(gestores, feedbacks).map(l => l.id)).toEqual(["carla", "ana", "bruno"]);
  });

  it("o retorno só considera quem já podia dar ciência", () => {
    const linhas = consolidarPorGestor(gestores, feedbacks);
    const r = resumoDoPeriodo(feedbacks, linhas);
    expect(r.registrados).toBe(4);
    // O de Bruno ainda não teve reunião: entra em "aguardando reunião" e fica
    // fora da conta de retorno.
    expect(r.aguardandoReuniao).toBe(1);
    expect(r.aguardandoCiencia).toBe(1);
    expect(r.encerrados).toBe(2);
    expect(r.percentualRetorno).toBe(67);
    expect(r.gestoresSemRegistro).toBe(1);
  });

  it("sem feedback nenhum, os indicadores são zero e não NaN", () => {
    const linhas = consolidarPorGestor(gestores, []);
    const r = resumoDoPeriodo([], linhas);
    expect(r.percentualRetorno).toBe(0);
    expect(r.gestoresSemRegistro).toBe(3);
    expect(linhas.every(l => l.cobertura === 0)).toBe(true);
  });

  it("dias de espera não ficam negativos com data futura", () => {
    const agora = new Date("2026-09-17T12:00:00Z");
    expect(diasDeEspera(new Date("2026-09-10T12:00:00Z"), agora)).toBe(7);
    expect(diasDeEspera(new Date("2026-09-18T12:00:00Z"), agora)).toBe(0);
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
