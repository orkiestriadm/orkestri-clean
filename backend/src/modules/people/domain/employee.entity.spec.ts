import {
  EMPLOYEE_STATUS, canTransitionTo, allowedTransitionsFrom, isAtivo,
  contaParaCapacidade, temIdentidadeValida, exigeDataDesligamento,
  ficariaComCicloDeGestao, isEmployeeStatus,
} from "./employee.entity";

describe("transições de status", () => {
  it("permite afastar e reativar um colaborador", () => {
    expect(canTransitionTo(EMPLOYEE_STATUS.ATIVO, EMPLOYEE_STATUS.AFASTADO)).toBe(true);
    expect(canTransitionTo(EMPLOYEE_STATUS.AFASTADO, EMPLOYEE_STATUS.ATIVO)).toBe(true);
  });

  it("permite desligar a partir de qualquer estado vivo", () => {
    for (const de of [EMPLOYEE_STATUS.ATIVO, EMPLOYEE_STATUS.INATIVO,
                      EMPLOYEE_STATUS.AFASTADO, EMPLOYEE_STATUS.SUSPENSO]) {
      expect(canTransitionTo(de, EMPLOYEE_STATUS.DESLIGADO)).toBe(true);
    }
  });

  // Readmissão é admissão nova, com novo vínculo e nova matrícula. Tratar como
  // transição apagaria a fronteira entre dois contratos no histórico.
  it("trata DESLIGADO como estado final", () => {
    expect(canTransitionTo(EMPLOYEE_STATUS.DESLIGADO, EMPLOYEE_STATUS.ATIVO)).toBe(false);
    expect(allowedTransitionsFrom(EMPLOYEE_STATUS.DESLIGADO)).toHaveLength(0);
  });

  it("não permite pular de afastado direto para suspenso", () => {
    expect(canTransitionTo(EMPLOYEE_STATUS.AFASTADO, EMPLOYEE_STATUS.SUSPENSO)).toBe(false);
  });

  it("é idempotente: reaplicar o mesmo status não é erro", () => {
    expect(canTransitionTo(EMPLOYEE_STATUS.DESLIGADO, EMPLOYEE_STATUS.DESLIGADO)).toBe(true);
    expect(canTransitionTo(EMPLOYEE_STATUS.ATIVO, EMPLOYEE_STATUS.ATIVO)).toBe(true);
  });

  it("reconhece apenas os status do catálogo", () => {
    expect(isEmployeeStatus("ATIVO")).toBe(true);
    expect(isEmployeeStatus("FERIAS")).toBe(false);
    expect(isEmployeeStatus(null)).toBe(false);
  });
});

describe("derivações de status", () => {
  it("só ATIVO produz ativo=true", () => {
    expect(isAtivo(EMPLOYEE_STATUS.ATIVO)).toBe(true);
    expect(isAtivo(EMPLOYEE_STATUS.AFASTADO)).toBe(false);
    expect(isAtivo(EMPLOYEE_STATUS.DESLIGADO)).toBe(false);
  });

  it("afastado não entra em cálculo de capacidade", () => {
    expect(contaParaCapacidade(EMPLOYEE_STATUS.ATIVO)).toBe(true);
    expect(contaParaCapacidade(EMPLOYEE_STATUS.AFASTADO)).toBe(false);
  });

  it("exige data apenas no desligamento", () => {
    expect(exigeDataDesligamento(EMPLOYEE_STATUS.DESLIGADO)).toBe(true);
    expect(exigeDataDesligamento(EMPLOYEE_STATUS.INATIVO)).toBe(false);
  });
});

describe("identidade do colaborador", () => {
  it("aceita colaborador com usuário vinculado", () => {
    expect(temIdentidadeValida({ userId: "u1" })).toBe(true);
  });

  it("aceita colaborador sem usuário quando tem nome próprio", () => {
    expect(temIdentidadeValida({ userId: null, nomeCompleto: "João Silva" })).toBe(true);
  });

  it("rejeita colaborador sem usuário e sem nome", () => {
    expect(temIdentidadeValida({ userId: null, nomeCompleto: null })).toBe(false);
    expect(temIdentidadeValida({ userId: null, nomeCompleto: "   " })).toBe(false);
  });
});

describe("ciclo na hierarquia de gestão", () => {
  // c1 → c2 → c3 (c3 é a raiz)
  const hierarquia = new Map<string, string | null>([
    ["c1", "c2"],
    ["c2", "c3"],
    ["c3", null],
  ]);

  it("detecta autogestão", () => {
    expect(ficariaComCicloDeGestao("c1", "c1", hierarquia)).toBe(true);
  });

  it("detecta ciclo indireto", () => {
    // Fazer c3 (raiz) reportar a c1 fecharia o ciclo c1→c2→c3→c1
    expect(ficariaComCicloDeGestao("c3", "c1", hierarquia)).toBe(true);
  });

  it("aceita gestor que não cria ciclo", () => {
    expect(ficariaComCicloDeGestao("c4", "c1", hierarquia)).toBe(false);
  });

  it("aceita remover o gestor", () => {
    expect(ficariaComCicloDeGestao("c1", null, hierarquia)).toBe(false);
    expect(ficariaComCicloDeGestao("c1", undefined, hierarquia)).toBe(false);
  });

  // Dado legado pode já conter ciclo. A travessia precisa terminar (não entrar
  // em laço infinito) e recusar a atribuição: pendurar mais gente num ramo
  // corrompido agrava o problema em vez de expô-lo.
  it("termina e recusa quando o ramo de destino já é cíclico", () => {
    const corrompida = new Map<string, string | null>([["a", "b"], ["b", "a"]]);
    expect(ficariaComCicloDeGestao("novo", "a", corrompida)).toBe(true);
  });

  it("aceita gestor em ramo saudável mesmo havendo ciclo em outro ramo", () => {
    const parcial = new Map<string, string | null>([
      ["a", "b"], ["b", "a"],      // ramo corrompido
      ["ok", null],                 // ramo saudável
    ]);
    expect(ficariaComCicloDeGestao("novo", "ok", parcial)).toBe(false);
  });
});
