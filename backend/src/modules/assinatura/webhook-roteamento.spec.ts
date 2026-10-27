/**
 * Para onde vai cada notificação do Mercado Pago.
 *
 * Isto existe por causa de um furo real deste código: uma cobrança mensal de
 * cartão chega ao webhook por DOIS tópicos — `payment` e
 * `subscription_authorized_payment`. Na primeira versão os dois concediam mês,
 * e um pagamento de R$ 11,90 virava DOIS meses de acesso. Sem erro no log,
 * porque os ids são diferentes e a trava de idempotência é por cobrança: ela
 * não tinha como saber que os dois eventos eram o mesmo dinheiro.
 *
 * Regra que estes testes travam: Pix se resolve por `payment`, cartão se
 * resolve por `subscription_authorized_payment`, e nunca os dois pelo mesmo
 * dinheiro.
 */
jest.mock("nodemailer", () => ({}), { virtual: true });
import "reflect-metadata";
import { AssinaturaService } from "./assinatura.module";
import { VALOR_MENSALIDADE } from "../auth/trial-renovacao";

const D = 24 * 60 * 60 * 1000;
const AGORA = new Date("2026-10-27T12:00:00Z");

function montar() {
  const users = [{
    id: "u1", nome: "ana silva", email: "a@x.com", cpf: null, organizationId: "org",
    isTrial: true, trialModulo: "one-desk", trialExpiraEm: new Date(AGORA.getTime() - 60 * D),
    assinaturaEm: new Date(AGORA.getTime() - 30 * D),
    assinaturaValidaAte: new Date(AGORA.getTime() + 2 * D),
    trialLembreteEm: null, assinaturaRenovacaoAuto: true,
    assinaturaPreapprovalId: "pre-123",
    profile: { whatsapp: "5514999990000" },
  }];
  const cobrancas: any[] = [];
  let seq = 0;

  const tabela = {
    findUnique: jest.fn(async ({ where }: any) => cobrancas.find((c) => c.id === where.id) || null),
    findFirst: jest.fn(async ({ where }: any) => {
      if (where.mpPaymentId) return cobrancas.find((c) => c.mpPaymentId === where.mpPaymentId) || null;
      if (where.OR) {
        return cobrancas.find((c) =>
          where.OR.some((o: any) => (o.mpPaymentId && c.mpPaymentId === o.mpPaymentId) || (o.id && c.id === o.id)),
        ) || null;
      }
      return null;
    }),
    findMany: jest.fn(async ({ where }: any) =>
      cobrancas.filter((c) => c.userId === where.userId && c.ciclo === where.ciclo && c.status === where.status)),
    create: jest.fn(async ({ data }: any) => {
      const c = { id: `c${++seq}`, meio: null, pagoEm: null, validadeConcedidaAte: null, expiraEm: null, pixQrCode: null, ...data };
      cobrancas.push(c);
      return c;
    }),
    update: jest.fn(async ({ where, data }: any) => Object.assign(cobrancas.find((c) => c.id === where.id)!, data)),
    updateMany: jest.fn(async ({ where, data }: any) => {
      const c = cobrancas.find((x) => x.id === where.id);
      if (!c) return { count: 0 };
      if ("validadeConcedidaAte" in where && where.validadeConcedidaAte === null && c.validadeConcedidaAte) return { count: 0 };
      Object.assign(c, data);
      return { count: 1 };
    }),
  };

  const userTabela = {
    findUnique: jest.fn(async ({ where }: any) => users.find((u) => u.id === where.id) || null),
    findFirst: jest.fn(async ({ where }: any) =>
      users.find((u) => (where.assinaturaPreapprovalId ? u.assinaturaPreapprovalId === where.assinaturaPreapprovalId : u.id === where.id)) || null),
    update: jest.fn(async ({ where, data }: any) => Object.assign(users.find((u) => u.id === where.id)!, data)),
  };

  const prisma: any = {
    $transaction: jest.fn(async (fn: any) => fn({ assinaturaCobranca: tabela, user: userTabela })),
    assinaturaCobranca: tabela,
    user: userTabela,
  };

  // Cliente do MP falso. O `payment` 777 é uma cobrança de assinatura: traz
  // `preapproval_id` e NÃO traz external_reference nosso.
  const cliente: any = {
    consultarPagamento: jest.fn(async (id: string) => ({
      id, status: "approved", transaction_amount: VALOR_MENSALIDADE / 100,
      payment_type_id: "credit_card", preapproval_id: "pre-123",
      external_reference: null, date_approved: AGORA.toISOString(),
    })),
    consultarAuthorizedPayment: jest.fn(async (id: string) => ({
      id, preapproval_id: "pre-123", status: "processed",
      payment: { id: "777", status: "approved" },
      transaction_amount: VALOR_MENSALIDADE / 100,
    })),
    consultarPreapproval: jest.fn(async (id: string) => ({
      id, status: "authorized", external_reference: "u1", init_point: "https://mp/x",
    })),
  };

  const wa: any = { resolveInstance: jest.fn(async () => "i"), sendMessage: jest.fn(async () => true) };
  const config: any = { get: jest.fn((k: string) => (k === "APP_URL" ? "https://orkiestri.com" : "TEST-token")) };

  const svc: any = Object.create(AssinaturaService.prototype);
  Object.assign(svc, {
    prisma, config, wa,
    logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    mp: () => cliente, // substitui o cliente real
  });
  return { svc: svc as AssinaturaService, users, cobrancas, cliente, wa };
}

