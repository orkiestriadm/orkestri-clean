jest.mock("nodemailer", () => ({}), { virtual: true });
import "reflect-metadata";
import { CadastroWhatsappService } from "./cadastro-whatsapp.module";
import { WhatsappInboundService } from "../agenda/whatsapp-inbound.module";
import {
  comandoCadastroGeral,
  consultarNumeroCadastro,
  mesmoTelefoneCadastro,
  numeroCadastro,
} from "./whatsapp-entrada";
import { ORIGEM_CONVITE_AGENDA } from "../prospects/lead-onboarding";

const TEL = "5511999991234";
function setup(profiles: any[] = []) {
  const prisma: any = {
    userProfile: {
      findMany: jest.fn(async ({ where }) =>
        where.whatsappLid
          ? profiles.filter((p) => p.whatsappLid === where.whatsappLid)
          : where.NOT
            ? profiles.filter((p) => p.whatsapp)
            : profiles,
      ),
      update: jest.fn(async () => ({})),
    },
    cadastroWhatsapp: {
      findFirst: jest.fn(async () => null),
      count: jest.fn(async () => 0),
      create: jest.fn(async ({ data }) => ({ ...data })),
      update: jest.fn(async () => ({})),
    },
    prospectLead: {
      findUnique: jest.fn(async () => ({ id: "lead-existente" })),
    },
    prospectMessage: { findFirst: jest.fn(async () => null) },
    user: { create: jest.fn() },
  };
  const wa: any = {
    sendToJid: jest.fn(async () => true),
    sendMessage: jest.fn(async () => true),
  };
  const inicio: any = {
    temFluxo: jest.fn(async () => false),
    fluxo: jest.fn(async () => false),
    enviarAcesso: jest.fn(async () => true),
  };
  const cadastro = new CadastroWhatsappService(prisma, wa, inicio);
  const auth: any = { resolvePermissions: jest.fn(async () => ["*"]) };
  const contexto: any = {
    obter: jest.fn(async () => "PESSOAL"),
    mensagem: () => "Contexto pessoal",
  };
  const inbound = new WhatsappInboundService(
    prisma,
    wa,
    auth,
    {} as any,
    cadastro,
    inicio,
    {} as any,
    contexto,
    {} as any,
    { tratar: jest.fn(async () => ({})) } as any,
    { tratar: jest.fn(async () => ({})) } as any,
  );
  const incoming = (text: string, jid = `${TEL}@s.whatsapp.net`, extra = {}) =>
    (inbound as any).processarMensagem({
      instance: "teste",
      data: {
        key: { id: "msg-simulada", remoteJid: jid, fromMe: false, ...extra },
        message: { conversation: text },
      },
    });
  return { prisma, wa, inicio, cadastro, incoming };
}
const profile = (extra: any = {}) => ({
  userId: "conta",
  whatsapp: TEL,
  telefone: null,
  whatsappLid: null,
  user: { id: "conta", ativo: true, bloqueado: false },
  ...extra,
});

