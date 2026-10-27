/**
 * Token do link de pagamento. Ele abre a tela de pagamento de UMA conta sem
 * pedir login — então tem de ser reversível para nós e inútil para quem não
 * tem o segredo.
 */
import { tokenCheckout, lerTokenCheckout, urlCheckout } from "./checkout-token";

describe("token do link de pagamento", () => {
  it("vai e volta: o servidor sabe de quem é o link", () => {
    const t = tokenCheckout("user-123");
    expect(lerTokenCheckout(t)).toBe("user-123");
  });

  it("é estável para o mesmo usuário e diferente entre usuários", () => {
    expect(tokenCheckout("a")).toBe(tokenCheckout("a"));
    expect(tokenCheckout("a")).not.toBe(tokenCheckout("b"));
  });

  it("trocar o userId sem a assinatura não abre a conta de outro", () => {
    const alvo = Buffer.from("user-vitima", "utf8").toString("base64url");
    const roubado = tokenCheckout("user-123").split(".")[1];
    expect(lerTokenCheckout(`${alvo}.${roubado}`)).toBeNull();
  });

  it("assinatura mexida é recusada", () => {
    const [b64, sig] = tokenCheckout("user-123").split(".");
    const outro = sig.slice(0, -1) + (sig.endsWith("a") ? "b" : "a");
    expect(lerTokenCheckout(`${b64}.${outro}`)).toBeNull();
  });

  it("lixo não derruba nem é aceito", () => {
    expect(lerTokenCheckout("")).toBeNull();
    expect(lerTokenCheckout(undefined)).toBeNull();
    expect(lerTokenCheckout("semponto")).toBeNull();
    expect(lerTokenCheckout("a.b.c")).toBeNull();
    expect(lerTokenCheckout(".")).toBeNull();
  });

  it("a URL não duplica a barra do APP_URL", () => {
    expect(urlCheckout("https://orkiestri.com/", "u1")).toBe(`https://orkiestri.com/assinatura/${tokenCheckout("u1")}`);
    expect(urlCheckout("https://orkiestri.com", "u1")).toBe(`https://orkiestri.com/assinatura/${tokenCheckout("u1")}`);
  });

  it("o token não carrega o userId em claro na URL", () => {
    // base64url não é segredo, mas também não é para aparecer legível no link.
    expect(tokenCheckout("fernando@empresa.com")).not.toContain("fernando@empresa.com");
  });
});
