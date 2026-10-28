import { novaDataCompromisso } from "./evento-alerta-datas";
import { EventoAlertaService } from "./evento-alerta.service";
import { AlertScheduler } from "./alert.scheduler";

const agora = new Date("2026-10-27T13:00:00Z");
describe("Nova data de compromisso", () => {
  it.each([
    ["amanhã às 14h", "2026-10-28T17:00:00.000Z"],
    ["hoje 14:30", "2026-10-27T17:30:00.000Z"],
    ["28/10/2026 08h15", "2026-10-28T11:15:00.000Z"],
    ["28/10 00:00", "2026-10-28T03:00:00.000Z"],
  ])("interpreta %s em Brasília", (texto, esperado) =>
    expect(novaDataCompromisso(texto, agora)?.toISOString()).toBe(esperado),
  );
  it.each([
    "amanhã",
    "14h",
    "31/02/2027 14h",
    "29/02/2027 14h",
    "28/10/2026 24h",
    "amanhã 14:60",
    "hoje 09h",
    "ontem 14h",
    "28/10/2026",
    "amanhã às 14h depois gasto 20",
  ])("recusa data incompleta/inválida/passada: %s", (texto) =>
    expect(novaDataCompromisso(texto, agora)).toBeNull(),
  );
});

describe("Menu de confirmação de compromisso", () => {
  const user = { id: "u1", organizationId: "org1" };
  let prisma: any,
    svc: EventoAlertaService,
    wa: any,
    writeback: any,
    event: any,
    row: any;
  beforeEach(() => {
    event = {
      id: "ev1",
      userId: "u1",
      organizationId: "org1",
      inicio: new Date(),
      fim: new Date(Date.now() + 3600000),
      titulo: "Consulta",
      atualizadoEm: new Date(),
    };
    row = {
      event_id: event.id,
      user_id: user.id,
      organization_id: user.organizationId,
      inicio: event.inicio,
      titulo: event.titulo,
      codigo: "E-123456789ABC",
      estado: "MENU",
      envios: {},
    };
    prisma = {
      $queryRaw: jest.fn().mockImplementation(() => Promise.resolve([row])),
      $executeRaw: jest.fn().mockResolvedValue(1),
      event: {
        findFirst: jest.fn().mockImplementation(() => Promise.resolve(event)),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma.$transaction = (fn: any) => fn(prisma);
    wa = { sendToJid: jest.fn().mockResolvedValue(true) };
    writeback = { onEventUpdated: jest.fn().mockResolvedValue(undefined) };
    svc = new EventoAlertaService(prisma, wa, writeback);
  });
  const perms = async () => ["agenda:editar"];
  it("confirma sem mudar data nem cancelar outros eventos", async () => {
    expect(await svc.tratar(user, "1", "chat", "inst", perms)).toBe(true);
    expect(wa.sendToJid).toHaveBeenCalledWith(
      "chat",
      expect.stringContaining("Participação confirmada"),
      "inst",
    );
    expect(prisma.event.updateMany).not.toHaveBeenCalled();
    expect(
      prisma.$executeRaw.mock.calls.some((args: any) =>
        args[0].join("").includes("estado='CONFIRMADO'"),
      ),
    ).toBe(true);
  });
  it('exige código se também existe um rascunho de outra operação', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([row]).mockResolvedValueOnce([{ aberto: true }]);
    await svc.tratar(user, '1', 'chat', 'inst', perms);
    expect(wa.sendToJid.mock.calls[0][1]).toContain('registro em andamento');
    expect(prisma.$executeRaw.mock.calls.some((args: any) => args[0].join('').includes("estado='CONFIRMADO'"))).toBe(false);
  });
  it("pede nova data ao escolher 2, sem editar antecipadamente", async () => {
    await svc.tratar(user, "2", "chat", "inst", perms);
    expect(wa.sendToJid).toHaveBeenCalledWith(
      "chat",
      expect.stringContaining("nova data e horário"),
      "inst",
    );
    expect(prisma.event.updateMany).not.toHaveBeenCalled();
  });
  it("salva data futura e preserva duração, sincronizando a agenda externa", async () => {
    row.estado = "AGUARDANDO_DATA";
    await svc.tratar(user, "amanhã às 14h", "chat", "inst", perms);
    const data = prisma.event.updateMany.mock.calls[0][0].data;
    expect(data.fim.getTime() - data.inicio.getTime()).toBe(3600000);
    expect(writeback.onEventUpdated).toHaveBeenCalledWith("ev1");
    expect(wa.sendToJid).toHaveBeenCalledWith(
      "chat",
      expect.stringContaining("foi adiado"),
      "inst",
    );
  });
  it("mantém a etapa quando a data é inválida", async () => {
    row.estado = "AGUARDANDO_DATA";
    await svc.tratar(user, "31/02/2027 14h", "chat", "inst", perms);
    expect(prisma.event.updateMany).not.toHaveBeenCalled();
    expect(wa.sendToJid.mock.calls[0][1]).toContain("data válida");
  });
  it("cancelar mantém o horário", async () => {
    row.estado = "AGUARDANDO_DATA";
    await svc.tratar(user, "cancelar", "chat", "inst", perms);
    expect(prisma.event.updateMany).not.toHaveBeenCalled();
    expect(wa.sendToJid.mock.calls[0][1]).toContain("mantive");
  });
  it("não consome números sem menu ativo", async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    expect(await svc.tratar(user, "1", "chat", "inst", perms)).toBe(false);
  });
  it("não consome números de menu suspenso", async () => {
    row.estado = "SUSPENSO";
    expect(await svc.tratar(user, "1", "chat", "inst", perms)).toBe(false);
    expect(
      await svc.tratar(user, "1 E-123456789ABC", "chat", "inst", perms),
    ).toBe(true);
  });
  it("não escolhe um evento arbitrário quando há dois avisos", async () => {
    prisma.$queryRaw.mockResolvedValue([
      row,
      { ...row, event_id: "ev2", codigo: "E-ABCDEF123456", titulo: "Outro" },
    ]);
    await svc.tratar(user, "1", "chat", "inst", perms);
    expect(wa.sendToJid.mock.calls[0][1]).toContain("mais de um compromisso");
    expect(prisma.event.updateMany).not.toHaveBeenCalled();
  });
  it("verifica permissão antes da alteração", async () => {
    await svc.tratar(user, "1", "chat", "inst", async () => []);
    expect(wa.sendToJid.mock.calls[0][1]).toContain("não tem permissão");
    expect(prisma.event.updateMany).not.toHaveBeenCalled();
  });
  it("não avisa sucesso quando houve uma edição concorrente", async () => {
    row.estado = "AGUARDANDO_DATA";
    prisma.event.updateMany.mockResolvedValue({ count: 0 });
    await svc.tratar(user, "amanhã 14h", "chat", "inst", perms);
    expect(wa.sendToJid.mock.calls[0][1]).toContain("mudou enquanto");
    expect(writeback.onEventUpdated).not.toHaveBeenCalled();
  });
  it("ignora novos envios após confirmação ou reserva existente", async () => {
    row.estado = "CONFIRMADO";
    expect(await svc.prepararEnvio(event, 0, "inst")).toBeNull();
    row.estado = "MENU";
    row.envios = { "0": "RESERVADO" };
    expect(await svc.prepararEnvio(event, 0, "inst")).toBeNull();
  });
  it("suspende o atalho quando o usuário inicia outro comando", async () => {
    expect(
      await svc.tratar(
        user,
        "Evento: Almoço amanhã 12h",
        "chat",
        "inst",
        perms,
      ),
    ).toBe(false);
    expect(
      prisma.$executeRaw.mock.calls.some((args: any) =>
        args[0].join("").includes("estado='SUSPENSO'"),
      ),
    ).toBe(true);
  });
});

