/**
 * Painel de billing: a classificação de cada conta e a cortesia.
 *
 * O estado é DERIVADO, nunca guardado. Estes testes existem para garantir que
 * ele continua derivando das mesmas funções que barram a pessoa no login — o
 * dia em que o painel disser "em dia" e o login disser "vencido", a equipe vai
 * acreditar no painel.
 */
jest.mock("nodemailer", () => ({}), { virtual: true });
import "reflect-metadata";
import { AssinaturaService } from "./assinatura.module";
import { VALOR_MENSALIDADE, somarUmMes } from "../auth/trial-renovacao";

const D = 24 * 60 * 60 * 1000;
const AGORA = new Date("2026-10-28T12:00:00Z");
const em = (ms: number) => new Date(AGORA.getTime() + ms);

const conta = (over: any = {}) => ({
  id: "u1", nome: "Fernando Bambui", email: "f@x.com", criadoEm: em(-30 * D),
  isTrial: true, trialExpiraEm: em(3 * D), trialModulo: "one-space",
  assinaturaEm: null, assinaturaValidaAte: null, assinaturaRenovacaoAuto: false,
  organization: { nome: "Bambui Ltda" }, profile: { whatsapp: "5514999990000" },
  ...over,
});

function montar(contas: any[], cobrancas: any[] = []) {
  const prisma: any = {
    user: { findMany: jest.fn(async () => contas), findUnique: jest.fn(async () => contas[0]) },
    assinaturaCobranca: { findMany: jest.fn(async () => cobrancas) },
  };
  const svc: any = Object.create(AssinaturaService.prototype);
  Object.assign(svc, { prisma, config: { get: () => undefined }, wa: {}, logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } });
  return svc as AssinaturaService;
}

const estadoDe = async (over: any, cobrancas: any[] = []) => {
  const r: any = await (montar([conta(over)], cobrancas) as any).painel(AGORA);
  return r.contas[0];
};

describe("painel de billing — em que estado cada conta aparece", () => {
  it("quem está no teste, dentro do prazo, é EM_TESTE", async () => {
    expect((await estadoDe({})).estado).toBe("EM_TESTE");
  });

  it("quem pagou e ainda vale é EM_DIA", async () => {
    const e = await estadoDe({ assinaturaEm: em(-10 * D), assinaturaValidaAte: em(20 * D) });
    expect(e.estado).toBe("EM_DIA");
  });

  it("venceu e ainda dá para pagar: INADIMPLENTE", async () => {
    const e = await estadoDe({ assinaturaEm: em(-40 * D), assinaturaValidaAte: em(-2 * D) });
    expect(e.estado).toBe("INADIMPLENTE");
  });

  it("venceu faz mais de 15 dias: ENCERRADO, porque o link já não vale", async () => {
    const e = await estadoDe({ assinaturaEm: em(-60 * D), assinaturaValidaAte: em(-20 * D) });
    expect(e.estado).toBe("ENCERRADO");
  });

  it("conta sem fase nenhuma é FORA_DO_CICLO, e não 'em dia'", async () => {
    // É o caso das contas antigas e das de cortesia permanente. Mostrá-las
    // como em dia faria a equipe achar que elas pagam.
    const e = await estadoDe({ isTrial: false, trialExpiraEm: null });
    expect(e.estado).toBe("FORA_DO_CICLO");
  });

  it("mostra o último pagamento e o que está pendente", async () => {
    const e = await estadoDe({ assinaturaEm: em(-5 * D), assinaturaValidaAte: em(25 * D) }, [
      { userId: "u1", status: "pago", valor: VALOR_MENSALIDADE, meio: "pix", pagoEm: em(-5 * D), validadeConcedidaAte: em(25 * D) },
      { userId: "u1", status: "pendente", ciclo: "2026-12", meio: null, expiraEm: null },
    ]);
    expect(e.ultimoPagamento).toMatchObject({ valorCentavos: VALOR_MENSALIDADE, meio: "pix" });
    expect(e.cobrancaPendente).toMatchObject({ ciclo: "2026-12" });
    expect(e.totalPagoCentavos).toBe(VALOR_MENSALIDADE);
  });

  it("o resumo conta cada estado uma vez só", async () => {
    const svc: any = montar([
      conta({ id: "a" }),
      conta({ id: "b", assinaturaEm: em(-10 * D), assinaturaValidaAte: em(20 * D) }),
      conta({ id: "c", assinaturaEm: em(-40 * D), assinaturaValidaAte: em(-2 * D) }),
      conta({ id: "d", isTrial: false, trialExpiraEm: null }),
    ]);
    const r = await svc.painel(AGORA);
    expect(r.resumo).toMatchObject({ emTeste: 1, emDia: 1, inadimplentes: 1, foraDoCiclo: 1 });
    expect(r.contas).toHaveLength(4);
  });
});

