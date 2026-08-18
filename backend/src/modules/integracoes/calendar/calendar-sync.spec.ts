import { CalendarSyncService } from "./calendar-sync.service";
import { GraphEventLike } from "./outlook-mapper";

/**
 * Testa o coração da sincronização: applyEvent decide entre importar, atualizar,
 * pular (anti-eco) e cancelar — de forma idempotente. Prisma é mockado.
 */
describe("CalendarSyncService.applyEvent", () => {
  const conn = { id: "conn-1", organizationId: "org-1", userId: "user-1", externalCalendarId: "cal-1" };

  function makeService(existing: any) {
    const prisma: any = {
      event: {
        findUnique: jest.fn().mockResolvedValue(existing),
        create: jest.fn().mockResolvedValue({ id: "new" }),
        update: jest.fn().mockResolvedValue({ id: existing?.id }),
        delete: jest.fn().mockResolvedValue({ id: existing?.id }),
      },
    };
    const svc = new CalendarSyncService(prisma, {} as any, {} as any);
    return { svc, prisma };
  }

  const busyEvent: GraphEventLike = {
    id: "EXT-1",
    subject: "Reunião interna",
    start: { dateTime: "2026-08-18T11:00:00", timeZone: "UTC" },
    end: { dateTime: "2026-08-18T12:00:00", timeZone: "UTC" },
    showAs: "busy",
    "@odata.etag": 'W/"v1"',
  };

  it("importa um evento novo com proveniência microsoft", async () => {
    const { svc, prisma } = makeService(null);
    const r = await (svc as any).applyEvent(conn, busyEvent);
    expect(r).toBe("imported");
    expect(prisma.event.create).toHaveBeenCalledTimes(1);
    const data = prisma.event.create.mock.calls[0][0].data;
    expect(data.provider).toBe("microsoft");
    expect(data.connectionId).toBe("conn-1");
    expect(data.externalId).toBe("EXT-1");
    expect(data.userId).toBe("user-1"); // isolamento: sempre o dono da conexão
  });

  it("pula quando o etag é o mesmo (anti-eco / anti-loop)", async () => {
    const { svc, prisma } = makeService({ id: "e1", externalEtag: 'W/"v1"' });
    const r = await (svc as any).applyEvent(conn, busyEvent);
    expect(r).toBe("skipped");
    expect(prisma.event.update).not.toHaveBeenCalled();
    expect(prisma.event.create).not.toHaveBeenCalled();
  });

  it("atualiza quando o etag mudou", async () => {
    const { svc, prisma } = makeService({ id: "e1", externalEtag: 'W/"OLD"' });
    const r = await (svc as any).applyEvent(conn, busyEvent);
    expect(r).toBe("updated");
    expect(prisma.event.update).toHaveBeenCalledTimes(1);
  });

  it("cancela (remove o espelho) quando o evento é removido no Outlook", async () => {
    const { svc, prisma } = makeService({ id: "e1", externalEtag: 'W/"v1"' });
    const removed: GraphEventLike = { id: "EXT-1", "@removed": { reason: "deleted" } };
    const r = await (svc as any).applyEvent(conn, removed);
    expect(r).toBe("cancelled");
    expect(prisma.event.delete).toHaveBeenCalledTimes(1);
  });

  it('remove o espelho quando o evento vira "livre" (não ocupa agenda)', async () => {
    const { svc, prisma } = makeService({ id: "e1", externalEtag: 'W/"v1"' });
    const free: GraphEventLike = { ...busyEvent, showAs: "free", "@odata.etag": 'W/"v2"' };
    const r = await (svc as any).applyEvent(conn, free);
    expect(r).toBe("cancelled");
    expect(prisma.event.delete).toHaveBeenCalledTimes(1);
  });

  it("ignora o mestre da série (seriesMaster)", async () => {
    const { svc, prisma } = makeService(null);
    const master: GraphEventLike = { id: "S", type: "seriesMaster", subject: "Semanal" };
    const r = await (svc as any).applyEvent(conn, master);
    expect(r).toBe("skipped");
    expect(prisma.event.create).not.toHaveBeenCalled();
  });
});
