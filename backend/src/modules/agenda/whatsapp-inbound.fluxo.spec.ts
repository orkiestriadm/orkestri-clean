import "reflect-metadata";
import { parseComandoEvento, WhatsappInboundService } from "./whatsapp-inbound.module";

describe("WhatsApp — fluxo de menu e cadastro de eventos", () => {
  let service: WhatsappInboundService;
  let prisma: any;
  let wa: any;
  let auth: any;
  let sequencia = 0;
  const jid = "5511999999999@s.whatsapp.net";
  const receber = (texto: string) => service.processar({ instance: "teste", data: {
    key: { id: `teste-${++sequencia}`, remoteJid: jid, fromMe: false }, message: { conversation: texto },
  } });
  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ mensagem_id: "teste" }]),
      $executeRaw: jest.fn().mockResolvedValue(1),
      userProfile: { findFirst: jest.fn().mockResolvedValue({ whatsapp: "5511999999999",
        user: { id: "teste", nome: "Pessoa Teste", organizationId: "org", ativo: true } }) },
      event: { create: jest.fn().mockResolvedValue({ id: "evento" }) },
    };
    wa = { sendMessage: jest.fn().mockResolvedValue(true), sendToJid: jest.fn().mockResolvedValue(true) };
    auth = { resolvePermissions: jest.fn().mockResolvedValue(["agenda:criar", "gastos:registrar"]) };
    service = new WhatsappInboundService(prisma, wa, auth, { temFluxo: async () => false } as any, {} as any);
  });
  it("saúda, abre menu, navega, explica opção inválida e encerra", async () => {
    await receber("oi");
    expect(wa.sendMessage).toHaveBeenLastCalledWith("5511999999999", expect.stringContaining("Aurélia"), "teste");
    await receber("1");
    expect(wa.sendMessage.mock.calls.at(-1)[1]).toContain("ANOTAR UM GASTO");
    await receber("9");
    await receber("2");
    expect(wa.sendMessage.mock.calls.at(-1)[1]).toContain("MARCAR UM COMPROMISSO");
    await receber("3");
    expect(wa.sendMessage.mock.calls.at(-1)[1]).toContain("Opção indisponível");
    await receber("0");
    expect(wa.sendMessage.mock.calls.at(-1)[1]).toContain("Encerrei");
    expect(prisma.event.create).not.toHaveBeenCalled();
  });
  it("grava o evento para o usuário e organização identificados", async () => {
    await receber("Evento: Médico amanhã 14h");
    expect(prisma.event.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      titulo: "Médico", userId: "teste", organizationId: "org", diaTodo: false,
    }) });
    expect(wa.sendMessage.mock.calls.at(-1)[1]).toContain("Evento criado");
  });
  it("ignora mensagens enviadas pelo bot antes de registrar ou executar comandos", async () => {
    await service.processar({ instance: "teste", data: {
      key: { id: "mensagem-do-bot", remoteJid: jid, fromMe: true },
      message: { conversation: "Evento: Reunião amanhã 14h" },
    } });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.event.create).not.toHaveBeenCalled();
    expect(wa.sendMessage).not.toHaveBeenCalled();
  });
  it("impede cadastro sem permissão", async () => {
    auth.resolvePermissions.mockResolvedValue(["gastos:registrar"]);
    await receber("Evento: Médico amanhã 14h");
    expect(prisma.event.create).not.toHaveBeenCalled();
    expect(wa.sendMessage.mock.calls.at(-1)[1]).toContain("não tem permissão");
  });
  it("não cadastra quando a consulta de permissões falha", async () => {
    auth.resolvePermissions.mockRejectedValue(new Error("offline"));
    await receber("Evento: Médico amanhã 14h");
    expect(prisma.event.create).not.toHaveBeenCalled();
  });
  it("orienta uma pessoa sem vínculo", async () => {
    prisma.userProfile.findFirst.mockResolvedValue(null);
    prisma.userProfile.findMany = jest.fn().mockResolvedValue([]);
    await receber("olá");
    expect(wa.sendToJid).toHaveBeenCalledWith(jid, expect.stringContaining("VINCULAR"), "teste");
  });
});

describe("Datas de eventos pelo WhatsApp", () => {
  const agora = new Date(2026, 9, 24, 10);
  it("recusa datas que o JavaScript converteria para outro mês", () => {
    expect(parseComandoEvento("Evento: Médico 31/02 14h", agora)).toBe("sem_data_hora");
  });
  it("aceita ontem conforme anunciado na ajuda", () => {
    const evento = parseComandoEvento("Evento: Médico ontem 14h", agora) as any;
    expect(evento.inicio).toEqual(new Date(2026, 9, 23, 14));
    expect(evento.titulo).toBe("Médico");
  });
});
