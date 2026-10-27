/**
 * Agendador dos avisos de vencimento (`AuthService.enviarLembretesTrial`), com
 * banco e WhatsApp falsos: manda o aviso certo por fase, três vezes por ciclo
 * (3 dias, 1 dia e no dia), não repete o mesmo aviso e devolve a vaga quando o
 * WhatsApp falha.
 *
 * A trava contra aviso em dobro é a UNIQUE de `assinatura_avisos`, então o banco
 * falso aqui PRECISA recusar a chave repetida — se ele aceitasse tudo, o teste
 * passaria e a produção mandaria dois avisos.
 */
jest.mock("nodemailer", () => ({}), { virtual: true });
import "reflect-metadata";
import { AuthService } from "./auth.service";

const H = 60 * 60 * 1000;
const D = 24 * H;
// 09:00 em Brasília — longe da virada do dia, para os marcos serem estáveis.
const AGORA = new Date("2026-09-13T12:00:00Z");
const em = (ms: number) => new Date(AGORA.getTime() + ms);

const chave = (a: any) => `${a.userId}|${new Date(a.limite).getTime()}|${a.marco}`;

function montar(contas: any[], envioOk = true) {
  const estado = contas.map((c) => ({ ...c }));
  const avisos: any[] = [];

  const prisma: any = {
    user: {
      findMany: jest.fn(async () => estado.filter((c) => !c.assinaturaRenovacaoAuto).map((c) => ({ ...c }))),
      update: jest.fn(async ({ where, data }: any) => Object.assign(estado.find((x) => x.id === where.id)!, data)),
    },
    assinaturaAviso: {
      create: jest.fn(async ({ data }: any) => {
        if (avisos.some((a) => chave(a) === chave(data))) {
          // É o que o Postgres faz com a UNIQUE violada.
          throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        }
        avisos.push({ ...data });
        return { id: String(avisos.length), ...data };
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        const antes = avisos.length;
        for (let i = avisos.length - 1; i >= 0; i--) {
          if (chave(avisos[i]) === chave(where)) avisos.splice(i, 1);
        }
        return { count: antes - avisos.length };
      }),
    },
  };

  const wa: any = { resolveInstance: jest.fn(async () => "orkestri-default"), sendMessage: jest.fn(async () => envioOk) };
  const config: any = { get: jest.fn((k: string) => (k === "APP_URL" ? "https://orkiestri.com" : undefined)) };
  const svc: any = Object.create(AuthService.prototype);
  Object.assign(svc, { prisma, wa, config, logger: { warn: jest.fn(), log: jest.fn() }, TRIAL_ORG: "org" });
  return { svc: svc as AuthService, estado, wa, avisos };
}

const base = {
  nome: "fernandobambui", organizationId: "org", isTrial: true, trialModulo: "one-space",
  assinaturaRenovacaoAuto: false, profile: { whatsapp: "5514999990000" },
};
const noTeste = (extra: any = {}) => ({ ...base, id: "t", trialExpiraEm: em(10 * H), assinaturaEm: null, assinaturaValidaAte: null, trialLembreteEm: null, ...extra });
const naMensalidade = (extra: any = {}) => ({ ...base, id: "m", trialExpiraEm: em(-30 * D), assinaturaEm: em(-30 * D), assinaturaValidaAte: em(D), trialLembreteEm: em(-31 * D), ...extra });

describe("enviarLembretesTrial", () => {
  it("manda o aviso do teste e o da mensalidade, cada um com seu texto", async () => {
    const t = montar([noTeste(), naMensalidade()]);
    expect(await t.svc.enviarLembretesTrial(AGORA)).toBe(2);
    const textos = t.wa.sendMessage.mock.calls.map((c: any[]) => c[1]);
    expect(textos[0]).toContain("Hoje é o último dia do seu teste");
    expect(textos[1]).toContain("Sua mensalidade vence amanhã");
    expect(t.estado.every((c) => c.trialLembreteEm?.getTime() === AGORA.getTime())).toBe(true);
  });

  it("todo aviso leva o link de pagamento, que funciona sem login", async () => {
    const t = montar([noTeste()]);
    await t.svc.enviarLembretesTrial(AGORA);
    expect(t.wa.sendMessage.mock.calls[0][1]).toContain("https://orkiestri.com/assinatura/");
  });

  it("não repete o MESMO aviso na rodada seguinte", async () => {
    const t = montar([noTeste()]);
    await t.svc.enviarLembretesTrial(AGORA);
    expect(await t.svc.enviarLembretesTrial(em(H))).toBe(0);
    expect(t.wa.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("três marcos no mesmo ciclo: 3 dias, 1 dia e no dia", async () => {
    const limite = em(3 * D + 2 * H); // 16/09 em Brasília
    const t = montar([noTeste({ trialExpiraEm: limite })]);

    expect(await t.svc.enviarLembretesTrial(AGORA)).toBe(1);              // faltam 3
    expect(await t.svc.enviarLembretesTrial(em(D))).toBe(0);              // faltam 2 — nada
    expect(await t.svc.enviarLembretesTrial(em(2 * D))).toBe(1);          // falta 1
    expect(await t.svc.enviarLembretesTrial(em(3 * D))).toBe(1);          // hoje
    expect(await t.svc.enviarLembretesTrial(em(3 * D + 3 * H))).toBe(0);  // já venceu

    const textos = t.wa.sendMessage.mock.calls.map((c: any[]) => c[1]);
    expect(textos).toHaveLength(3);
    expect(textos[0]).toContain("Faltam 3 dias");
    expect(textos[1]).toContain("termina amanhã");
    expect(textos[2]).toContain("último dia");
    expect(t.avisos.map((a) => a.marco)).toEqual([3, 1, 0]);
  });

  it("duas rodadas ao mesmo tempo: só uma manda (a UNIQUE decide)", async () => {
    const t = montar([noTeste()]);
    const [a, b] = await Promise.all([
      t.svc.enviarLembretesTrial(AGORA),
      t.svc.enviarLembretesTrial(AGORA),
    ]);
    expect(a + b).toBe(1);
    expect(t.wa.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("WhatsApp falhou: devolve a vaga para a próxima rodada tentar de novo", async () => {
    const t = montar([naMensalidade()], false);
    expect(await t.svc.enviarLembretesTrial(AGORA)).toBe(0);
    expect(t.avisos).toHaveLength(0);
    // E a marca do ciclo não avança, senão um "1" solto passaria a valer sem aviso.
    expect(t.estado[0].trialLembreteEm.getTime()).toBe(em(-31 * D).getTime());
  });

  it("quem está no cartão não recebe aviso nenhum", async () => {
    const t = montar([naMensalidade({ assinaturaRenovacaoAuto: true })]);
    expect(await t.svc.enviarLembretesTrial(AGORA)).toBe(0);
    expect(t.wa.sendMessage).not.toHaveBeenCalled();
  });
});