describe("Identificação e recepção da Aurélia", () => {
  it("normaliza DDI sem confundir o DDD 55 com o país", () => {
    expect(numeroCadastro("(55) 99999-1234")).toBe("5555999991234");
    expect(numeroCadastro("+55 (11) 99999-1234")).toBe(TEL);
    expect(numeroCadastro("123456789012345@lid")).toBe("");
  });
  it("aceita formatação e nono dígito, sem comparar somente o sufixo", () => {
    expect(mesmoTelefoneCadastro(TEL, "(11) 99999-1234")).toBe(true);
    expect(mesmoTelefoneCadastro(TEL, "551199991234")).toBe(true);
    expect(mesmoTelefoneCadastro(TEL, "5521999991234")).toBe(false);
    expect(mesmoTelefoneCadastro("5511923456789", "551123456789")).toBe(false);
    expect(mesmoTelefoneCadastro("1234", "1234")).toBe(false);
  });
  it("separa cadastro geral do comando legado de teste da agenda", () => {
    expect(comandoCadastroGeral("CADASTRO")).toBe(true);
    expect(comandoCadastroGeral("Quero fazer meu cadastro no Orkiestri")).toBe(
      true,
    );
    expect(comandoCadastroGeral("CADASTRO AGENDA")).toBe(false);
  });
  it("consulta a base antes de orientar um número sem conta", async () => {
    const { incoming, prisma, wa } = setup();
    await incoming("Oi");
    expect(prisma.userProfile.findMany).toHaveBeenCalled();
    expect(wa.sendMessage).toHaveBeenCalledWith(
      TEL,
      // Desde 28/10/2026 quem chega novo recebe o MESMO convite da campanha de
      // leads — é a mensagem que o site promete ao mandar a pessoa para cá.
      expect.stringContaining("Quero me cadastrar e experimentar"),
      "teste",
    );
    expect(wa.sendMessage.mock.calls[0][1]).not.toContain("VINCULAR ABC123");
    expect(prisma.cadastroWhatsapp.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({etapa:'INICIO'})}));
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
  it("mantém o menu de quem já está cadastrado e não abre outra conta", async () => {
    const { incoming, wa, prisma } = setup([
      profile({
        user: {
          id: "conta",
          ativo: true,
          bloqueado: false,
          nome: "Pessoa Teste",
          organizationId: "org",
        },
      }),
    ]);
    await incoming("Oi");
    expect(
      wa.sendMessage.mock.calls.some((call) => call[1].includes("Aurélia")),
    ).toBe(true);
    expect(prisma.cadastroWhatsapp.create).not.toHaveBeenCalled();
  });
  it("trata um novo clique de cadastro de uma conta ativa sem duplicar", async () => {
    const { incoming, wa, prisma } = setup([
      profile({
        user: {
          id: "conta",
          ativo: true,
          nome: "Pessoa",
          organizationId: "org",
        },
      }),
    ]);
    await incoming("CADASTRO");
    expect(wa.sendToJid.mock.calls[0][1]).toContain("já tem cadastro");
    expect(prisma.cadastroWhatsapp.create).not.toHaveBeenCalled();
  });
  it("usa o telefone alternativo do provedor em conversas LID", async () => {
    const { incoming, prisma, wa } = setup();
    await incoming("CADASTRO", "123456789012345@lid", {
      remoteJidAlt: `${TEL}@s.whatsapp.net`,
    });
    expect(prisma.cadastroWhatsapp.create.mock.calls[0][0].data).toMatchObject({
      whatsapp: TEL,
      etapa: "NOME",
    });
    expect(
      JSON.parse(
        prisma.cadastroWhatsapp.create.mock.calls[0][0].data.respostas,
      ),
    ).toEqual({ whatsappLid: "123456789012345" });
    expect(wa.sendMessage.mock.calls[0][1]).toContain(
      "cadastro no *Orkiestri*",
    );
    expect(wa.sendMessage.mock.calls[0][1]).not.toContain("teste da");
  });
  it("não fabrica telefone a partir do LID", async () => {
    const { incoming, prisma, wa } = setup();
    await incoming("CADASTRO", "123456789012345@lid");
    expect(prisma.cadastroWhatsapp.create).not.toHaveBeenCalled();
    expect(wa.sendToJid.mock.calls[0][1]).toContain("confirmar seu telefone");
  });
  it("não transforma a presença na lista de leads em teste obrigatório", async () => {
    const { cadastro, prisma, wa } = setup();
    await cadastro.iniciarPeloChat(TEL, "teste", "CADASTRO");
    expect(
      JSON.parse(
        prisma.cadastroWhatsapp.create.mock.calls[0][0].data.respostas,
      ),
    ).not.toHaveProperty("origem");
    expect(wa.sendMessage.mock.calls[0][1]).toContain("nome completo");
    expect(wa.sendMessage.mock.calls[0][1]).not.toContain("7 dias");
  });
  it("preserva o teste quando ele foi solicitado explicitamente", async () => {
    const { cadastro, prisma, wa } = setup();
    await cadastro.iniciarPeloChat(TEL, "teste", "CADASTRO AGENDA");
    expect(
      JSON.parse(
        prisma.cadastroWhatsapp.create.mock.calls[0][0].data.respostas,
      ),
    ).toHaveProperty("origem", ORIGEM_CONVITE_AGENDA);
    expect(wa.sendMessage.mock.calls[0][1]).toContain("gratuitos");
    expect(wa.sendMessage.mock.calls[0][1]).not.toContain("7 dias");
  });
  it("retoma o cadastro geral sem usar o comando como nome nem apagar dados", async () => {
    const { cadastro, prisma, wa } = setup();
    await cadastro.tratarResposta(
      {
        id: "pendente",
        whatsapp: TEL,
        etapa: "EMAIL",
        nome: "Pessoa Teste",
        cpf: "52998224725",
        respostas: JSON.stringify({
          origem: ORIGEM_CONVITE_AGENDA,
          whatsappLid: "123",
          empresa: "Pessoal",
        }),
        expiraEm: new Date(Date.now() + 60000),
      },
      "CADASTRO",
      "teste",
    );
    expect(
      JSON.parse(
        prisma.cadastroWhatsapp.update.mock.calls[0][0].data.respostas,
      ),
    ).toEqual({ whatsappLid: "123", empresa: "Pessoal" });
    expect(prisma.cadastroWhatsapp.create).not.toHaveBeenCalled();
    expect(wa.sendMessage.mock.calls[0][1]).toContain("e-mail");
  });
  it("um telefone de contato não concede vínculo automático", async () => {
    const { cadastro, prisma, wa } = setup([
      profile({ whatsapp: null, telefone: "(11) 99999-1234" }),
    ]);
    await cadastro.iniciarPeloChat(TEL, "teste", "CADASTRO");
    expect(wa.sendMessage.mock.calls[0][1]).toContain("VINCULAR");
    expect(prisma.userProfile.update).not.toHaveBeenCalled();
    expect(prisma.cadastroWhatsapp.create).not.toHaveBeenCalled();
  });
  it("reabre um cadastro expirado em um único pedido explícito", async () => {
    const { cadastro, prisma, wa } = setup();
    await cadastro.tratarResposta(
      {
        id: "expirado",
        whatsapp: TEL,
        etapa: "NOME",
        respostas: "{}",
        expiraEm: new Date(0),
      },
      "CADASTRO",
      "teste",
    );
    expect(prisma.cadastroWhatsapp.update).toHaveBeenCalledWith({
      where: { id: "expirado" },
      data: { status: "EXPIRADO" },
    });
    expect(prisma.cadastroWhatsapp.create).toHaveBeenCalledTimes(1);
    expect(wa.sendMessage).toHaveBeenCalledTimes(1);
    expect(wa.sendMessage.mock.calls[0][1]).toContain("nome completo");
  });
  it("não grava um clique no link antigo como nome da pessoa", async () => {
    const { cadastro, prisma, wa } = setup();
    await cadastro.tratarResposta(
      {
        id: "pendente",
        whatsapp: TEL,
        etapa: "NOME",
        respostas: "{}",
        expiraEm: new Date(Date.now() + 60000),
      },
      "CADASTRO AGENDA",
      "teste",
    );
    expect(
      prisma.cadastroWhatsapp.update.mock.calls[0][0].data,
    ).not.toHaveProperty("nome");
    expect(
      JSON.parse(
        prisma.cadastroWhatsapp.update.mock.calls[0][0].data.respostas,
      ),
    ).toHaveProperty("origem", ORIGEM_CONVITE_AGENDA);
    expect(wa.sendMessage.mock.calls[0][1]).toContain("nome completo");
  });
  it("mantém o limite de tentativas, mas explica por que não iniciou", async () => {
    const { cadastro, prisma, wa } = setup();
    prisma.cadastroWhatsapp.count.mockResolvedValue(3);
    await cadastro.iniciarPeloChat(TEL, "teste", "CADASTRO");
    expect(prisma.cadastroWhatsapp.create).not.toHaveBeenCalled();
    expect(wa.sendMessage.mock.calls[0][1]).toContain("mais tarde");
  });
  it("recusa criar outra conta para números ambíguos ou bloqueados", async () => {
    for (const profiles of [
      [profile(), profile({ userId: "outra" })],
      [profile({ user: { id: "conta", ativo: true, bloqueado: true } })],
    ]) {
      const { cadastro, prisma, wa } = setup(profiles);
      await cadastro.iniciarPeloChat(TEL, "teste", "CADASTRO");
      expect(prisma.cadastroWhatsapp.create).not.toHaveBeenCalled();
      expect(wa.sendMessage.mock.calls[0][1]).toContain("equipe confira");
    }
  });
  it("reconhece um vínculo LID já existente sem telefone no evento", async () => {
    const { prisma } = setup([profile({ whatsappLid: "123" })]);
    expect(await consultarNumeroCadastro(prisma, "", "123@lid")).toEqual({
      tipo: "existente",
      userId: "conta",
    });
  });
});
