/**
 * A Aurélia é a única porta de entrada, e toda conta que nasce por ela entra no
 * ciclo de cobrança.
 *
 * O que este arquivo trava é uma falha que não dava erro nenhum: a conta criada
 * pelo WhatsApp nascia sem `trialExpiraEm`, e `faseDaConta` devolve null nesse
 * caso. Sem fase, a pessoa não recebia aviso de vencimento, não recebia
 * cobrança e o acesso nunca terminava — de graça, para sempre, com todos os
 * módulos. A cobrança só alcançava quem entrava pelo modal do site, que agora
 * está fechado.
 */
jest.mock("nodemailer", () => ({}), { virtual: true });
import "reflect-metadata";
import { AuthService } from "./auth.service";
import {
  DIAS_DE_TESTE,
  PRODUTO_PADRAO,
  fimDoTeste,
  faseDaConta,
  acessoVencido,
  marcoDoAviso,
} from "./trial-renovacao";

const D = 24 * 60 * 60 * 1000;

/** O usuário exatamente como o cadastro pela Aurélia passa a criar. */
const contaNovaPelaAurelia = (agora: Date) => ({
  isTrial: true,
  trialModulo: PRODUTO_PADRAO,
  trialExpiraEm: fimDoTeste(agora),
  assinaturaEm: null,
  assinaturaValidaAte: null,
  trialLembreteEm: null,
  assinaturaRenovacaoAuto: false,
});

describe("a conta que nasce pela Aurélia", () => {
  const agora = new Date("2026-10-28T12:00:00Z");

  it("entra no ciclo de cobrança, com o teste correndo", () => {
    const f = faseDaConta(contaNovaPelaAurelia(agora) as any);

    expect(f).not.toBeNull();
    expect(f!.fase).toBe("TESTE");
    expect(f!.limite.getTime()).toBe(agora.getTime() + DIAS_DE_TESTE * D);
  });

  it("o teste dura 7 dias", () => {
    expect(DIAS_DE_TESTE).toBe(7);
    expect(fimDoTeste(agora).getTime() - agora.getTime()).toBe(7 * D);
  });

  it("no dia do cadastro o acesso vale, e no fim do prazo vence", () => {
    const u = contaNovaPelaAurelia(agora);
    expect(acessoVencido(u as any, agora)).toBe(false);
    expect(acessoVencido(u as any, new Date(agora.getTime() + 8 * D))).toBe(true);
  });

  it("a Aurélia tem quando avisar: 3 dias antes, 1 dia antes e no dia", () => {
    const u = contaNovaPelaAurelia(agora);
    const limite = u.trialExpiraEm.getTime();
    const antes = (ms: number) => marcoDoAviso(u as any, new Date(limite - ms));

    expect([antes(3 * D), antes(1 * D), antes(60 * 60 * 1000)]).toEqual([3, 1, 0]);
  });

  it("no instante em que vence, o aviso não sai mais — chegaria depois do fato", () => {
    const u = contaNovaPelaAurelia(agora);
    expect(marcoDoAviso(u as any, u.trialExpiraEm)).toBeNull();
  });

  it("quem está no cartão não é avisado: o Mercado Pago cobra sozinho", () => {
    const noCartao = { ...contaNovaPelaAurelia(agora), assinaturaRenovacaoAuto: true };
    const umDiaAntes = new Date(noCartao.trialExpiraEm.getTime() - D);
    expect(marcoDoAviso(noCartao as any, umDiaAntes)).toBeNull();
  });

  it("COMO ERA ANTES: sem data de fim, a conta ficava fora do ciclo", () => {
    // Era este o estado de quem se cadastrava pelo WhatsApp: nenhum aviso,
    // nenhuma cobrança, acesso sem fim.
    const comoEraAntes = { ...contaNovaPelaAurelia(agora), isTrial: false, trialExpiraEm: null };
    expect(faseDaConta(comoEraAntes as any)).toBeNull();

    // E marcar isTrial sem data também não resolve — é a data que liga o ciclo.
    const soAFlag = { ...comoEraAntes, isTrial: true };
    expect(faseDaConta(soAFlag as any)).toBeNull();
  });
});

describe("a porta do site está fechada", () => {
  const svc: any = Object.create(AuthService.prototype);

  it("pedir teste pelo site devolve o caminho do WhatsApp, não uma conta", async () => {
    await expect(svc.iniciarTrial({ email: "a@b.com", whatsapp: "5514999990000", produto: "one-space" }))
      .rejects.toThrow(/wa\.me/);
  });

  it("confirmar código pelo site também não cria conta", async () => {
    await expect(svc.confirmarTrial({ whatsapp: "5514999990000", codigo: "123456" }))
      .rejects.toThrow(/wa\.me/);
  });

  it("a recusa diz quantos dias de teste a pessoa vai ganhar", async () => {
    await expect(svc.iniciarTrial({ email: "a@b.com", whatsapp: "5514999990000", produto: "one-space" }))
      .rejects.toThrow(new RegExp(`${DIAS_DE_TESTE} dias`));
  });
});
