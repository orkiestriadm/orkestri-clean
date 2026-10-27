/**
 * Fluxo da resposta ao aviso de vencimento, com banco, WhatsApp e Mercado Pago
 * falsos.
 *
 * O que estes testes existem para proteger: o "1" NÃO libera acesso. Ele abre a
 * cobrança e manda os meios de pagamento. Quem estica `assinaturaValidaAte` é o
 * webhook do Mercado Pago, em `AssinaturaService`. Por isso quase todo teste
 * aqui termina conferindo que a validade do acesso NÃO mudou.
 */
jest.mock("nodemailer", () => ({}), { virtual: true });
import "reflect-metadata";
import { WhatsappInboundService } from "./whatsapp-inbound.module";
import { codigoRenovacao } from "../auth/trial-renovacao";

const ORG = "00000000-0000-0000-0000-000000000001";
const TEL = "5514999990000";
const H = 60 * 60 * 1000;
const D = 24 * H;

const PIX_FAKE = "00020126580014br.gov.bcb.pix0136chave-fake-520400005303986540511.90";

function montar(user: any, cobrancaFalha = false) {
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
      updateMany: jest.fn(async ({ data }: any) => { Object.assign(u, data); return { count: 1 }; }),
      count: jest.fn(async () => 0),
    },
  };
  const wa: any = { sendMessageForOrg: jest.fn(async () => true), sendMessage: jest.fn(async () => true), sendToJid: jest.fn(async () => true) };
  const auth: any = { notificarEquipeTrial: jest.fn(async () => {}), resolvePermissions: jest.fn(async () => []) };
  const assinatura: any = {
    prepararCobranca: jest.fn(async () => {
      if (cobrancaFalha) throw new Error("MP fora do ar");
      return {
        texto: "💳 *Falta só o pagamento*\n\nSão *R$ 11,90* pelo próximo mês.\n*Cartão* — https://orkiestri.com/assinatura/tok",
        pixCopiaECola: PIX_FAKE,
        usuario: u,
      };
    }),
  };
  // `cadastroWhats` é consultado a cada mensagem recebida, antes dos comandos.
  // Aqui o teste é de RENOVAÇÃO: o dublê responde "não há cadastro aberto para
  // este número", que é o caminho de quem já tem conta.
  const cadastroWhats: any = { conversaAberta: async () => null, tratarResposta: async () => false };
  const svc = new WhatsappInboundService(prisma, wa, auth, assinatura, cadastroWhats);
  const processar = (key: any, texto: string) =>
    svc.processar({ instance: "orkestri-default", data: { key, message: { conversation: texto } } });
  const msg = (texto: string, jid = `${TEL}@s.whatsapp.net`) => processar({ remoteJid: jid, fromMe: false }, texto);
  const enviado = () => wa.sendMessageForOrg.mock.calls.map((c: any[]) => c[2]).join("\n---\n");
  return { u, prisma, wa, auth, assinatura, msg, processar, enviado };
}

const trial = (extra: any = {}) => ({
  id: "u1", nome: "fernandobambui", email: "f@x.com", organizationId: ORG, isTrial: true,
  trialExpiraEm: new Date(Date.now() + 10 * H), trialModulo: "one-space",
  assinaturaEm: null, assinaturaValidaAte: null, assinaturaRenovacaoAuto: false,
  trialLembreteEm: new Date(Date.now() - H), ...extra,
});
const assinante = (extra: any = {}) => trial({
  trialExpiraEm: new Date(Date.now() - 30 * D), assinaturaEm: new Date(Date.now() - 30 * D),
  assinaturaValidaAte: new Date(Date.now() + 10 * H), ...extra,
});

