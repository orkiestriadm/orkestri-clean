/**
 * Fluxo da resposta ao aviso de vencimento, com banco e WhatsApp falsos:
 * no teste, "1" efetiva (uma vez só) e abre o primeiro mês; na mensalidade,
 * "1" soma um mês; "2" registra a recusa; "1" de quem não recebeu o aviso não
 * é tratado como renovação.
 */
jest.mock("nodemailer", () => ({}), { virtual: true });
import "reflect-metadata";
import { WhatsappInboundService } from "./whatsapp-inbound.module";
import { codigoRenovacao, somarUmMes } from "../auth/trial-renovacao";

const ORG = "00000000-0000-0000-0000-000000000001";
const TEL = "5514999990000";
const H = 60 * 60 * 1000;
const D = 24 * H;

function montar(user: any) {
  const u = { ...user };
  const prisma: any = {
    userProfile: {
      findFirst: jest.fn(async () => null),
      findMany: jest.fn(async () => [{ whatsapp: TEL, user: { id: u.id, organizationId: ORG, ativo: true, nome: u.nome } }]),
      upsert: jest.fn(async () => ({})),
    },
    user: {
      findUnique: jest.fn(async () => ({ ...u, profile: { whatsapp: TEL } })),
      findMany: jest.fn(async () => [{ ...u, profile: { whatsapp: TEL } }]),
      update: jest.fn(async ({ data }: any) => Object.assign(u, data)),
      updateMany: jest.fn(async ({ where, data }: any) => {
        if ("assinaturaEm" in where && where.assinaturaEm === null && u.assinaturaEm) return { count: 0 };
        if ("assinaturaValidaAte" in where && new Date(where.assinaturaValidaAte).getTime() !== new Date(u.assinaturaValidaAte).getTime()) return { count: 0 };
        Object.assign(u, data); return { count: 1 };
      }),
      count: jest.fn(async () => 0),
    },
  };
  const wa: any = { sendMessageForOrg: jest.fn(async () => true), sendMessage: jest.fn(async () => true), sendToJid: jest.fn(async () => true) };
  const auth: any = { notificarEquipeTrial: jest.fn(async () => {}), resolvePermissions: jest.fn(async () => []) };
  const referral: any = { efetivar: jest.fn(async () => ({ ok: true })) };
  const svc = new WhatsappInboundService(prisma, wa, auth, referral);
  const processar = (key: any, texto: string) =>
    svc.processar({ instance: "orkestri-default", data: { key, message: { conversation: texto } } });
  const msg = (texto: string, jid = `${TEL}@s.whatsapp.net`) => processar({ remoteJid: jid, fromMe: false }, texto);
  const enviado = () => wa.sendMessageForOrg.mock.calls.map((c: any[]) => c[2]).join("\n---\n");
  return { u, prisma, wa, auth, referral, msg, processar, enviado };
}

const trial = (extra: any = {}) => ({
  id: "u1", nome: "fernandobambui", email: "f@x.com", organizationId: ORG, isTrial: true,
  trialExpiraEm: new Date(Date.now() + 10 * H), trialModulo: "one-space",
  assinaturaEm: null, assinaturaValidaAte: null, trialLembreteEm: new Date(Date.now() - H), ...extra,
});
const assinante = (extra: any = {}) => trial({
  trialExpiraEm: new Date(Date.now() - 30 * D), assinaturaEm: new Date(Date.now() - 30 * D),
  assinaturaValidaAte: new Date(Date.now() + 10 * H), ...extra,
});

