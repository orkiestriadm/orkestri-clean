import { MicrosoftConfig } from "./microsoft.config";
import { MicrosoftConfigResolver } from "./microsoft-config.resolver";
import { encryptSecret } from "../../../common/vault";

/**
 * Resolução da config por organização: config da org → padrão da plataforma →
 * env. E a garantia de que o secret nunca sai como texto para fora do resolver
 * a não ser dentro de EffectiveMicrosoftConfig (uso interno do OAuth).
 */
describe("MicrosoftConfigResolver", () => {
  const OLD = process.env;
  beforeAll(() => { process.env = { ...OLD, APP_VAULT_KEY: "b".repeat(64) }; });
  afterAll(() => { process.env = OLD; });

  function makeResolver(rows: { org?: any; platform?: any }) {
    const prisma: any = {
      calendarProviderConfig: {
        findUnique: jest.fn().mockResolvedValue(rows.org ?? null),
        findFirst: jest.fn().mockResolvedValue(rows.platform ?? null),
      },
    };
    return new MicrosoftConfigResolver(prisma, new MicrosoftConfig());
  }

  it("usa a config da organização quando existe e está habilitada", async () => {
    const org = {
      id: "o1", enabled: true, clientId: "org-client", tenantId: "org-tenant",
      clientSecretEnc: encryptSecret("org-secret"), redirectUri: null, webhookUrl: null,
    };
    const r = makeResolver({ org });
    const cfg = await r.resolve("org-1");
    expect(cfg.source).toBe("org");
    expect(cfg.clientId).toBe("org-client");
    expect(cfg.tenantId).toBe("org-tenant");
    expect(cfg.clientSecret).toBe("org-secret");
    expect(cfg.authority).toContain("org-tenant");
    expect(cfg.isConfigured).toBe(true);
  });

  it("cai para o padrão da plataforma quando a org não tem config", async () => {
    const platform = {
      id: "p1", organizationId: null, enabled: true, clientId: "plat-client",
      tenantId: "common", clientSecretEnc: encryptSecret("plat-secret"),
    };
    const r = makeResolver({ org: null, platform });
    const cfg = await r.resolve("org-sem-config");
    expect(cfg.source).toBe("platform");
    expect(cfg.clientId).toBe("plat-client");
    expect(cfg.clientSecret).toBe("plat-secret");
  });

  it("cai para o ambiente quando não há config no banco", async () => {
    process.env.MS_CLIENT_ID = "env-client";
    process.env.MS_CLIENT_SECRET = "env-secret";
    process.env.MS_TENANT_ID = "env-tenant";
    const r = makeResolver({});
    const cfg = await r.resolve("qualquer");
    expect(cfg.source).toBe("env");
    expect(cfg.clientId).toBe("env-client");
    expect(cfg.clientSecret).toBe("env-secret");
    delete process.env.MS_CLIENT_ID; delete process.env.MS_CLIENT_SECRET; delete process.env.MS_TENANT_ID;
  });

  it("reporta não configurado quando não há nada", async () => {
    delete process.env.MS_CLIENT_ID; delete process.env.MS_CLIENT_SECRET;
    const r = makeResolver({});
    const cfg = await r.resolve("org-1");
    expect(cfg.isConfigured).toBe(false);
    expect(cfg.source).toBe("none");
  });

  it("ignora config da org desabilitada e usa a plataforma", async () => {
    const org = { id: "o1", enabled: false, clientId: "org-client", clientSecretEnc: encryptSecret("x") };
    const platform = { id: "p1", enabled: true, clientId: "plat-client", tenantId: "common", clientSecretEnc: encryptSecret("plat-secret") };
    const r = makeResolver({ org, platform });
    const cfg = await r.resolve("org-1");
    expect(cfg.source).toBe("platform");
  });
});