describe("fim do teste — o '1' cobra, não libera", () => {
  it("'1' depois do aviso abre a cobrança, manda o Pix e NÃO concede acesso", async () => {
    const t = montar(trial());
    await t.msg("1");

    expect(t.assinatura.prepararCobranca).toHaveBeenCalledWith("u1", expect.any(Date));
    expect(t.u.trialRenovacaoResposta).toBe("QUER_PAGAR");
    // O que não pode acontecer de jeito nenhum:
    expect(t.u.assinaturaEm).toBeNull();
    expect(t.u.assinaturaValidaAte).toBeNull();

    expect(t.enviado()).toContain("R$ 11,90");
    expect(t.enviado()).toContain("https://orkiestri.com/assinatura/tok");
    expect(t.enviado()).not.toContain("Não se preocupe com o pagamento");
  });

  it("o copia-e-cola do Pix vai sozinho, em outra mensagem", async () => {
    const t = montar(trial());
    await t.msg("1");
    const mensagens = t.wa.sendMessageForOrg.mock.calls.map((c: any[]) => c[2]);
    expect(mensagens).toHaveLength(2);
    expect(mensagens[1]).toBe(PIX_FAKE);
  });

  it("a equipe é avisada de que ainda falta o pagamento", async () => {
    const t = montar(trial());
    await t.msg("1");
    expect(t.auth.notificarEquipeTrial).toHaveBeenCalledWith(
      "u1", "trial_quer_pagar", expect.any(String),
      expect.stringContaining("só segue quando o pagamento for confirmado"),
    );
  });

  it("'1' repetido manda a MESMA cobrança de novo, sem conceder nada", async () => {
    const t = montar(trial());
    await t.msg("1");
    await t.msg("1");
    expect(t.assinatura.prepararCobranca).toHaveBeenCalledTimes(2);
    expect(t.u.assinaturaValidaAte).toBeNull();
  });

  it("'2' registra a recusa sem cobrar", async () => {
    const t = montar(trial());
    await t.msg("2");
    expect(t.assinatura.prepararCobranca).not.toHaveBeenCalled();
    expect(t.u.trialRenovacaoResposta).toBe("RECUSOU");
    expect(t.enviado()).toContain("Se mudar de ideia");
  });

  it("'1' de quem NÃO recebeu o aviso segue o fluxo normal", async () => {
    const t = montar(trial({ trialLembreteEm: null }));
    await t.msg("1");
    expect(t.assinatura.prepararCobranca).not.toHaveBeenCalled();
  });

  it("'1' digitado no celular do bot (fromMe) não cobra", async () => {
    const t = montar(trial());
    await t.processar({ remoteJid: `${TEL}@s.whatsapp.net`, fromMe: true }, "1");
    expect(t.assinatura.prepararCobranca).not.toHaveBeenCalled();
  });

  it("'1' de conta que não é teste não vira cobrança", async () => {
    const t = montar(trial({ isTrial: false }));
    await t.msg("1");
    expect(t.assinatura.prepararCobranca).not.toHaveBeenCalled();
  });

  it("LID desconhecido com o código do aviso cobra e liga o LID", async () => {
    const t = montar(trial());
    t.prisma.userProfile.findMany.mockResolvedValue([]);
    await t.msg(`RENOVAR ${codigoRenovacao("u1")}`, "123456789@lid");
    expect(t.assinatura.prepararCobranca).toHaveBeenCalledWith("u1", expect.any(Date));
    expect(t.prisma.userProfile.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { whatsappLid: "123456789" } }));
  });

  it("LID desconhecido, mas o v2 manda o telefone no remoteJidAlt: '1' funciona", async () => {
    const t = montar(trial());
    await t.processar({ remoteJid: "999@lid", remoteJidAlt: `${TEL}@s.whatsapp.net` }, "1");
    expect(t.assinatura.prepararCobranca).toHaveBeenCalledWith("u1", expect.any(Date));
  });

  it("vencido há mais de 15 dias: não cobra e avisa a equipe", async () => {
    const t = montar(trial({ trialExpiraEm: new Date(Date.now() - 16 * D) }));
    await t.msg("1");
    expect(t.assinatura.prepararCobranca).not.toHaveBeenCalled();
    expect(t.auth.notificarEquipeTrial).toHaveBeenCalledWith("u1", "renovacao_fora_prazo", expect.any(String), expect.any(String));
  });

  it("cobrança não abriu: diz que o problema é nosso e chama a equipe", async () => {
    const t = montar(trial(), true);
    await t.msg("1");
    expect(t.enviado()).toContain("o problema é do nosso lado");
    expect(t.auth.notificarEquipeTrial).toHaveBeenCalledWith("u1", "cobranca_falhou", expect.any(String), expect.stringContaining("MP fora do ar"));
    expect(t.u.assinaturaValidaAte).toBeNull();
  });
});

describe("mensalidade — o '1' cobra, não soma mês", () => {
  it("'1' depois do aviso abre a cobrança e mantém a validade atual", async () => {
    const t = montar(assinante());
    const venc = t.u.assinaturaValidaAte.getTime();
    await t.msg("1");
    expect(t.assinatura.prepararCobranca).toHaveBeenCalledWith("u1", expect.any(Date));
    expect(t.u.assinaturaValidaAte.getTime()).toBe(venc);
    expect(t.auth.notificarEquipeTrial).toHaveBeenCalledWith("u1", "assinatura_quer_pagar", expect.any(String), expect.any(String));
  });

  it("mensalidade vencida há 3 dias: '1' ainda cobra, dentro dos 15 dias", async () => {
    const t = montar(assinante({ assinaturaValidaAte: new Date(Date.now() - 3 * D), trialLembreteEm: new Date(Date.now() - 4 * D) }));
    await t.msg("1");
    expect(t.assinatura.prepararCobranca).toHaveBeenCalledWith("u1", expect.any(Date));
  });

  it("código reenviado no meio do mês não abre cobrança nenhuma", async () => {
    const t = montar(assinante({ assinaturaValidaAte: new Date(Date.now() + 20 * D), trialLembreteEm: new Date(Date.now() - 10 * D) }));
    await t.msg(`RENOVAR ${codigoRenovacao("u1")}`);
    expect(t.assinatura.prepararCobranca).not.toHaveBeenCalled();
    expect(t.enviado()).toContain("já está renovado");
  });

  it("quem está no cartão não recebe cobrança: o MP cobra sozinho", async () => {
    const t = montar(assinante({ assinaturaRenovacaoAuto: true }));
    await t.msg("1");
    expect(t.assinatura.prepararCobranca).not.toHaveBeenCalled();
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
    expect(t.assinatura.prepararCobranca).not.toHaveBeenCalled();
  });
});