describe("renovação pelo WhatsApp — fim do teste", () => {
  it("'1' depois do aviso efetiva, abre o 1º mês a partir do fim do teste, responde e avisa a equipe", async () => {
    const t = montar(trial());
    const fimTeste = t.u.trialExpiraEm;
    await t.msg("1");
    expect(t.referral.efetivar).toHaveBeenCalledWith("u1");
    expect(t.u.trialRenovacaoResposta).toBe("RENOVOU");
    expect(t.u.assinaturaEm).toBeInstanceOf(Date);
    expect(t.u.assinaturaValidaAte.getTime()).toBe(somarUmMes(fimTeste).getTime());
    expect(t.enviado()).toContain("Você acaba de ter seu acesso efetivado!");
    expect(t.enviado()).toContain("Valeu, fernandobambui!");
    expect(t.auth.notificarEquipeTrial).toHaveBeenCalledWith("u1", "trial_renovou", expect.any(String), expect.stringContaining("combinar o pagamento"));
  });

  it("'1' repetido não efetiva de novo", async () => {
    const t = montar(trial());
    await t.msg("1");
    await t.msg("1");
    expect(t.referral.efetivar).toHaveBeenCalledTimes(1);
    expect(t.enviado()).toContain("já está renovado");
  });

  it("'2' registra a recusa sem efetivar", async () => {
    const t = montar(trial());
    await t.msg("2");
    expect(t.referral.efetivar).not.toHaveBeenCalled();
    expect(t.u.trialRenovacaoResposta).toBe("RECUSOU");
    expect(t.enviado()).toContain("Se mudar de ideia");
  });

  it("'1' de quem NÃO recebeu o aviso segue o fluxo normal", async () => {
    const t = montar(trial({ trialLembreteEm: null }));
    await t.msg("1");
    expect(t.referral.efetivar).not.toHaveBeenCalled();
  });

  it("'1' digitado no celular do bot (fromMe) não efetiva", async () => {
    const t = montar(trial());
    await t.processar({ remoteJid: `${TEL}@s.whatsapp.net`, fromMe: true }, "1");
    expect(t.referral.efetivar).not.toHaveBeenCalled();
  });

  it("'1' de conta que não é teste não vira renovação", async () => {
    const t = montar(trial({ isTrial: false }));
    await t.msg("1");
    expect(t.referral.efetivar).not.toHaveBeenCalled();
  });

  it("LID desconhecido com o código do aviso efetiva e liga o LID", async () => {
    const t = montar(trial());
    t.prisma.userProfile.findMany.mockResolvedValue([]);
    await t.msg(`RENOVAR ${codigoRenovacao("u1")}`, "123456789@lid");
    expect(t.referral.efetivar).toHaveBeenCalledWith("u1");
    expect(t.prisma.userProfile.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { whatsappLid: "123456789" } }));
  });

  it("LID desconhecido, mas o v2 manda o telefone no remoteJidAlt: '1' funciona", async () => {
    const t = montar(trial());
    await t.processar({ remoteJid: "999@lid", remoteJidAlt: `${TEL}@s.whatsapp.net` }, "1");
    expect(t.referral.efetivar).toHaveBeenCalledWith("u1");
  });

  it("vencido há mais de 15 dias: não efetiva e avisa a equipe", async () => {
    const t = montar(trial({ trialExpiraEm: new Date(Date.now() - 16 * D) }));
    await t.msg("1");
    expect(t.referral.efetivar).not.toHaveBeenCalled();
    expect(t.auth.notificarEquipeTrial).toHaveBeenCalledWith("u1", "renovacao_fora_prazo", expect.any(String), expect.any(String));
  });
});

describe("renovação pelo WhatsApp — mensalidade", () => {
  it("'1' depois do aviso soma um mês a partir do vencimento, sem nova comissão", async () => {
    const t = montar(assinante());
    const venc = t.u.assinaturaValidaAte;
    await t.msg("1");
    expect(t.referral.efetivar).not.toHaveBeenCalled();
    expect(t.u.assinaturaValidaAte.getTime()).toBe(somarUmMes(venc).getTime());
    expect(t.enviado()).toContain("Assinatura renovada!");
    expect(t.auth.notificarEquipeTrial).toHaveBeenCalledWith("u1", "assinatura_renovou", expect.any(String), expect.any(String));
  });

  it("'1' repetido depois de renovar confirma, sem somar outro mês", async () => {
    const t = montar(assinante());
    await t.msg("1");
    const depois = t.u.assinaturaValidaAte.getTime();
    await t.msg("1");
    expect(t.u.assinaturaValidaAte.getTime()).toBe(depois);
    expect(t.enviado()).toContain("já está renovado");
  });

  it("mensalidade vencida há 3 dias: '1' libera um mês a partir de agora", async () => {
    const t = montar(assinante({ assinaturaValidaAte: new Date(Date.now() - 3 * D), trialLembreteEm: new Date(Date.now() - 4 * D) }));
    const antes = Date.now();
    await t.msg("1");
    expect(t.u.assinaturaValidaAte.getTime()).toBeGreaterThanOrEqual(somarUmMes(new Date(antes)).getTime());
  });

  it("código reenviado no meio do mês não soma meses", async () => {
    const t = montar(assinante({ assinaturaValidaAte: new Date(Date.now() + 20 * D), trialLembreteEm: new Date(Date.now() - 10 * D) }));
    const antes = t.u.assinaturaValidaAte.getTime();
    await t.msg(`RENOVAR ${codigoRenovacao("u1")}`);
    expect(t.u.assinaturaValidaAte.getTime()).toBe(antes);
    expect(t.enviado()).toContain("já está renovado");
  });

  it("'2' na mensalidade registra que não quer renovar", async () => {
    const t = montar(assinante());
    await t.msg("2");
    expect(t.u.trialRenovacaoResposta).toBe("RECUSOU");
    expect(t.enviado()).toContain("Sua assinatura vale até");
    expect(t.auth.notificarEquipeTrial).toHaveBeenCalledWith("u1", "assinatura_recusou", expect.any(String), expect.any(String));
  });

  it("efetivado antes da mensalidade existir (sem validade): '1' solto não mexe em nada", async () => {
    const t = montar(assinante({ assinaturaValidaAte: null }));
    await t.msg("1");
    expect(t.prisma.user.updateMany).not.toHaveBeenCalled();
  });
});
