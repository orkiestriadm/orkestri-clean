/**
 * Conferência da assinatura do webhook do Mercado Pago.
 *
 * Isto existe porque o webhook anterior do repositório RECEBIA o `x-signature`
 * e nunca o usava: quem descobrisse a URL marcava mensalidade como paga. Os
 * testes abaixo são o gate — se algum deles passar a aceitar notificação
 * forjada, a conferência voltou a ser decorativa.
 */
import { createHmac } from "crypto";
import { conferirAssinatura, lerXSignature, tipoNotificacao, IDADE_MAXIMA_S } from "./webhook-assinatura";

const SECRET = "segredo-do-webhook";
const REQUEST_ID = "e1f2a3b4-0000-4444-8888-abcdefabcdef";
const AGORA = new Date("2026-10-27T12:00:00Z");

/** Assina como o Mercado Pago assina. */
function assinar(dataId: string, ts = Math.floor(AGORA.getTime() / 1000), secret = SECRET, requestId = REQUEST_ID) {
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac("sha256", secret).update(manifest).digest("hex");
  return `ts=${ts},v1=${v1}`;
}

const conferir = (over: any = {}) =>
  conferirAssinatura({
    xSignature: assinar("123456"),
    xRequestId: REQUEST_ID,
    dataId: "123456",
    secret: SECRET,
    agora: AGORA,
    ...over,
  });

describe("lerXSignature", () => {
  it("lê ts e v1 em qualquer ordem, com espaços", () => {
    expect(lerXSignature("ts=1,v1=abc")).toEqual({ ts: "1", v1: "abc" });
    expect(lerXSignature(" v1=abc , ts=1 ")).toEqual({ ts: "1", v1: "abc" });
  });
  it("devolve null no que não dá para usar", () => {
    expect(lerXSignature(undefined)).toBeNull();
    expect(lerXSignature("ts=1")).toBeNull();
    expect(lerXSignature("lixo")).toBeNull();
  });
});

describe("conferirAssinatura — ACEITA só o que o MP assinou", () => {
  it("assinatura correta passa", () => {
    const r = conferir();
    expect(r.valida).toBe(true);
  });

  it("id alfanumérico entra no manifest em minúsculas", () => {
    const r = conferirAssinatura({
      xSignature: assinar("ABC123XYZ"),
      xRequestId: REQUEST_ID,
      dataId: "ABC123XYZ",
      secret: SECRET,
      agora: AGORA,
    });
    expect(r.valida).toBe(true);
  });
});

describe("conferirAssinatura — RECUSA", () => {
  it("segredo errado", () => {
    const r = conferir({ xSignature: assinar("123456", undefined, "outro-segredo") });
    expect(r.valida).toBe(false);
    expect(r.motivo).toBe("assinatura não confere");
  });

  it("corpo trocado por outro id (o ataque óbvio: pagar o id de outro)", () => {
    const r = conferir({ dataId: "999999" });
    expect(r.valida).toBe(false);
    expect(r.motivo).toBe("assinatura não confere");
  });

  it("request-id trocado", () => {
    const r = conferir({ xRequestId: "outro-request-id" });
    expect(r.valida).toBe(false);
  });

  it("sem x-signature", () => {
    expect(conferir({ xSignature: undefined }).valida).toBe(false);
    expect(conferir({ xSignature: "" }).motivo).toBe("x-signature ausente ou malformado");
  });

  it("sem data.id", () => {
    expect(conferir({ dataId: null }).motivo).toBe("notificação sem data.id na query");
  });

  it("sem segredo configurado NÃO passa — ausência de chave não é permissão", () => {
    const r = conferir({ secret: undefined });
    expect(r.valida).toBe(false);
    expect(r.motivo).toBe("MP_WEBHOOK_SECRET não configurado");
  });

  it("notificação velha, fora da janela", () => {
    const velho = Math.floor(AGORA.getTime() / 1000) - IDADE_MAXIMA_S - 60;
    const r = conferir({ xSignature: assinar("123456", velho) });
    expect(r.valida).toBe(false);
    expect(r.motivo).toContain("fora da janela");
  });

  it("ts que não é número", () => {
    expect(conferir({ xSignature: "ts=agora,v1=abc" }).motivo).toBe("ts inválido no x-signature");
  });

  it("v1 de tamanho diferente não quebra a comparação", () => {
    expect(conferir({ xSignature: "ts=" + Math.floor(AGORA.getTime() / 1000) + ",v1=curto" }).valida).toBe(false);
  });
});

describe("tipoNotificacao", () => {
  it("reconhece os três que importam", () => {
    expect(tipoNotificacao({ type: "payment" })).toBe("payment");
    expect(tipoNotificacao({ type: "subscription_preapproval" })).toBe("subscription_preapproval");
    // Este é o que o webhook antigo ignorava — é o da cobrança mensal do cartão.
    expect(tipoNotificacao({ type: "subscription_authorized_payment" })).toBe("subscription_authorized_payment");
  });
  it("aceita os nomes curtos que o MP também manda (topic)", () => {
    expect(tipoNotificacao({ topic: "preapproval" })).toBe("subscription_preapproval");
    expect(tipoNotificacao({ topic: "authorized_payment" })).toBe("subscription_authorized_payment");
  });
  it("o que não conhecemos é null, não um palpite", () => {
    expect(tipoNotificacao({ type: "plan" })).toBeNull();
    expect(tipoNotificacao({})).toBeNull();
  });
});