describe("cortesia", () => {
  function comCortesia(user: any) {
    const u = conta(user);
    const cobrancas: any[] = [];
    const tx: any = {
      assinaturaCobranca: {
        findUnique: jest.fn(async ({ where }: any) => cobrancas.find((c) => c.id === where.id)),
        updateMany: jest.fn(async ({ where, data }: any) => {
          const c = cobrancas.find((x) => x.id === where.id);
          if (!c || c.validadeConcedidaAte) return { count: 0 };
          Object.assign(c, data);
          return { count: 1 };
        }),
      },
      user: {
        findUnique: jest.fn(async () => u),
        update: jest.fn(async ({ data }: any) => Object.assign(u, data)),
      },
    };
    const prisma: any = {
      $transaction: jest.fn(async (fn: any) => fn(tx)),
      user: { findUnique: jest.fn(async () => u), findMany: jest.fn(async () => [u]) },
      assinaturaCobranca: {
        create: jest.fn(async ({ data }: any) => {
          const c = { id: "c" + (cobrancas.length + 1), validadeConcedidaAte: null, pagoEm: null, ...data };
          cobrancas.push(c);
          return c;
        }),
        findMany: jest.fn(async () => cobrancas),
      },
    };
    const svc: any = Object.create(AssinaturaService.prototype);
    Object.assign(svc, {
      prisma, config: { get: () => undefined },
      wa: { resolveInstance: jest.fn(async () => "i"), sendMessage: jest.fn(async () => true) },
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });
    return { svc: svc as AssinaturaService, u, cobrancas };
  }

  it("libera um mês sem pagamento e deixa registro de valor zero", async () => {
    const t = comCortesia({});
    const r: any = await (t.svc as any).liberarCortesia("u1", 1, "cliente antigo", AGORA);

    expect(r.meses).toBe(1);
    expect(t.cobrancas[0]).toMatchObject({ valor: 0, meio: "cortesia", status: "pago" });
    // Conta o mês a partir do FIM do teste, igual a quem paga.
    expect(new Date(t.u.assinaturaValidaAte).getTime()).toBe(somarUmMes(conta({}).trialExpiraEm).getTime());
  });

  it("três meses viram três registros, e não um pulo de data sem rastro", async () => {
    const t = comCortesia({});
    const r: any = await (t.svc as any).liberarCortesia("u1", 3, "parceiro", AGORA);
    expect(r.meses).toBe(3);
    expect(t.cobrancas).toHaveLength(3);
    expect(t.cobrancas.every((c: any) => c.valor === 0)).toBe(true);
  });

  it("não aceita mais de 12 meses de uma vez", async () => {
    const t = comCortesia({});
    const r: any = await (t.svc as any).liberarCortesia("u1", 99, "", AGORA);
    expect(r.meses).toBe(12);
  });

  it("conta fora do ciclo recusa a cortesia, em vez de fingir que concedeu", async () => {
    const t = comCortesia({ isTrial: false, trialExpiraEm: null });
    await expect((t.svc as any).liberarCortesia("u1", 1, "", AGORA)).rejects.toThrow("fora do ciclo");
  });
});
