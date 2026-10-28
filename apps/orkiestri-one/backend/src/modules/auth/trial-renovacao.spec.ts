/**
 * Trava as regras da renovação pelo WhatsApp (teste e mensalidade): em que fase
 * a conta está, quando o aviso sai, o que conta como resposta, até quando dá
 * para renovar e quando o login bloqueia. Sem banco nem WhatsApp.
 */
import {
  faseDaConta, precisaLembrete, podeRenovar, acessoVencido, avisoDoCicloAtual, somarUmMes, proximaValidade,
  interpretarRespostaRenovacao, montarLembrete, montarRespostaEfetivou, montarRespostaRecusou,
  montarRespostaRenovouMes, codigoRenovacao, produtoLabel, ContaRenovavel,
} from "./trial-renovacao";

const H = 60 * 60 * 1000;
const D = 24 * H;
const AGORA = new Date("2026-09-13T12:00:00Z");
const em = (ms: number) => new Date(AGORA.getTime() + ms);

const teste = (extra: Partial<ContaRenovavel> = {}): ContaRenovavel => ({
  isTrial: true, trialExpiraEm: em(10 * H), assinaturaEm: null, assinaturaValidaAte: null, trialLembreteEm: null, ...extra,
});
const mensal = (extra: Partial<ContaRenovavel> = {}): ContaRenovavel => ({
  isTrial: true, trialExpiraEm: em(-30 * D), assinaturaEm: em(-30 * D), assinaturaValidaAte: em(10 * H), trialLembreteEm: null, ...extra,
});

describe("faseDaConta", () => {
  it("teste, mensal, legado (efetivado sem validade) e conta comum", () => {
    expect(faseDaConta(teste())?.fase).toBe("TESTE");
    expect(faseDaConta(mensal())?.fase).toBe("MENSAL");
    expect(faseDaConta(mensal({ assinaturaValidaAte: null }))).toBeNull();
    expect(faseDaConta(teste({ isTrial: false }))).toBeNull();
  });
});

describe("acessoVencido — o que o login bloqueia", () => {
  it("teste vencido sem efetivar bloqueia; efetivado com mês em dia não", () => {
    expect(acessoVencido(teste({ trialExpiraEm: em(-H) }), AGORA)).toBe(true);
    expect(acessoVencido(mensal({ trialExpiraEm: em(-H), assinaturaValidaAte: em(20 * D) }), AGORA)).toBe(false);
  });
  it("mês pago vencido bloqueia; legado sem validade nunca bloqueia", () => {
    expect(acessoVencido(mensal({ assinaturaValidaAte: em(-H) }), AGORA)).toBe(true);
    expect(acessoVencido(mensal({ assinaturaValidaAte: null }), AGORA)).toBe(false);
  });
});

describe("precisaLembrete — janela de 24 h, uma vez por ciclo", () => {
  it("teste e mensal: falta menos de um dia", () => {
    expect(precisaLembrete(teste({ trialExpiraEm: em(23 * H) }), AGORA)).toBe(true);
    expect(precisaLembrete(mensal({ assinaturaValidaAte: em(D) }), AGORA)).toBe(true);
  });
  it("falta mais de um dia ou já venceu: não", () => {
    expect(precisaLembrete(teste({ trialExpiraEm: em(D + 60_000) }), AGORA)).toBe(false);
    expect(precisaLembrete(mensal({ assinaturaValidaAte: em(-H) }), AGORA)).toBe(false);
  });
  it("já avisado neste ciclo: não repete", () => {
    expect(precisaLembrete(teste({ trialLembreteEm: em(-H) }), AGORA)).toBe(false);
  });
  it("aviso do ciclo anterior (o do teste) não impede o aviso do mês", () => {
    const u = mensal({ trialLembreteEm: em(-31 * D) });
    expect(avisoDoCicloAtual(u)).toBe(false);
    expect(precisaLembrete(u, AGORA)).toBe(true);
  });
});

describe("podeRenovar", () => {
  it("antes de vencer e até 15 dias depois, nas duas fases", () => {
    expect(podeRenovar(teste(), AGORA)).toBe(true);
    expect(podeRenovar(teste({ trialExpiraEm: em(-14 * D) }), AGORA)).toBe(true);
    expect(podeRenovar(mensal({ assinaturaValidaAte: em(-14 * D) }), AGORA)).toBe(true);
  });
  it("vencido há mais de 15 dias, legado ou conta comum: não", () => {
    expect(podeRenovar(teste({ trialExpiraEm: em(-16 * D) }), AGORA)).toBe(false);
    expect(podeRenovar(mensal({ assinaturaValidaAte: em(-16 * D) }), AGORA)).toBe(false);
    expect(podeRenovar(mensal({ assinaturaValidaAte: null }), AGORA)).toBe(false);
    expect(podeRenovar(teste({ isTrial: false }), AGORA)).toBe(false);
  });
});

