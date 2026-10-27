/**
 * Isenções de CSRF.
 *
 * Este teste nasceu de um erro real: o webhook do Mercado Pago estava escrito,
 * testado por unidade e registrado no roteador do Nest — e mesmo assim tomava
 * **403 do CSRF antes de chegar ao handler**, porque o caminho novo não estava
 * na lista de isenções, que morava dentro do `bootstrap()` e ninguém testava.
 *
 * Só apareceu quando a requisição passou pela pilha HTTP de verdade. Agora é
 * um gate.
 */
import { CSRF_EXEMPT_PATHS, isentoDeCsrf } from "./csrf-exempt";

describe("rotas chamadas por máquina precisam estar isentas", () => {
  it("o webhook do Mercado Pago — ele não tem como mandar cookie CSRF", () => {
    expect(isentoDeCsrf("/api/assinatura/webhook/mp")).toBe(true);
  });

  it("os outros webhooks de máquina seguem isentos", () => {
    expect(isentoDeCsrf("/api/whatsapp/inbound")).toBe(true);
    expect(isentoDeCsrf("/api/integracoes/microsoft/webhook")).toBe(true);
  });

  it("o login e o primeiro acesso, que acontecem antes de haver sessão", () => {
    expect(isentoDeCsrf("/api/auth/login")).toBe(true);
    expect(isentoDeCsrf("/api/auth/primeiro-acesso/confirmar")).toBe(true);
  });
});

describe("o que NÃO pode estar isento", () => {
  it("o checkout da assinatura: é chamado pelo navegador, que manda o header", () => {
    expect(isentoDeCsrf("/api/assinatura/checkout/qualquer-token/pix")).toBe(false);
    expect(isentoDeCsrf("/api/assinatura/checkout/qualquer-token/cartao")).toBe(false);
  });

  it("rota comum de sessão", () => {
    expect(isentoDeCsrf("/api/users")).toBe(false);
    expect(isentoDeCsrf("/api/billing/alguma-org/assign-plan")).toBe(false);
  });

  it("a comparação é EXATA — prefixo não vale, senão /api/auth/login-falso entraria", () => {
    expect(isentoDeCsrf("/api/auth/login/extra")).toBe(false);
    expect(isentoDeCsrf("/api/assinatura/webhook/mp/extra")).toBe(false);
    expect(isentoDeCsrf("/api/assinatura/webhook")).toBe(false);
  });
});

describe("a lista em si", () => {
  it("não tem caminho repetido nem caminho sem barra inicial", () => {
    expect(new Set(CSRF_EXEMPT_PATHS).size).toBe(CSRF_EXEMPT_PATHS.length);
    expect(CSRF_EXEMPT_PATHS.filter((p) => !p.startsWith("/"))).toEqual([]);
  });
});
