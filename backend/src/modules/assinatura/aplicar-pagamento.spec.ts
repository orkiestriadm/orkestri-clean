/**
 * `AssinaturaService.aplicarPagamentoConfirmado` — a única porta de entrada do
 * acesso pago, com banco e WhatsApp falsos.
 *
 * O teste que importa mais aqui é o da REPETIÇÃO. O Mercado Pago reenvia
 * notificação como regra (retentativa, reenvio manual pelo painel, o mesmo
 * evento chegando por dois tópicos). Se esta função não for idempotente, o
 * mesmo pagamento de R$ 11,90 vira dois meses de acesso — e ninguém percebe,
 * porque nada dá erro.
 */
jest.mock("nodemailer", () => ({}), { virtual: true });
import "reflect-metadata";
import { AssinaturaService } from "./assinatura.module";
import { somarUmMes, VALOR_MENSALIDADE } from "../auth/trial-renovacao";

const H = 60 * 60 * 1000;
const D = 24 * H;
const AGORA = new Date("2026-10-27T12:00:00Z");
const em = (ms: number) => new Date(AGORA.getTime() + ms);

function montar(user: any, cobranca: any = {}) {
  const users = [{
    id: "u1", nome: "fernando bambui", email: "f@x.com", cpf: null, organizationId: "org",
    isTrial: true, trialModulo: "one-space", trialExpiraEm: em(2 * D),
    assinaturaEm: null, assinaturaValidaAte: null, trialLembreteEm: null,
    assinaturaRenovacaoAuto: false, assinaturaPreapprovalId: null,
    profile: { whatsapp: "5514999990000" },
    ...user,
  }];
  const cobrancas = [{
    id: "c1", userId: "u1", valor: VALOR_MENSALIDADE, ciclo: "2026-11", meio: "pix",
    status: "pendente", pagoEm: null, validadeConcedidaAte: null,
    ...cobranca,
  }];

  const tx: any = {
    assinaturaCobranca: {
      findUnique: jest.fn(async ({ where }: any) => cobrancas.find((c) => c.id === where.id) || null),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const c = cobrancas.find((x) => x.id === where.id);
        if (!c) return { count: 0 };
        // É a reserva: só aplica quem encontrar a vaga ainda vazia.
        if ("validadeConcedidaAte" in where && where.validadeConcedidaAte === null && c.validadeConcedidaAte) {
          return { count: 0 };
        }
        Object.assign(c, data);
        return { count: 1 };
      }),
    },
    user: {
      findUnique: jest.fn(async ({ where }: any) => users.find((u) => u.id === where.id) || null),
      update: jest.fn(async ({ where, data }: any) => Object.assign(users.find((u) => u.id === where.id)!, data)),
    },
  };

  const prisma: any = {
    $transaction: jest.fn(async (fn: any) => fn(tx)),
    user: tx.user,
    assinaturaCobranca: tx.assinaturaCobranca,
  };
  const wa: any = { resolveInstance: jest.fn(async () => "orkestri-default"), sendMessage: jest.fn(async () => true) };
  const config: any = { get: jest.fn((k: string) => (k === "APP_URL" ? "https://orkiestri.com" : undefined)) };

  const svc: any = Object.create(AssinaturaService.prototype);
  Object.assign(svc, { prisma, config, wa, logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } });
  return { svc: svc as AssinaturaService, users, cobrancas, wa };
}

describe("aplicarPagamentoConfirmado", () => {
  it("primeiro pagamento: abre a assinatura e conta o mês do FIM DO TESTE", async () => {
    const t = montar({});
    const fimTeste = t.users[0].trialExpiraEm;

    const r = await t.svc.aplicarPagamentoConfirmado("c1", AGORA);

    expect(r).not.toBeNull();
    expect(t.users[0].assinaturaEm).toEqual(AGORA);
    expect(t.users[0].assinaturaValor).toBe(VALOR_MENSALIDADE);
    // Quem paga dois dias antes não perde os dois dias que faltavam.
    expect(t.users[0].assinaturaValidaAte.getTime()).toBe(somarUmMes(fimTeste).getTime());
    expect(t.cobrancas[0].status).toBe("pago");
    expect(t.cobrancas[0].validadeConcedidaAte.getTime()).toBe(t.users[0].assinaturaValidaAte.getTime());
  });

  it("o MESMO webhook de novo NÃO soma outro mês", async () => {
    const t = montar({});
    await t.svc.aplicarPagamentoConfirmado("c1", AGORA);
    const depoisDoPrimeiro = t.users[0].assinaturaValidaAte.getTime();

    const segunda = await t.svc.aplicarPagamentoConfirmado("c1", AGORA);

    expect(segunda).toBeNull();
    expect(t.users[0].assinaturaValidaAte.getTime()).toBe(depoisDoPrimeiro);
  });

  it("duas notificações ao mesmo tempo: uma concede, a outra não faz nada", async () => {
    const t = montar({});
    const [a, b] = await Promise.all([
      t.svc.aplicarPagamentoConfirmado("c1", AGORA),
      t.svc.aplicarPagamentoConfirmado("c1", AGORA),
    ]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(t.users[0].assinaturaValidaAte.getTime()).toBe(somarUmMes(t.users[0].trialExpiraEm).getTime());
  });

  it("renovação: soma do vencimento atual, não de hoje", async () => {
    const vence = em(3 * D);
    const t = montar({ assinaturaEm: em(-30 * D), assinaturaValidaAte: vence, trialExpiraEm: em(-40 * D) });
    await t.svc.aplicarPagamentoConfirmado("c1", AGORA);
    expect(t.users[0].assinaturaValidaAte.getTime()).toBe(somarUmMes(vence).getTime());
    // E não reescreve a data em que a assinatura começou.
    expect(t.users[0].assinaturaEm.getTime()).toBe(em(-30 * D).getTime());
  });

  it("pagou depois de vencer: o mês conta de agora, sem presente retroativo", async () => {
    const t = montar({ assinaturaEm: em(-60 * D), assinaturaValidaAte: em(-5 * D), trialExpiraEm: em(-70 * D) });
    await t.svc.aplicarPagamentoConfirmado("c1", AGORA);
    expect(t.users[0].assinaturaValidaAte.getTime()).toBe(somarUmMes(AGORA).getTime());
  });

  it("avisa a pessoa no WhatsApp com a data até quando vale", async () => {
    const t = montar({});
    await t.svc.aplicarPagamentoConfirmado("c1", AGORA);
    const texto = t.wa.sendMessage.mock.calls[0][1];
    expect(texto).toContain("Pagamento confirmado");
    expect(texto).toContain("29/11/2026"); // fim do teste 29/10 + um mês
  });

  it("cobrança que não existe não derruba nada", async () => {
    const t = montar({});
    expect(await t.svc.aplicarPagamentoConfirmado("não-existe", AGORA)).toBeNull();
  });

  it("cobrança já aplicada antes (validade gravada) é ignorada de saída", async () => {
    const t = montar({}, { validadeConcedidaAte: em(30 * D), status: "pago" });
    expect(await t.svc.aplicarPagamentoConfirmado("c1", AGORA)).toBeNull();
    expect(t.users[0].assinaturaValidaAte).toBeNull();
  });
});
