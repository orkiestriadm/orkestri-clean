/**
 * Trava as regras da mensalidade pelo WhatsApp (teste e mês pago): em que fase
 * a conta está, quando cada aviso sai, o que conta como resposta, até quando dá
 * para pagar e quando o login bloqueia. Sem banco nem WhatsApp.
 *
 * A regra que estes testes existem para proteger: o "1" NÃO libera acesso. Ele
 * devolve cobrança. Se um dia alguém fizer o "1" conceder mês de novo, os
 * testes de texto aqui caem — é de propósito.
 */
import {
  faseDaConta, marcoDoAviso, podeRenovar, acessoVencido, avisoDoCicloAtual, somarUmMes, proximaValidade,
  interpretarRespostaRenovacao, montarLembrete, montarCobranca, montarRespostaRecusou,
  montarPagamentoConfirmado, montarCobrancaFalhou, diasRestantes, cicloDe,
  codigoRenovacao, produtoLabel, VALOR_MENSALIDADE, VALOR_MENSALIDADE_LABEL, ContaRenovavel,
  somarMeses, planoDe, VALOR_DO_PLANO, LABEL_DO_PLANO, MESES_DO_PLANO, VALOR_ANUAL_LABEL,
} from "./trial-renovacao";

const H = 60 * 60 * 1000;
const D = 24 * H;
// 09:00 em Brasília — fora da virada do dia, para os marcos não dependerem do
// horário em que o teste roda.
const AGORA = new Date("2026-09-13T12:00:00Z");
const em = (ms: number) => new Date(AGORA.getTime() + ms);

const teste = (extra: Partial<ContaRenovavel> = {}): ContaRenovavel => ({
  isTrial: true, trialExpiraEm: em(10 * H), assinaturaEm: null, assinaturaValidaAte: null, trialLembreteEm: null, ...extra,
});
const mensal = (extra: Partial<ContaRenovavel> = {}): ContaRenovavel => ({
  isTrial: true, trialExpiraEm: em(-30 * D), assinaturaEm: em(-30 * D), assinaturaValidaAte: em(10 * H), trialLembreteEm: null, ...extra,
});

describe("o preço vive num lugar só", () => {
  it("centavos e rótulo não se contradizem", () => {
    expect(VALOR_MENSALIDADE).toBe(1190);
    expect(VALOR_MENSALIDADE_LABEL).toBe("R$ 11,90");
  });
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
  it("teste vencido sem pagar bloqueia; mês pago em dia não", () => {
    expect(acessoVencido(teste({ trialExpiraEm: em(-H) }), AGORA)).toBe(true);
    expect(acessoVencido(mensal({ trialExpiraEm: em(-H), assinaturaValidaAte: em(20 * D) }), AGORA)).toBe(false);
  });
  it("mês pago vencido bloqueia; legado sem validade nunca bloqueia", () => {
    expect(acessoVencido(mensal({ assinaturaValidaAte: em(-H) }), AGORA)).toBe(true);
    expect(acessoVencido(mensal({ assinaturaValidaAte: null }), AGORA)).toBe(false);
  });
});

describe("diasRestantes — dias de CALENDÁRIO em Brasília", () => {
  it("hoje é 0, amanhã é 1, mesmo com poucas horas de diferença", () => {
    // 21:00 BRT de hoje: faltam 12 h, mas é o MESMO dia → 0.
    expect(diasRestantes(em(12 * H), AGORA)).toBe(0);
    // 09:00 BRT de amanhã: faltam 24 h → 1.
    expect(diasRestantes(em(D), AGORA)).toBe(1);
    expect(diasRestantes(em(3 * D), AGORA)).toBe(3);
  });
});