describe("Envio do aviso de agora", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(agora);
  });
  afterEach(() => jest.useRealTimers());
  it("só anuncia agora após o início, com menu, e não duplica no tick seguinte", async () => {
    const wa: any = {
      resolveInstance: jest.fn().mockResolvedValue("inst"),
      sendMessage: jest.fn().mockResolvedValue(true),
    };
    const alerts: any = {
      prepararEnvio: jest.fn().mockResolvedValue("E-123456789ABC"),
      mensagemAgora: jest.fn().mockReturnValue("Menu 1 confirmar / 2 adiar"),
      registrarEnvio: jest.fn(),
    };
    const event: any = {
      id: "ev",
      userId: "u",
      organizationId: "org",
      inicio: new Date(agora.getTime() + 30000),
      titulo: "Consulta",
      user: { profile: { whatsapp: "5511999990001" } },
    };
    const db: any = {
      alertConfig: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { minutos: 0, organizationId: "org", emoji: "", titulo: "Agora" },
          ]),
      },
      event: { findMany: jest.fn().mockResolvedValue([event]) },
      notification: { create: jest.fn() },
    };
    const scheduler: any = new AlertScheduler(
      db,
      wa,
      { get: () => "https://www.orkiestri.com" } as any,
      {} as any,
      alerts,
    );
    scheduler.runSlaCheck = async () => {};
    scheduler.runOrcamentoAlertCheck = async () => {};
    await scheduler.run();
    expect(wa.sendMessage).not.toHaveBeenCalled();
    event.inicio = new Date(agora.getTime() - 1000);
    await scheduler.run();
    await scheduler.run();
    expect(wa.sendMessage).toHaveBeenCalledTimes(1);
    expect(wa.sendMessage.mock.calls[0][1]).toContain("Menu 1 confirmar");
    alerts.prepararEnvio.mockResolvedValue(null);
    scheduler.sent.clear();
    await scheduler.run();
    expect(wa.sendMessage).toHaveBeenCalledTimes(1);
  });
});