describe("roteamento das notificações do Mercado Pago", () => {
  it("um pagamento de CARTÃO chegando como 'payment' não concede nada", async () => {
    const t = montar();
    await t.svc.processarNotificacao("payment", "777");
    expect(t.cobrancas).toHaveLength(0);
    expect(t.users[0].assinaturaValidaAte.getTime()).toBe(AGORA.getTime() + 2 * D);
  });

  it("o mesmo dinheiro pelos DOIS tópicos concede UM mês só", async () => {
    const t = montar();
    const antes = t.users[0].assinaturaValidaAte.getTime();

    await t.svc.processarNotificacao("subscription_authorized_payment", "ap-900");
    const depoisDoCartao = t.users[0].assinaturaValidaAte.getTime();
    expect(depoisDoCartao).toBeGreaterThan(antes);

    // Agora o MESMO pagamento chega pelo outro tópico.
    await t.svc.processarNotificacao("payment", "777");
    expect(t.users[0].assinaturaValidaAte.getTime()).toBe(depoisDoCartao);
    expect(t.cobrancas).toHaveLength(1);
  });

  it("a MESMA cobrança de cartão notificada duas vezes concede um mês só", async () => {
    const t = montar();
    await t.svc.processarNotificacao("subscription_authorized_payment", "ap-900");
    const depois = t.users[0].assinaturaValidaAte.getTime();
    await t.svc.processarNotificacao("subscription_authorized_payment", "ap-900");
    expect(t.users[0].assinaturaValidaAte.getTime()).toBe(depois);
    expect(t.cobrancas).toHaveLength(1);
  });

  it("cartão em 'recycling': não concede, não cobra e FICA CALADO (o MP ainda tenta)", async () => {
    const t = montar();
    t.cliente.consultarAuthorizedPayment.mockResolvedValue({
      id: "ap-901", preapproval_id: "pre-123", status: "recycling",
      payment: { id: "778", status: "rejected" },
    });
    await t.svc.processarNotificacao("subscription_authorized_payment", "ap-901");
    expect(t.cobrancas).toHaveLength(0);
    expect(t.users[0].assinaturaValidaAte.getTime()).toBe(AGORA.getTime() + 2 * D);
    // Alarmar a cada tentativa assustaria quem vai ser cobrado sem problema.
    expect(t.wa.sendMessage).not.toHaveBeenCalled();
  });

  it("cartão recusado em definitivo avisa a pessoa, com o caminho do Pix", async () => {
    const t = montar();
    t.cliente.consultarAuthorizedPayment.mockResolvedValue({
      id: "ap-902", preapproval_id: "pre-123", status: "cancelled",
      payment: { id: "779", status: "rejected" },
    });
    await t.svc.processarNotificacao("subscription_authorized_payment", "ap-902");

    const texto = t.wa.sendMessage.mock.calls[0]?.[1] || "";
    expect(texto).toContain("Não conseguimos cobrar no seu cartão");
    expect(texto).toContain("https://orkiestri.com/assinatura/");
    // Recusa não tira o acesso que já estava pago.
    expect(t.users[0].assinaturaValidaAte.getTime()).toBe(AGORA.getTime() + 2 * D);
    expect(t.cobrancas).toHaveLength(0);
  });

  it("Pix: o external_reference é a nossa cobrança, e ela é aplicada", async () => {
    const t = montar();
    t.cobrancas.push({
      id: "c-pix", userId: "u1", valor: VALOR_MENSALIDADE, ciclo: "2026-11", meio: "pix",
      status: "pendente", mpPaymentId: "555", pagoEm: null, validadeConcedidaAte: null,
    });
    t.cliente.consultarPagamento.mockResolvedValue({
      id: "555", status: "approved", transaction_amount: VALOR_MENSALIDADE / 100,
      payment_type_id: "bank_transfer", external_reference: "c-pix",
      preapproval_id: null, date_approved: AGORA.toISOString(),
    });

    await t.svc.processarNotificacao("payment", "555");
    expect(t.cobrancas[0].status).toBe("pago");
    expect(t.cobrancas[0].validadeConcedidaAte).toBeTruthy();
    expect(t.users[0].assinaturaValidaAte.getTime()).toBeGreaterThan(AGORA.getTime() + 2 * D);
  });

  it("Pix recusado marca a cobrança e NÃO toca no acesso", async () => {
    const t = montar();
    t.cobrancas.push({
      id: "c-pix", userId: "u1", valor: VALOR_MENSALIDADE, ciclo: "2026-11", meio: "pix",
      status: "pendente", mpPaymentId: "556", pagoEm: null, validadeConcedidaAte: null,
    });
    t.cliente.consultarPagamento.mockResolvedValue({
      id: "556", status: "rejected", transaction_amount: VALOR_MENSALIDADE / 100,
      external_reference: "c-pix", preapproval_id: null,
    });

    await t.svc.processarNotificacao("payment", "556");
    expect(t.cobrancas[0].status).toBe("cancelado");
    expect(t.cobrancas[0].validadeConcedidaAte).toBeNull();
    expect(t.users[0].assinaturaValidaAte.getTime()).toBe(AGORA.getTime() + 2 * D);
  });

  it("preapproval autorizado liga a renovação automática na conta", async () => {
    const t = montar();
    t.users[0].assinaturaRenovacaoAuto = false;
    await t.svc.processarNotificacao("subscription_preapproval", "pre-123");
    expect(t.users[0].assinaturaRenovacaoAuto).toBe(true);
    expect(t.users[0].assinaturaPreapprovalId).toBe("pre-123");
  });

  it("preapproval cancelado desliga a renovação automática", async () => {
    const t = montar();
    t.cliente.consultarPreapproval.mockResolvedValue({ id: "pre-123", status: "cancelled", external_reference: "u1" });
    await t.svc.processarNotificacao("subscription_preapproval", "pre-123");
    expect(t.users[0].assinaturaRenovacaoAuto).toBe(false);
    // Cancelar o cartão não tira o acesso já pago.
    expect(t.users[0].assinaturaValidaAte.getTime()).toBe(AGORA.getTime() + 2 * D);
  });

  it("tópico desconhecido não faz nada", async () => {
    const t = montar();
    await t.svc.processarNotificacao("plan", "qualquer");
    expect(t.cobrancas).toHaveLength(0);
  });
});
