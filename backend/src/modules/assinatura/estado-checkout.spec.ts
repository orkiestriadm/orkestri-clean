/**
 * `AssinaturaService.estadoCheckout` — o que a página de pagamento recebe.
 *
 * O caso que dá nome a este arquivo é o `ultimoPagamento`. No primeiro
 * pagamento real (27/10/2026), a tela só dizia "confirmado" enquanto a aba
 * ficava aberta: quem pagava e recarregava voltava a ver o botão de pagar,
 * sem nenhum sinal de que o dinheiro tinha entrado. O próximo passo natural
 * de quem acha que falhou é pagar o mesmo mês outra vez.
 */
jest.mock("nodemailer", () => ({}), { virtual: true });
import "reflect-metadata";
import { AssinaturaService } from "./assinatura.module";
import { tokenCheckout } from "./checkout-token";
import { VALOR_MENSALIDADE } from "../auth/trial-renovacao";

const D = 24 * 60 * 60 * 1000;
const AGORA = new Date("2026-10-27T12:00:00Z");
const em = (ms: number) => new Date(AGORA.getTime() + ms);

function montar(user: any = {}, cobrancas: any[] = []) {
  const u = {
    id: "u1", nome: "fernando bambui", email: "f@x.com", cpf: null, organizationId: "org",
    isTrial: true, trialModulo: "one-space", trialExpiraEm: em(2 * D),
    assinaturaEm: null, assinaturaValidaAte: null, trialLembreteEm: null,
    assinaturaRenovacaoAuto: false, assinaturaPreapprovalId: null,
    profile: { whatsapp: "5514999990000" },
    ...user,
  };

  const prisma: any = {
    user: { findUnique: jest.fn(async () => u) },
    assinaturaCobranca: {
      findMany: jest.fn(async ({ where }: any) =>
        cobrancas.filter((c) => c.status === where.status && c.ciclo === where.ciclo),
      ),
      findFirst: jest.fn(async ({ where }: any) =>
        cobrancas
          .filter((c) => c.status === where.status && c.validadeConcedidaAte)
          .sort((a, b) => b.validadeConcedidaAte.getTime() - a.validadeConcedidaAte.getTime())[0] || null,
      ),
    },
  };
  const config: any = { get: jest.fn((k: string) => (k === "APP_URL" ? "https://orkiestri.com" : undefined)) };

  const svc: any = Object.create(AssinaturaService.prototype);
  Object.assign(svc, { prisma, config, wa: {}, logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } });
  return svc as AssinaturaService;
}

const paga = (over: any = {}) => ({
  id: "c1", userId: "u1", valor: VALOR_MENSALIDADE, ciclo: "2026-11", meio: "pix",
  status: "pago", pagoEm: em(-2 * 60 * 60 * 1000), validadeConcedidaAte: em(30 * D),
  pixQrCode: null, expiraEm: null, ...over,
});

describe("estadoCheckout — ultimoPagamento", () => {
  it("sem nenhum pagamento, vem null (nada a confirmar na tela)", async () => {
    const svc = montar();
    const e: any = await svc.estadoCheckout(tokenCheckout("u1"), AGORA);
    expect(e.ultimoPagamento).toBeNull();
  });

  it("depois de pagar, a tela tem como dizer QUANTO, QUANDO e ATÉ QUANDO", async () => {
    const svc = montar({}, [paga()]);
    const e: any = await svc.estadoCheckout(tokenCheckout("u1"), AGORA);

    expect(e.ultimoPagamento).toEqual({
      pagoEm: em(-2 * 60 * 60 * 1000),
      valorCentavos: VALOR_MENSALIDADE,
      meio: "pix",
      liberouAte: em(30 * D),
    });
  });

  it("com vários meses pagos, vale o que foi mais longe — é ele que sustenta o acesso", async () => {
    const svc = montar({}, [
      paga({ id: "antiga", ciclo: "2026-10", validadeConcedidaAte: em(-10 * D), pagoEm: em(-40 * D) }),
      paga({ id: "atual", validadeConcedidaAte: em(30 * D) }),
    ]);
    const e: any = await svc.estadoCheckout(tokenCheckout("u1"), AGORA);
    expect(e.ultimoPagamento.liberouAte).toEqual(em(30 * D));
  });

  it("cobrança pendente não conta como pagamento — ela é o que falta pagar", async () => {
    const svc = montar({}, [paga({ status: "pendente", validadeConcedidaAte: null, pagoEm: null })]);
    const e: any = await svc.estadoCheckout(tokenCheckout("u1"), AGORA);
    expect(e.ultimoPagamento).toBeNull();
  });

  it("token adulterado não abre a tela de ninguém", async () => {
    const svc = montar({}, [paga()]);
    await expect(svc.estadoCheckout("ZmFrZQ.0000000000000000")).rejects.toThrow();
  });
});