describe("marcoDoAviso — três avisos por ciclo: 3 dias, 1 dia e no dia", () => {
  it("manda nos três marcos", () => {
    expect(marcoDoAviso(teste({ trialExpiraEm: em(3 * D) }), AGORA)).toBe(3);
    expect(marcoDoAviso(teste({ trialExpiraEm: em(D) }), AGORA)).toBe(1);
    expect(marcoDoAviso(teste({ trialExpiraEm: em(10 * H) }), AGORA)).toBe(0);
  });
  it("não manda em dia que não é marco", () => {
    expect(marcoDoAviso(teste({ trialExpiraEm: em(2 * D) }), AGORA)).toBeNull();
    expect(marcoDoAviso(teste({ trialExpiraEm: em(4 * D) }), AGORA)).toBeNull();
  });
  it("não manda depois de vencer — aviso de 'vence hoje' chegaria atrasado", () => {
    expect(marcoDoAviso(teste({ trialExpiraEm: em(-H) }), AGORA)).toBeNull();
  });
  it("quem está no cartão não recebe aviso: o Mercado Pago cobra sozinho", () => {
    expect(marcoDoAviso(mensal({ assinaturaRenovacaoAuto: true }), AGORA)).toBeNull();
    expect(marcoDoAviso(mensal({ assinaturaRenovacaoAuto: false }), AGORA)).toBe(0);
  });
  it("vale nas duas fases e ignora conta fora do ciclo", () => {
    expect(marcoDoAviso(mensal({ assinaturaValidaAte: em(D) }), AGORA)).toBe(1);
    expect(marcoDoAviso(mensal({ assinaturaValidaAte: null }), AGORA)).toBeNull();
  });
});

