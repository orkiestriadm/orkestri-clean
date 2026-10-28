/**
 * Agendador do aviso de vencimento (`AuthService.enviarLembretesTrial`), com
 * banco e WhatsApp falsos: manda o aviso certo por fase, uma vez por ciclo, e
 * devolve a marca se o WhatsApp falhar.
 */
jest.mock("nodemailer", () => ({}), { virtual: true });
import "reflect-metadata";
import { AuthService } from "./auth.service";

const H = 60 * 60 * 1000;
const D = 24 * H;
const AGORA = new Date("2026-09-13T12:00:00Z");
const em = (ms: number) => new Date(AGORA.getTime() + ms);

function montar(contas: any[], envioOk = true) {
  const estado = contas.map((c) => ({ ...c }));
  const prisma: any = {
    user: {
      findMany: jest.fn(async () => estado.map((c) => ({ ...c }))),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const c = estado.find((x) => x.id === where.id)!;
        const atual = c.trialLembreteEm ? new Date(c.trialLembreteEm).getTime() : null;
        const esperado = where.trialLembreteEm ? new Date(where.trialLembreteEm).getTime() : null;
        if (atual !== esperado) return { count: 0 };
        Object.assign(c, data); return { count: 1 };
      }),
      update: jest.fn(async ({ where, data }: any) => Object.assign(estado.find((x) => x.id === where.id)!, data)),
    },
  };
  const wa: any = { resolveInstance: jest.fn(async () => "orkestri-default"), sendMessage: jest.fn(async () => envioOk) };
  const svc: any = Object.create(AuthService.prototype);
  Object.assign(svc, { prisma, wa, logger: { warn: jest.fn(), log: jest.fn() }, TRIAL_ORG: "org" });
  return { svc: svc as AuthService, estado, wa };
}

const base = { nome: "fernandobambui", organizationId: "org", isTrial: true, trialModulo: "one-space", profile: { whatsapp: "5514999990000" } };

describe("enviarLembretesTrial", () => {
  it("manda o aviso do teste e o da mensalidade, cada um com seu texto", async () => {
    const t = montar([
      { ...base, id: "t", trialExpiraEm: em(10 * H), assinaturaEm: null, assinaturaValidaAte: null, trialLembreteEm: null },
      { ...base, id: "m", trialExpiraEm: em(-30 * D), assinaturaEm: em(-30 * D), assinaturaValidaAte: em(10 * H), trialLembreteEm: em(-31 * D) },
    ]);
    expect(await t.svc.enviarLembretesTrial(AGORA)).toBe(2);
    const textos = t.wa.sendMessage.mock.calls.map((c: any[]) => c[1]);
    expect(textos[0]).toContain("Seu teste termina amanhã");
    expect(textos[1]).toContain("Sua mensalidade vence amanhã");
    expect(t.estado.every((c) => c.trialLembreteEm?.getTime() === AGORA.getTime())).toBe(true);
  });

  it("não repete na rodada seguinte", async () => {
    const t = montar([{ ...base, id: "t", trialExpiraEm: em(10 * H), assinaturaEm: null, assinaturaValidaAte: null, trialLembreteEm: null }]);
    await t.svc.enviarLembretesTrial(AGORA);
    expect(await t.svc.enviarLembretesTrial(em(H))).toBe(0);
    expect(t.wa.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("WhatsApp falhou: devolve a marca anterior para tentar de novo", async () => {
    const anterior = em(-31 * D);
    const t = montar([{ ...base, id: "m", trialExpiraEm: em(-30 * D), assinaturaEm: em(-30 * D), assinaturaValidaAte: em(10 * H), trialLembreteEm: anterior }], false);
    expect(await t.svc.enviarLembretesTrial(AGORA)).toBe(0);
    expect(t.estado[0].trialLembreteEm.getTime()).toBe(anterior.getTime());
  });
});
