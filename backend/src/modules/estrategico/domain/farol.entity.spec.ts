import { calcularFarol, PARAMETROS_PADRAO, EntradaFarol } from "./farol.entity";

const HOJE = new Date(2026, 8, 10, 10, 0, 0); // 10/09/2026, 10h local
const dia = (d: number, m = 9, a = 2026) => new Date(Date.UTC(a, m - 1, d)); // coluna DATE

const base = (extra: Partial<EntradaFarol> = {}): EntradaFarol => ({
  tipo: "assunto",
  etapa: "em_analise",
  prioridade: "media",
  proximaAcao: "Cobrar manifestação",
  proximaAcaoPrazo: dia(30),
  ultimaMovimentacaoEm: dia(1),
  ...extra,
});

describe("calcularFarol", () => {
  it("verde quando há próxima ação com prazo folgado e movimentação recente", () => {
    expect(calcularFarol(base(), PARAMETROS_PADRAO, HOJE)).toEqual({ farol: "verde", motivos: [] });
  });

  it("cinza quando suspenso, sem motivos — suspensão não é alerta", () => {
    expect(calcularFarol(base({ etapa: "suspenso", proximaAcao: null }), PARAMETROS_PADRAO, HOJE).farol).toBe("cinza");
  });

  it("concluído é verde e cancelado é cinza", () => {
    expect(calcularFarol(base({ etapa: "concluido" }), PARAMETROS_PADRAO, HOJE).farol).toBe("verde");
    expect(calcularFarol(base({ etapa: "cancelado" }), PARAMETROS_PADRAO, HOJE).farol).toBe("cinza");
  });

  it("amarelo quando falta próxima ação — a principal melhoria sobre a planilha", () => {
    const r = calcularFarol(base({ proximaAcao: null, proximaAcaoPrazo: null }), PARAMETROS_PADRAO, HOJE);
    expect(r.farol).toBe("amarelo");
    expect(r.motivos.map(m => m.codigo)).toContain("sem_acao");
  });

  it("vermelho quando assunto crítico não tem próxima ação", () => {
    const r = calcularFarol(base({ prioridade: "critica", proximaAcao: "" }), PARAMETROS_PADRAO, HOJE);
    expect(r.farol).toBe("vermelho");
  });

  it("ação vencida há poucos dias é amarelo; além do limite de atraso é vermelho", () => {
    expect(calcularFarol(base({ proximaAcaoPrazo: dia(5) }), PARAMETROS_PADRAO, HOJE).farol).toBe("amarelo");
    const r = calcularFarol(base({ proximaAcaoPrazo: dia(20, 8) }), PARAMETROS_PADRAO, HOJE);
    expect(r.farol).toBe("vermelho");
    expect(r.motivos[0].texto).toBe("Próxima ação vencida há 21 dias");
  });

  it("ação vencida em assunto de prioridade alta já é vermelho", () => {
    expect(calcularFarol(base({ prioridade: "alta", proximaAcaoPrazo: dia(9) }), PARAMETROS_PADRAO, HOJE).farol).toBe("vermelho");
  });

  it("vence hoje não é atraso", () => {
    const r = calcularFarol(base({ proximaAcaoPrazo: dia(10) }), PARAMETROS_PADRAO, HOJE);
    expect(r.farol).toBe("amarelo");
    expect(r.motivos[0].texto).toBe("Próxima ação vence hoje");
  });

  it("aging: 30 dias sem movimento é amarelo, 90 é vermelho", () => {
    expect(calcularFarol(base({ ultimaMovimentacaoEm: dia(5, 8) }), PARAMETROS_PADRAO, HOJE).farol).toBe("amarelo");
    expect(calcularFarol(base({ ultimaMovimentacaoEm: dia(1, 6) }), PARAMETROS_PADRAO, HOJE).farol).toBe("vermelho");
  });

  it("sem nenhum andamento datado é amarelo, não verde", () => {
    const r = calcularFarol(base({ ultimaMovimentacaoEm: null }), PARAMETROS_PADRAO, HOJE);
    expect(r.farol).toBe("amarelo");
    expect(r.motivos[0].codigo).toBe("sem_movimentacao");
  });

  it("dependência aguardando além do limite sinaliza com o nome e os dias", () => {
    const r = calcularFarol(base({ dependencias: [{ nome: "ANTT", desde: dia(9, 8) }] }), PARAMETROS_PADRAO, HOJE);
    expect(r.farol).toBe("amarelo");
    expect(r.motivos[0].texto).toBe("Aguardando ANTT há 32 dias");
  });

  it("risco: matriz crítica ou dimensão 5 é vermelho; alto é amarelo", () => {
    expect(calcularFarol(base({ probabilidade: 4, impacto: 4 }), PARAMETROS_PADRAO, HOJE).farol).toBe("vermelho");
    expect(calcularFarol(base({ probabilidade: 2, impacto: 5 }), PARAMETROS_PADRAO, HOJE).farol).toBe("amarelo");
    expect(calcularFarol(base({ riscoJuridico: 5 }), PARAMETROS_PADRAO, HOJE).farol).toBe("vermelho");
  });

  it("valor em risco acima do limiar só pesa junto com risco alto", () => {
    const p = { ...PARAMETROS_PADRAO, limiarValorRelevante: 1_000_000 };
    const alto = calcularFarol(base({ valorEmRisco: "5000000.00", probabilidade: 2, impacto: 5 }), p, HOJE);
    expect(alto.farol).toBe("vermelho");
    expect(calcularFarol(base({ valorEmRisco: 5_000_000 }), p, HOJE).farol).toBe("verde");
  });

  it("oportunidade em estruturação é azul, a menos que haja motivo vermelho", () => {
    const op = base({ tipo: "oportunidade", estagioOportunidade: "em_estudo", proximaAcao: null });
    expect(calcularFarol(op, PARAMETROS_PADRAO, HOJE).farol).toBe("azul");
    expect(calcularFarol({ ...op, riscoPrazo: 5 }, PARAMETROS_PADRAO, HOJE).farol).toBe("vermelho");
    expect(calcularFarol({ ...op, estagioOportunidade: "em_negociacao", proximaAcao: "x", proximaAcaoPrazo: dia(30) }, PARAMETROS_PADRAO, HOJE).farol).toBe("verde");
  });

  it("prazo final vencido é vermelho", () => {
    expect(calcularFarol(base({ prazoFinal: dia(31, 8) }), PARAMETROS_PADRAO, HOJE).farol).toBe("vermelho");
  });

  it("motivos vermelhos vêm antes dos amarelos", () => {
    const r = calcularFarol(base({ proximaAcao: null, riscoPrazo: 5 }), PARAMETROS_PADRAO, HOJE);
    expect(r.motivos[0].nivel).toBe("vermelho");
  });
});
