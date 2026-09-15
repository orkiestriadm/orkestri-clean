import { NotFoundException } from "@nestjs/common";
import { IntegrationAccessService } from "./integration-access.service";

/**
 * Regras da liberação: pedir não reavisa quem já foi avisado, só administrador
 * da mesma organização decide, e remover desliga a conexão mantendo o passado.
 */
describe("IntegrationAccessService", () => {
  function make(opts: { acesso?: string | null; conn?: any; alvoNaOrg?: boolean; admins?: { id: string }[] } = {}) {
    const prisma: any = {
      calendarIntegrationAccess: {
        findUnique: jest.fn().mockResolvedValue(opts.acesso ? { status: opts.acesso } : null),
        upsert: jest.fn().mockResolvedValue({ id: "acc-1" }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ nome: "Maria" }),
        findFirst: jest.fn().mockResolvedValue(opts.alvoNaOrg === false ? null : { id: "u-2" }),
        findMany: jest.fn().mockResolvedValue(opts.admins ?? [{ id: "adm-1" }]),
      },
      notification: {
        create: jest.fn().mockResolvedValue({}),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      calendarConnection: {
        findFirst: jest.fn().mockResolvedValue(opts.conn ?? null),
        update: jest.fn().mockResolvedValue({}),
      },
      event: { deleteMany: jest.fn().mockResolvedValue({ count: 4 }) },
    };
    const subscriptions: any = { deleteForConnection: jest.fn().mockResolvedValue(undefined) };
    return { svc: new IntegrationAccessService(prisma, subscriptions), prisma, subscriptions };
  }

  it("sem registro, a situação é 'nenhum'", async () => {
    const { svc } = make();
    expect(await svc.getStatus("u-1")).toBe("nenhum");
    expect(await svc.isLiberado("u-1")).toBe(false);
  });

  it("solicitar cria pendente e avisa os administradores", async () => {
    const { svc, prisma } = make();
    const r = await svc.solicitar({ id: "u-1", organizationId: "org-1" });
    expect(r.status).toBe("pendente");
    expect(prisma.calendarIntegrationAccess.upsert).toHaveBeenCalledTimes(1);
    const aviso = prisma.notification.createMany.mock.calls[0][0].data[0];
    expect(aviso.userId).toBe("adm-1");
    expect(aviso.tipo).toBe("integracao_365_solicitacao");
    expect(aviso.mensagem).toContain("Maria");
    // Admins só da organização do solicitante, e não ele mesmo.
    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.organizationId).toBe("org-1");
    expect(where.id).toEqual({ not: "u-1" });
  });

  it("pedir de novo enquanto pendente não reavisa ninguém", async () => {
    const { svc, prisma } = make({ acesso: "pendente" });
    const r = await svc.solicitar({ id: "u-1", organizationId: "org-1" });
    expect(r.status).toBe("pendente");
    expect(prisma.calendarIntegrationAccess.upsert).not.toHaveBeenCalled();
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it("quem já está liberado não volta para pendente", async () => {
    const { svc, prisma } = make({ acesso: "liberado" });
    expect((await svc.solicitar({ id: "u-1", organizationId: "org-1" })).status).toBe("liberado");
    expect(prisma.calendarIntegrationAccess.upsert).not.toHaveBeenCalled();
  });

  it("liberar marca liberado e avisa o usuário", async () => {
    const { svc, prisma } = make();
    const r = await svc.decidir("org-1", "adm-1", "u-2", "liberar");
    expect(r.status).toBe("liberado");
    expect(prisma.calendarIntegrationAccess.upsert.mock.calls[0][0].update.decididoPorId).toBe("adm-1");
    expect(prisma.notification.create.mock.calls[0][0].data.tipo).toBe("integracao_365_liberada");
    expect(prisma.event.deleteMany).not.toHaveBeenCalled();
  });

  it("não decide sobre usuário de outra organização", async () => {
    const { svc, prisma } = make({ alvoNaOrg: false });
    await expect(svc.decidir("org-1", "adm-1", "u-x", "liberar")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.calendarIntegrationAccess.upsert).not.toHaveBeenCalled();
  });

  it("remover desliga a conexão e apaga só os compromissos futuros", async () => {
    const { svc, prisma, subscriptions } = make({ conn: { id: "conn-1" } });
    const r = await svc.decidir("org-1", "adm-1", "u-2", "remover");
    expect(r.status).toBe("removido");
    expect(r.eventsRemoved).toBe(4);
    expect(subscriptions.deleteForConnection).toHaveBeenCalledWith("conn-1");
    const where = prisma.event.deleteMany.mock.calls[0][0].where;
    expect(where.inicio.gte).toBeInstanceOf(Date);
    expect(prisma.calendarConnection.update.mock.calls[0][0].data.status).toBe("disconnected");
  });
});
