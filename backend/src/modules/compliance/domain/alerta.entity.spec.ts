import {
  marcoVigente, dataBaseDe, degrauEscalonamento, renderizarTemplate,
  mensagemPadrao, chaveEnvio, BASE_DATA,
} from "./alerta.entity";

const dia = (iso: string) => new Date(`${iso}T00:00:00`);

const REGUA = [180, 120, 90, 60, 30, 15, 10, 7, 5, 3, 1, 0];
const DEPOIS = [1, 3, 7, 15, 30];

describe("marcoVigente", () => {
  it("dispara no dia exato do marco", () => {
    expect(marcoVigente(30, REGUA, DEPOIS)).toEqual({ id: "antes:30", tipo: "antes", dias: 30 });
  });

  it("entre dois marcos, vale o mais recentemente cruzado", () => {
    // Faltam 100 dias: já cruzamos 180 e 120; o que vale é 120.
    expect(marcoVigente(100, REGUA, DEPOIS)?.id).toBe("antes:120");
  });

  it("não dispara nada antes do primeiro marco", () => {
    expect(marcoVigente(365, REGUA, DEPOIS)).toBeNull();
  });

  it("recupera o marco perdido quando a varredura ficou dias fora do ar", () => {
    // A varredura não rodou nos dias 30, 29 e 28. No dia 27 ela volta e ainda
    // dispara o marco de 30 — uma vez só, não três.
    expect(marcoVigente(27, REGUA, DEPOIS)?.id).toBe("antes:30");
  });

  it("o dia do vencimento tem marco próprio", () => {
    expect(marcoVigente(0, REGUA, DEPOIS)?.id).toBe("antes:0");
  });

  it("depois de vencer, a cobrança sobe de degrau", () => {
    expect(marcoVigente(-1, REGUA, DEPOIS)?.id).toBe("depois:1");
    expect(marcoVigente(-5, REGUA, DEPOIS)?.id).toBe("depois:3");
    expect(marcoVigente(-45, REGUA, DEPOIS)?.id).toBe("depois:30");
  });

  it("réguas vazias não disparam nada", () => {
    expect(marcoVigente(10, [], [])).toBeNull();
    expect(marcoVigente(-10, [], [])).toBeNull();
  });
});

describe("dataBaseDe", () => {
  const obrigacao = {
    dataValidade: dia("2026-08-17"),
    prazoFatalEm: dia("2026-08-17"),
    prazoInternoEm: dia("2026-06-18"),
  };

  it("escolhe a data que a régua pede", () => {
    expect(dataBaseDe(BASE_DATA.VALIDADE, obrigacao)).toEqual(obrigacao.dataValidade);
    expect(dataBaseDe(BASE_DATA.PRAZO_FATAL, obrigacao)).toEqual(obrigacao.prazoFatalEm);
    expect(dataBaseDe(BASE_DATA.PRAZO_INTERNO, obrigacao)).toEqual(obrigacao.prazoInternoEm);
  });

  it("cai para a validade quando a obrigação não tem prazos calculados", () => {
    const so = { dataValidade: dia("2026-08-17"), prazoFatalEm: null, prazoInternoEm: null };
    expect(dataBaseDe(BASE_DATA.PRAZO_INTERNO, so)).toEqual(so.dataValidade);
  });
});

describe("degrauEscalonamento", () => {
  const degraus = [
    { aposDias: 3, ordem: 0, alvo: "gestor" },
    { aposDias: 7, ordem: 1, alvo: "gerente" },
    { aposDias: 15, ordem: 2, alvo: "diretor" },
  ];

  it("sobe até o degrau mais alto já cruzado", () => {
    expect(degrauEscalonamento(degraus, 20)?.alvo).toBe("diretor");
    expect(degrauEscalonamento(degraus, 8)?.alvo).toBe("gerente");
    expect(degrauEscalonamento(degraus, 3)?.alvo).toBe("gestor");
  });

  it("não escala antes do primeiro degrau nem sem atraso", () => {
    expect(degrauEscalonamento(degraus, 2)).toBeNull();
    expect(degrauEscalonamento(degraus, 0)).toBeNull();
    expect(degrauEscalonamento(degraus, -5)).toBeNull();
  });
});

describe("renderizarTemplate", () => {
  const ctx = {
    nomeObrigacao: "Licença de Operação",
    codigo: "OBR-0001",
    categoria: "Meio Ambiente",
    responsavel: "Wilson",
    dataValidade: dia("2027-04-05"),
    dias: 30,
    situacao: "renovacao_devida",
    campos: { numero_do_processo: "709/2008" },
  };

  it("substitui o exemplo da especificação", () => {
    const texto = renderizarTemplate(
      "Olá {{Responsavel}}, a obrigação {{NomeObrigacao}} vence em {{Dias}} dias. Validade: {{DataValidade}}",
      ctx,
    );
    expect(texto).toBe(
      "Olá Wilson, a obrigação Licença de Operação vence em 30 dias. Validade: 05/04/2027",
    );
  });

  it("ignora acento e caixa no nome do marcador", () => {
    expect(renderizarTemplate("{{responsável}} / {{RESPONSAVEL}}", ctx)).toBe("Wilson / Wilson");
  });

  it("alcança os campos personalizados", () => {
    expect(renderizarTemplate("Processo {{campo.numero_do_processo}}", ctx))
      .toBe("Processo 709/2008");
  });

  it("mantém literal o marcador desconhecido, para o autor ver o erro", () => {
    expect(renderizarTemplate("{{NaoExiste}}", ctx)).toBe("{{NaoExiste}}");
  });
});

describe("mensagemPadrao", () => {
  const base = {
    nomeObrigacao: "AVCB Sede", codigo: "OBR-0019", categoria: "Segurança do Trabalho",
    responsavel: "Carlos", situacao: "renovacao_devida",
    dataValidade: dia("2026-08-17"), prazoFatal: dia("2026-08-17"), unidade: "Sede Administrativa",
  };

  it("fala em dias restantes quando ainda dá tempo", () => {
    const m = mensagemPadrao({ ...base, dias: 11 });
    expect(m.titulo).toBe("Obrigação a vencer: AVCB Sede");
    expect(m.corpo).toContain("vence em 11 dias");
    expect(m.corpo).toContain("Prazo fatal para protocolar: 17/08/2026");
  });

  it("fala em dias de atraso quando já venceu", () => {
    const m = mensagemPadrao({ ...base, dias: -3 });
    expect(m.titulo).toBe("Obrigação vencida: AVCB Sede");
    expect(m.corpo).toContain("venceu há 3 dias");
  });

  it("trata o dia do vencimento à parte", () => {
    expect(mensagemPadrao({ ...base, dias: 0 }).corpo).toContain("vence hoje");
  });

  it("usa singular com um dia só", () => {
    expect(mensagemPadrao({ ...base, dias: 1 }).corpo).toContain("vence em 1 dia.");
  });
});

describe("chaveEnvio", () => {
  it("separa o mesmo marco por canal e por destino", () => {
    expect(chaveEnvio("o1", "antes:30", "email", "A@x.com"))
      .not.toBe(chaveEnvio("o1", "antes:30", "whatsapp", "A@x.com"));
    expect(chaveEnvio("o1", "antes:30", "email", "a@x.com"))
      .toBe(chaveEnvio("o1", "antes:30", "email", "A@X.COM"));
  });
});