describe("avisoDoCicloAtual — autoriza o '1' solto a contar como resposta", () => {
  it("aviso dentro da janela deste vencimento conta", () => {
    expect(avisoDoCicloAtual(teste({ trialLembreteEm: em(-H) }))).toBe(true);
  });
  it("aviso do ciclo anterior (o do teste) não vale para o mês", () => {
    expect(avisoDoCicloAtual(mensal({ trialLembreteEm: em(-31 * D) }))).toBe(false);
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
  it("pagar na véspera conta do fim do período; vencido conta de agora", () => {
    expect(proximaValidade(em(10 * H), AGORA).getTime()).toBe(somarUmMes(em(10 * H)).getTime());
    expect(proximaValidade(em(-5 * D), AGORA).getTime()).toBe(somarUmMes(AGORA).getTime());
  });
  it("ciclo é o mês da validade, no fuso de quem paga", () => {
    expect(cicloDe(new Date("2026-11-30T12:00:00Z"))).toBe("2026-11");
    // 01/01 às 00:30 UTC ainda é 31/12 em Brasília — o ciclo acompanha quem paga.
    expect(cicloDe(new Date("2027-01-01T00:30:00Z"))).toBe("2026-12");
  });
});

describe("interpretarRespostaRenovacao", () => {
  it("1 e 2 soltos", () => {
    expect(interpretarRespostaRenovacao("1")).toEqual({ opcao: "RENOVAR", plano: "MENSAL", codigo: null, soNumero: true });
    expect(interpretarRespostaRenovacao(" 2! ")).toEqual({ opcao: "RECUSAR", plano: "MENSAL", codigo: null, soNumero: true });
  });
  it("RENOVAR e PAGAR, com e sem código", () => {
    expect(interpretarRespostaRenovacao("renovar ab12cd")).toEqual({ opcao: "RENOVAR", plano: "MENSAL", codigo: "AB12CD", soNumero: false });
    expect(interpretarRespostaRenovacao("Quero renovar")).toEqual({ opcao: "RENOVAR", plano: "MENSAL", codigo: null, soNumero: false });
    expect(interpretarRespostaRenovacao("pagar")).toEqual({ opcao: "RENOVAR", plano: "MENSAL", codigo: null, soNumero: false });
  });
  it("3 é o plano anual, solto e por extenso", () => {
    expect(interpretarRespostaRenovacao("3")).toEqual({ opcao: "RENOVAR", plano: "ANUAL", codigo: null, soNumero: true });
    expect(interpretarRespostaRenovacao(" 3. ")).toEqual({ opcao: "RENOVAR", plano: "ANUAL", codigo: null, soNumero: true });
    expect(interpretarRespostaRenovacao("anual")).toEqual({ opcao: "RENOVAR", plano: "ANUAL", codigo: null, soNumero: false });
    expect(interpretarRespostaRenovacao("RENOVAR ANUAL ab12cd")).toEqual({ opcao: "RENOVAR", plano: "ANUAL", codigo: "AB12CD", soNumero: false });
  });
  it("o anual não rouba o RENOVAR mensal com código", () => {
    // "renovar ab12cd" e "renovar anual ab12cd" só diferem pela palavra; se o
    // padrão do anual fosse frouxo, todo mundo que renova pagaria doze meses.
    expect(interpretarRespostaRenovacao("renovar ab12cd")!.plano).toBe("MENSAL");
    expect(interpretarRespostaRenovacao("renovar anual ab12cd")!.plano).toBe("ANUAL");
  });
  it("não rouba gasto, evento nem número maior", () => {
    expect(interpretarRespostaRenovacao("12")).toBeNull();
    expect(interpretarRespostaRenovacao("1 pão 5 reais")).toBeNull();
    expect(interpretarRespostaRenovacao("Gasto: Mercado 1")).toBeNull();
    expect(interpretarRespostaRenovacao("9")).toBeNull();
    // "3" solto é renovação anual, mas "3 pães" continua sendo um gasto.
    expect(interpretarRespostaRenovacao("3 pães")).toBeNull();
    expect(interpretarRespostaRenovacao("33")).toBeNull();
  });
});

describe("plano anual — prazo, valor e leitura segura", () => {
  it("o anual soma doze meses e o mensal soma um", () => {
    const agora = new Date("2026-11-03T12:00:00Z");
    expect(proximaValidade(null, agora, "MENSAL").toISOString().slice(0, 10)).toBe("2026-12-03");
    expect(proximaValidade(null, agora, "ANUAL").toISOString().slice(0, 10)).toBe("2027-11-03");
  });

  it("sem plano, continua mensal — é o que mantém toda chamada antiga valendo", () => {
    const agora = new Date("2026-11-03T12:00:00Z");
    expect(proximaValidade(null, agora).getTime()).toBe(proximaValidade(null, agora, "MENSAL").getTime());
  });

  it("o anual conta a partir do fim do período atual, como o mensal", () => {
    const agora = new Date("2026-11-03T12:00:00Z");
    const limite = new Date("2026-11-20T12:00:00Z");
    // Quem renova antes de vencer não perde os dias que faltavam.
    expect(proximaValidade(limite, agora, "ANUAL").toISOString().slice(0, 10)).toBe("2027-11-20");
  });

  it("fim de mês e bissexto não escorregam", () => {
    expect(somarMeses(new Date("2027-01-31T12:00:00"), 1).toLocaleDateString("en-CA")).toBe("2027-02-28");
    // 29/02 + 12 meses é 28/02 do ano seguinte. Somar 365 dias acertaria só por sorte.
    expect(somarMeses(new Date("2028-02-29T12:00:00"), 12).toLocaleDateString("en-CA")).toBe("2029-02-28");
    expect(somarMeses(new Date("2026-12-31T12:00:00"), 12).toLocaleDateString("en-CA")).toBe("2027-12-31");
  });

  it("valor e rótulo de cada plano", () => {
    expect(VALOR_DO_PLANO.MENSAL).toBe(1190);
    expect(VALOR_DO_PLANO.ANUAL).toBe(11990);
    expect(LABEL_DO_PLANO.ANUAL).toBe("R$ 119,90");
    expect(MESES_DO_PLANO.ANUAL).toBe(12);
    // Doze meses avulsos custam mais do que o ano — se um dia deixar de custar,
    // o desconto anunciado no site vira mentira.
    expect(VALOR_DO_PLANO.MENSAL * 12).toBeGreaterThan(VALOR_DO_PLANO.ANUAL);
  });

  it("planoDe lê o banco com segurança: o que não for ANUAL é mensal", () => {
    expect(planoDe("ANUAL")).toBe("ANUAL");
    expect(planoDe("MENSAL")).toBe("MENSAL");
    // Linha antiga sem a coluna, lixo ou enum futuro: o erro possível é conceder
    // um mês a quem pagou um ano (visível e corrigível), nunca o contrário.
    expect(planoDe(null)).toBe("MENSAL");
    expect(planoDe(undefined)).toBe("MENSAL");
    expect(planoDe("anual")).toBe("MENSAL");
    expect(planoDe("TRIENAL")).toBe("MENSAL");
  });
});

describe("mensagens — o que a pessoa lê", () => {
  it("aviso do teste: produto, horário de Brasília, valor, opções e código", () => {
    const codigo = codigoRenovacao("user-1");
    const msg = montarLembrete({
      fase: "TESTE", nome: "fernandobambui", modulo: "one-space",
      limite: new Date("2026-09-14T13:30:00Z"), codigo, marco: 1,
    });
    expect(msg).toContain("Seu teste termina amanhã");
    expect(msg).toContain("*fernandobambui*");
    expect(msg).toContain("One Space");
    expect(msg).toContain("14/09 às 10:30");
    expect(msg).toContain("R$ 11,90 por mês");
    expect(msg).toContain("todos os módulos");
    expect(msg).toContain("*1* — Quero continuar");
    expect(msg).toContain("*2* — Não, obrigado");
    expect(msg).toContain(`RENOVAR ${codigo}`);
    expect(codigo).toMatch(/^[0-9A-F]{6}$/);
    expect(msg).not.toContain("R$ 27");
  });

  it("cada marco tem o seu título — três vezes o mesmo texto soaria automático", () => {
    const p = { fase: "TESTE" as const, nome: "ana", modulo: "one-desk", limite: em(3 * D), codigo: "ABC123" };
    expect(montarLembrete({ ...p, marco: 3 })).toContain("Faltam 3 dias para o seu teste acabar");
    expect(montarLembrete({ ...p, marco: 1 })).toContain("Seu teste termina amanhã");
    expect(montarLembrete({ ...p, marco: 0 })).toContain("Hoje é o último dia do seu teste");
  });

  it("aviso da mensalidade, com o atalho para pagar direto", () => {
    const msg = montarLembrete({
      fase: "MENSAL", nome: "ana", modulo: "one-desk", limite: AGORA, codigo: "ABC123",
      marco: 0, urlCheckout: "https://orkiestri.com/assinatura/tok",
    });
    expect(msg).toContain("Sua mensalidade vence hoje");
    expect(msg).toContain("*1* — Quero renovar");
    expect(msg).toContain("https://orkiestri.com/assinatura/tok");
  });

  it("a resposta ao '1' é COBRANÇA, não liberação de acesso", () => {
    const msg = montarCobranca({
      nome: "fernandobambui", modulo: "one-space",
      urlCheckout: "https://orkiestri.com/assinatura/tok", temPix: true,
    });
    expect(msg).toContain("R$ 11,90");
    expect(msg).toContain("https://orkiestri.com/assinatura/tok");
    expect(msg).toContain("Cartão");
    expect(msg).toContain("Pix");
    // O texto antigo prometia acesso antes do pagamento. Não pode voltar.
    expect(msg).not.toContain("Não se preocupe com o pagamento");
    expect(msg).not.toContain("acesso efetivado");
  });

  it("sem Pix, a mensagem não promete um código que não vem", () => {
    const msg = montarCobranca({ nome: "ana", modulo: null, urlCheckout: "https://x/y", temPix: false });
    expect(msg).not.toContain("mensagem seguinte");
  });

  it("confirmação do pagamento diz até quando vale", () => {
    const msg = montarPagamentoConfirmado({
      nome: "ana", modulo: "one-desk", validaAte: new Date("2026-10-14T15:00:00Z"), renovacaoAuto: false,
    });
    expect(msg).toContain("Pagamento confirmado");
    expect(msg).toContain("14/10/2026");
    expect(msg).toContain("mês que vem eu te aviso");
  });

  it("no cartão, a confirmação avisa que não precisa fazer nada no mês seguinte", () => {
    const msg = montarPagamentoConfirmado({
      nome: "ana", modulo: "one-desk", validaAte: new Date("2026-10-14T15:00:00Z"), renovacaoAuto: true,
    });
    expect(msg).toContain("automática no cartão");
    expect(msg).not.toContain("eu te aviso de novo");
  });

  it("cartão recusado: diz o prazo e oferece outro caminho", () => {
    const msg = montarCobrancaFalhou({ nome: "ana", limite: new Date("2026-10-14T15:00:00Z"), urlCheckout: "https://x/y" });
    expect(msg).toContain("não passou");
    expect(msg).toContain("14/10/2026");
    expect(msg).toContain("https://x/y");
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
