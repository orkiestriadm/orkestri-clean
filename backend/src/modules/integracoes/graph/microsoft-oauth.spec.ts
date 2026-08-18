import { BadRequestException } from "@nestjs/common";
import { MicrosoftOAuthService } from "./microsoft-oauth.service";
import { MicrosoftConfig } from "./microsoft.config";

describe("MicrosoftOAuthService — state assinado", () => {
  const OLD = process.env;
  let svc: MicrosoftOAuthService;

  beforeEach(() => {
    process.env = { ...OLD, JWT_SECRET: "segredo-de-teste-suficientemente-longo", MS_CLIENT_ID: "cid", MS_CLIENT_SECRET: "sec" };
    svc = new MicrosoftOAuthService(new MicrosoftConfig());
  });
  afterAll(() => { process.env = OLD; });

  it("faz round-trip do state vinculando usuário e organização", () => {
    const state = svc.signState("user-1", "org-1");
    const payload = svc.verifyState(state);
    expect(payload.userId).toBe("user-1");
    expect(payload.organizationId).toBe("org-1");
  });

  it("rejeita state adulterado (assinatura não confere)", () => {
    const state = svc.signState("user-1", "org-1");
    const [body] = state.split(".");
    const forged = `${body}.assinaturaerrada`;
    expect(() => svc.verifyState(forged)).toThrow(BadRequestException);
  });

  it("rejeita state com corpo trocado (tentativa de trocar o userId)", () => {
    const state = svc.signState("user-1", "org-1");
    const sig = state.split(".")[1];
    const evil = Buffer.from(JSON.stringify({ userId: "attacker", organizationId: "org-1", nonce: "x", exp: Date.now() + 10000 })).toString("base64url");
    expect(() => svc.verifyState(`${evil}.${sig}`)).toThrow(BadRequestException);
  });

  it("rejeita state expirado", () => {
    // Assina manualmente com exp no passado, reutilizando a mesma chave.
    const svcAny = svc as any;
    const expired = Buffer.from(JSON.stringify({ userId: "u", organizationId: "o", nonce: "n", exp: Date.now() - 1000 })).toString("base64url");
    const crypto = require("crypto");
    const sig = crypto.createHmac("sha256", "segredo-de-teste-suficientemente-longo").update(expired).digest("base64url");
    expect(() => svc.verifyState(`${expired}.${sig}`)).toThrow(/expirado/);
    void svcAny;
  });

  it("monta a URL de autorização com os escopos de menor privilégio", () => {
    const url = svc.buildAuthorizeUrl("user-1", "org-1");
    expect(url).toContain("login.microsoftonline.com");
    expect(url).toContain("Calendars.ReadWrite");
    expect(url).toContain("offline_access");
    expect(url).toContain("state=");
    // Não deve pedir permissões amplas de leitura de e-mail/arquivos.
    expect(url).not.toContain("Mail.Read");
    expect(url).not.toContain("Files.Read");
  });
});
