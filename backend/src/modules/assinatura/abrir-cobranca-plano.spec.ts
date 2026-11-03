/**
 * `AssinaturaService.abrirCobranca` — qual período a cobrança compra e quantas
 * cobranças podem ficar abertas ao mesmo tempo.
 *
 * O invariante que estes testes protegem é "UMA cobrança aberta por pessoa".
 * Até o plano anual existir ele vinha de graça: a busca era por ciclo, e o
 * ciclo do mês que vem era sempre o mesmo. Com dois prazos isso deixou de
 * valer — um "1" e um "3" do mesmo dia caem em ciclos diferentes (o mês que
 * vem e o ano que vem) e, sem a regra nova, as duas cobranças ficariam de pé,
 * com dois Pix na mesma conversa e a chance real de alguém pagar os dois.
 */
jest.mock("nodemailer", () => ({}), { virtual: true });
import "reflect-metadata";
import { AssinaturaService } from "./assinatura.module";
import { VALOR_MENSALIDADE, VALOR_ANUAL } from "../auth/trial-renovacao";

const H = 60 * 60 * 1000;
const D = 24 * H;
const AGORA = new Date("2026-11-03T12:00:00Z");
const em = (ms: number) => new Date(AGORA.getTime() + ms);

function montar(cobrancasIniciais: any[] = []) {
  const user = {
    id: "u1", nome: "sebastian", email: "s@x.com", cpf: null, organizationId: "org",
    isTrial: true, trialModulo: "one-space", trialExpiraEm: em(2 * D),
    assinaturaEm: null, assinaturaValidaAte: null, trialLembreteEm: null,
    assinaturaRenovacaoAuto: false, assinaturaPreapprovalId: null,
    profile: { whatsapp: "5514999990000" },
  };
  const cobrancas: any[] = [...cobrancasIniciais];
  let seq = cobrancas.length;

  const prisma: any = {
    user: { findUnique: jest.fn(async () => user) },
    assinaturaCobranca: {
      findMany: jest.fn(async ({ where }: any) =>
        cobrancas.filter((c) => c.userId === where.userId && c.status === where.status),
      ),
      create: jest.fn(async ({ data }: any) => {
        const nova = { id: `c${++seq}`, pixQrCode: null, expiraEm: null, criadoEm: AGORA, ...data };
        cobrancas.push(nova);
        return nova;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const c = cobrancas.find((x) => x.id === where.id);
        Object.assign(c, data);
        return c;
      }),
    },
  };

  const svc: any = Object.create(AssinaturaService.prototype);
  Object.assign(svc, {
    prisma,
    config: { get: jest.fn(() => "https://orkiestri.com") },
    wa: {},
    logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
  });
  return { svc: svc as AssinaturaService, cobrancas, prisma };
}

const pendente = (extra: any = {}) => ({
  id: "c1", userId: "u1", valor: VALOR_MENSALIDADE, plano: "MENSAL", ciclo: "2026-12",
  status: "pendente", pixQrCode: null, expiraEm: null, criadoEm: AGORA, ...extra,
});

describe("abrirCobranca — plano e período", () => {
  it("mensal: valor da mensalidade e ciclo do mês que vem", async () => {
    const t = montar();
    const { cobranca } = await (t.svc as any).abrirCobranca("u1", "MENSAL", AGORA);
    expect(cobranca.valor).toBe(VALOR_MENSALIDADE);
    expect(cobranca.plano).toBe("MENSAL");
    // Fim do teste é 05/11; mais um mês cai em dezembro.
    expect(cobranca.ciclo).toBe("2026-12");
  });

  it("anual: valor do ano e ciclo doze meses à frente", async () => {
    const t = montar();
    const { cobranca } = await (t.svc as any).abrirCobranca("u1", "ANUAL", AGORA);
    expect(cobranca.valor).toBe(VALOR_ANUAL);
    expect(cobranca.plano).toBe("ANUAL");
    expect(cobranca.ciclo).toBe("2027-11");
  });

  it("sem plano, continua mensal — chamada antiga segue valendo", async () => {
    const t = montar();
    const { cobranca } = await (t.svc as any).abrirCobranca("u1", undefined, AGORA);
    expect(cobranca.plano).toBe("MENSAL");
    expect(cobranca.valor).toBe(VALOR_MENSALIDADE);
  });

  it("o mesmo plano duas vezes reaproveita a cobrança, sem gerar outro Pix", async () => {
    const t = montar([pendente()]);
    const r = await (t.svc as any).abrirCobranca("u1", "MENSAL", AGORA);
    expect(r.reaproveitada).toBe(true);
    expect(r.cobranca.id).toBe("c1");
    expect(t.prisma.assinaturaCobranca.create).not.toHaveBeenCalled();
  });

  it("trocar de plano cancela a anterior e deixa UMA aberta", async () => {
    const t = montar([pendente()]);

    const r = await (t.svc as any).abrirCobranca("u1", "ANUAL", AGORA);

    expect(r.reaproveitada).toBe(false);
    expect(r.cobranca.plano).toBe("ANUAL");
    // A anterior saiu de cena — senão ficariam dois Pix na mesma conversa.
    expect(t.cobrancas.find((c) => c.id === "c1").status).toBe("cancelado");
    expect(t.cobrancas.filter((c) => c.status === "pendente")).toHaveLength(1);
  });

  it("trocar de volta para o mensal também deixa só uma aberta", async () => {
    const t = montar([pendente({ plano: "ANUAL", valor: VALOR_ANUAL, ciclo: "2027-11" })]);

    const r = await (t.svc as any).abrirCobranca("u1", "MENSAL", AGORA);

    expect(r.cobranca.plano).toBe("MENSAL");
    expect(t.cobrancas.filter((c) => c.status === "pendente")).toHaveLength(1);
    expect(t.cobrancas.filter((c) => c.status === "pendente")[0].valor).toBe(VALOR_MENSALIDADE);
  });

  it("cobrança pendente VENCIDA não é reaproveitada nem cancelada à toa", async () => {
    // Pix expirado: não conta como aberta, e a nova nasce normalmente.
    const t = montar([pendente({ expiraEm: em(-1 * H) })]);
    const r = await (t.svc as any).abrirCobranca("u1", "MENSAL", AGORA);
    expect(r.reaproveitada).toBe(false);
    expect(t.prisma.assinaturaCobranca.create).toHaveBeenCalled();
  });

  it("pendente sem a coluna plano conta como mensal e é reaproveitada pelo mensal", async () => {
    const t = montar([pendente({ plano: undefined })]);
    const r = await (t.svc as any).abrirCobranca("u1", "MENSAL", AGORA);
    expect(r.reaproveitada).toBe(true);
  });
});