describe("validade do mês", () => {
  it("mesmo dia do mês seguinte, sem pular fevereiro", () => {
    expect(somarUmMes(new Date(2026, 8, 14, 10)).getDate()).toBe(14);
    expect(somarUmMes(new Date(2026, 8, 14, 10)).getMonth()).toBe(9);
    const fev = somarUmMes(new Date(2027, 0, 31, 10));
    expect([fev.getMonth(), fev.getDate()]).toEqual([1, 28]);
  });
  it("renovar na véspera conta do fim do período; vencido conta de agora", () => {
    expect(proximaValidade(em(10 * H), AGORA).getTime()).toBe(somarUmMes(em(10 * H)).getTime());
    expect(proximaValidade(em(-5 * D), AGORA).getTime()).toBe(somarUmMes(AGORA).getTime());
  });
});

describe("interpretarRespostaRenovacao", () => {
  it("1 e 2 soltos", () => {
    expect(interpretarRespostaRenovacao("1")).toEqual({ opcao: "RENOVAR", codigo: null, soNumero: true });
    expect(interpretarRespostaRenovacao(" 2! ")).toEqual({ opcao: "RECUSAR", codigo: null, soNumero: true });
  });
  it("RENOVAR com e sem código", () => {
    expect(interpretarRespostaRenovacao("renovar ab12cd")).toEqual({ opcao: "RENOVAR", codigo: "AB12CD", soNumero: false });
    expect(interpretarRespostaRenovacao("Quero renovar")).toEqual({ opcao: "RENOVAR", codigo: null, soNumero: false });
  });
  it("não rouba gasto, evento nem número maior", () => {
    expect(interpretarRespostaRenovacao("12")).toBeNull();
    expect(interpretarRespostaRenovacao("1 pão 5 reais")).toBeNull();
    expect(interpretarRespostaRenovacao("Gasto: Mercado 1")).toBeNull();
    expect(interpretarRespostaRenovacao("9")).toBeNull();
  });
});

describe("mensagens", () => {
  it("aviso do teste: produto, horário de Brasília, valor mensal, opções e código", () => {
    const codigo = codigoRenovacao("user-1");
    const msg = montarLembrete({ fase: "TESTE", nome: "fernandobambui", modulo: "one-space", limite: new Date("2026-09-14T13:30:00Z"), codigo });
    expect(msg).toContain("Seu teste termina amanhã");
    expect(msg).toContain("*fernandobambui*");
    expect(msg).toContain("One Space");
    expect(msg).toContain("14/09 às 10:30");
    expect(msg).toContain("*1* — Sim, quero continuar (R$ 27,00 por mês)");
    expect(msg).toContain("*2* — Não, obrigado");
    expect(msg).toContain(`RENOVAR ${codigo}`);
    expect(codigo).toMatch(/^[0-9A-F]{6}$/);
  });
  it("aviso da mensalidade", () => {
    const msg = montarLembrete({ fase: "MENSAL", nome: "ana", modulo: "one-desk", limite: AGORA, codigo: "ABC123" });
    expect(msg).toContain("Sua mensalidade vence amanhã");
    expect(msg).toContain("*1* — Sim, renovar (R$ 27,00 por mês)");
  });
  it("efetivação usa o texto aprovado e o nome do cadastro", () => {
    const msg = montarRespostaEfetivou({ nome: "fernandobambui" });
    expect(msg).toContain("Você acaba de ter seu acesso efetivado!");
    expect(msg).toContain("Não se preocupe com o pagamento de imediato");
    expect(msg).toContain("outros módulos que vão te ajudar a orquestrar a vida");
    expect(msg).toContain("Valeu, fernandobambui!");
    expect(msg).not.toContain("R$");
  });
  it("renovação do mês traz a nova validade", () => {
    expect(montarRespostaRenovouMes({ nome: "ana", modulo: "one-desk", validaAte: new Date("2026-10-14T15:00:00Z") })).toContain("14/10/2026");
  });
  it("código é estável por usuário e diferente entre usuários", () => {
    expect(codigoRenovacao("a")).toBe(codigoRenovacao("a"));
    expect(codigoRenovacao("a")).not.toBe(codigoRenovacao("b"));
  });
  it("recusa depois de vencer não fala em data futura", () => {
    expect(montarRespostaRecusou({ fase: "TESTE", nome: "ana", limite: em(-D), vencido: true, codigo: "ABC123" })).toContain("já terminou");
  });
  it("produto desconhecido cai na marca", () => {
    expect(produtoLabel("xyz")).not.toContain("undefined");
  });
});
