import { BadRequestException } from "@nestjs/common";
import { CalendarConnectionService } from "./calendar-connection.service";
import { encryptSecret } from "../../../common/vault";

/**
 * Foco no ciclo de vida do token: renovação proativa, persistência do novo
 * token e transição para reauth_required quando o refresh não vale mais.
 */
describe("CalendarConnectionService.getValidAccessToken", () => {
  const OLD = process.env;
  beforeAll(() => { process.env = { ...OLD, APP_VAULT_KEY: "a".repeat(64) }; });
  afterAll(() => { process.env = OLD; });

  function makeService(conn: any, oauth: any) {
    const prisma: any = {
      calendarConnection: {
        findUnique: jest.fn().mockResolvedValue(conn),
        update: jest.fn().mockResolvedValue({ ...conn }),
      },
    };
    const svc = new CalendarConnectionService(prisma, oauth, {} as any);
    return { svc, prisma };
  }

  it("retorna o token atual quando ainda é válido (sem chamar refresh)", async () => {
    const conn = {
      id: "c1", status: "synced",
      accessTokenEnc: encryptSecret("token-valido"),
      tokenExpiresAt: new Date(Date.now() + 30 * 60_000),
    };
    const oauth = { refresh: jest.fn() };
    const { svc } = makeService(conn, oauth);
    const t = await svc.getValidAccessToken("c1");
    expect(t).toBe("token-valido");
    expect(oauth.refresh).not.toHaveBeenCalled();
  });

  it("renova e persiste quando está prestes a expirar", async () => {
    const conn = {
      id: "c1", status: "synced", scope: "s", organizationId: "org-9",
      accessTokenEnc: encryptSecret("antigo"),
      refreshTokenEnc: encryptSecret("refresh-1"),
      tokenExpiresAt: new Date(Date.now() + 30_000), // < 2 min
    };
    const oauth = {
      refresh: jest.fn().mockResolvedValue({
        accessToken: "novo", refreshToken: "refresh-2",
        expiresAt: new Date(Date.now() + 3600_000), scope: "s",
      }),
    };
    const { svc, prisma } = makeService(conn, oauth);
    const t = await svc.getValidAccessToken("c1");
    expect(t).toBe("novo");
    expect(oauth.refresh).toHaveBeenCalledWith("refresh-1", "org-9");
    expect(prisma.calendarConnection.update).toHaveBeenCalledTimes(1);
    const data = prisma.calendarConnection.update.mock.calls[0][0].data;
    expect(data.accessTokenEnc).toBeDefined();
    expect(data.tokenExpiresAt).toBeInstanceOf(Date);
  });

  it("marca reauth_required quando o refresh falha com invalid_grant", async () => {
    const conn = {
      id: "c1", status: "synced",
      accessTokenEnc: encryptSecret("antigo"),
      refreshTokenEnc: encryptSecret("refresh-morto"),
      tokenExpiresAt: new Date(Date.now() + 10_000),
    };
    const oauth = {
      refresh: jest.fn().mockRejectedValue({ response: { code: "REAUTH_REQUIRED" } }),
    };
    const { svc, prisma } = makeService(conn, oauth);
    await expect(svc.getValidAccessToken("c1")).rejects.toBeInstanceOf(BadRequestException);
    // A última escrita marca o status reauth_required.
    const calls = prisma.calendarConnection.update.mock.calls;
    const last = calls[calls.length - 1][0].data;
    expect(last.status).toBe("reauth_required");
  });

  it("exige reautenticação quando não há refresh token", async () => {
    const conn = {
      id: "c1", status: "synced",
      accessTokenEnc: encryptSecret("antigo"),
      refreshTokenEnc: null,
      tokenExpiresAt: new Date(Date.now() + 10_000),
    };
    const { svc } = makeService(conn, { refresh: jest.fn() });
    await expect(svc.getValidAccessToken("c1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("toStatusDto nunca expõe tokens", () => {
    const { svc } = makeService(null, {});
    const dto = svc.toStatusDto({
      status: "synced", provider: "microsoft", providerEmail: "a@b.com",
      accessTokenEnc: "SECRETO", refreshTokenEnc: "SECRETO", externalCalendarName: "Calendar",
      lastSyncAt: new Date(), pushEnabled: true, syncEnabled: true, lastError: null,
    });
    expect(JSON.stringify(dto)).not.toContain("SECRETO");
    expect(dto.account).toBe("a@b.com");
  });
});
