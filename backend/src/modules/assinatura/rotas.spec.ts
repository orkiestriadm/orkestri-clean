/**
 * As rotas da assinatura existem mesmo, e o webhook TRAVA sem assinatura
 * válida.
 *
 * Por que isto é um teste e não uma conferida no log: um botão que "não faz
 * nada" sem dar erro já custou caro aqui — decorador que não registra a rota
 * não quebra o build nem aparece em teste de unidade. Aqui o Nest monta o
 * roteador de verdade e a lista é conferida.
 *
 * E o 403 do webhook é verificado chamando o handler: checagem que não trava
 * não é verificação, então o teste exige a EXCEÇÃO, não um aviso no log.
 */
jest.mock("nodemailer", () => ({}), { virtual: true });
import "reflect-metadata";
import { ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { createHmac } from "crypto";
import { AssinaturaCheckoutController, AssinaturaWebhookController, AssinaturaService } from "./assinatura.module";

const SECRET = "segredo-do-webhook";

function servicoFalso() {
  return {
    estadoCheckout: jest.fn(async () => ({ nome: "ana" })),
    checkoutCartao: jest.fn(async () => ({ initPoint: "https://mp/x" })),
    checkoutPix: jest.fn(async () => ({ copiaECola: "000201..." })),
    processarNotificacao: jest.fn(async () => undefined),
  };
}

async function montarApp(svc: any) {
  const mod = await Test.createTestingModule({
    controllers: [AssinaturaCheckoutController, AssinaturaWebhookController],
    providers: [
      { provide: AssinaturaService, useValue: svc },
      { provide: ConfigService, useValue: { get: (k: string) => (k === "MP_WEBHOOK_SECRET" ? SECRET : undefined) } },
    ],
  }).compile();
  const app = mod.createNestApplication();
  await app.init();
  return app;
}

function rotas(app: any): string[] {
  const stack = app.getHttpAdapter().getInstance()._router.stack as any[];
  return stack
    .filter((c) => c.route)
    .map((c) => `${Object.keys(c.route.methods)[0].toUpperCase()} ${c.route.path}`)
    .sort();
}

describe("rotas registradas", () => {
  let app: any;
  afterEach(async () => { if (app) await app.close(); });

  it("o checkout e o webhook estão todos no roteador", async () => {
    app = await montarApp(servicoFalso());
    const lista = rotas(app);
    expect(lista).toEqual([
      "GET /assinatura/checkout/:token",
      "POST /assinatura/checkout/:token/cartao",
      "POST /assinatura/checkout/:token/pix",
      "POST /assinatura/webhook/mp",
    ]);
  });
});

describe("webhook — a conferência é um gate, não um aviso", () => {
  let app: any;
  let svc: any;
  let controller: AssinaturaWebhookController;

  beforeEach(async () => {
    svc = servicoFalso();
    app = await montarApp(svc);
    controller = app.get(AssinaturaWebhookController);
  });
  afterEach(async () => { if (app) await app.close(); });

  const chamar = (xSignature: string, dataId = "123456", requestId = "req-1") =>
    (controller as any).mp(dataId, undefined, "payment", xSignature, requestId, { type: "payment", data: { id: dataId } });

  const assinar = (dataId: string, requestId = "req-1", secret = SECRET) => {
    const ts = Math.floor(Date.now() / 1000);
    const v1 = createHmac("sha256", secret).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest("hex");
    return `ts=${ts},v1=${v1}`;
  };

  it("assinatura válida: processa", async () => {
    await expect(chamar(assinar("123456"))).resolves.toEqual({ recebido: true });
    expect(svc.processarNotificacao).toHaveBeenCalledWith("payment", "123456");
  });

  it("assinatura inválida: 403 e NADA é processado", async () => {
    await expect(chamar("ts=1,v1=deadbeef")).rejects.toBeInstanceOf(ForbiddenException);
    expect(svc.processarNotificacao).not.toHaveBeenCalled();
  });

  it("sem cabeçalho de assinatura: 403", async () => {
    await expect(chamar(undefined as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(svc.processarNotificacao).not.toHaveBeenCalled();
  });

  it("assinado com outro segredo: 403", async () => {
    await expect(chamar(assinar("123456", "req-1", "segredo-do-atacante"))).rejects.toBeInstanceOf(ForbiddenException);
    expect(svc.processarNotificacao).not.toHaveBeenCalled();
  });

  it("assinatura de OUTRO id não vale para este: 403", async () => {
    await expect(chamar(assinar("999999"), "123456")).rejects.toBeInstanceOf(ForbiddenException);
    expect(svc.processarNotificacao).not.toHaveBeenCalled();
  });

  it("falha ao processar não derruba o webhook (o MP reenviaria para sempre)", async () => {
    svc.processarNotificacao.mockRejectedValue(new Error("banco fora"));
    await expect(chamar(assinar("123456"))).resolves.toEqual({ recebido: true });
  });
});
