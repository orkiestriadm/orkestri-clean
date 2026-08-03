import {
  avaliarItem, calcularProgresso, reindexar, eventoValido, responsavelValido,
  ItemChecklist,
} from "./checklist.entity";

const HOJE = new Date(2026, 7, 10); // 10/08/2026

const item = (over: Partial<ItemChecklist> = {}): ItemChecklist => ({
  id: "i1", ordem: 1, titulo: "Entregar RG", obrigatorio: true, responsavel: "rh",
  prazoDias: null, concluidoEm: null,
  ...over,
});

describe("vocabulário", () => {
  it("aceita só os eventos previstos", () => {
    expect(eventoValido("admissao")).toBe(true);
    expect(eventoValido("desligamento")).toBe(true);
    expect(eventoValido("ferias")).toBe(false);
  });

  it("aceita só os responsáveis previstos", () => {
    expect(responsavelValido("rh")).toBe(true);
    expect(responsavelValido("gestor")).toBe(true);
    expect(responsavelValido("diretoria")).toBe(false);
  });
});

describe("situação do item", () => {
  it("concluído não olha prazo", () => {
    const r = avaliarItem(
      item({ prazoDias: 1, concluidoEm: new Date(2026, 6, 1) }),
      new Date(2026, 6, 1),
      HOJE,
    );
    expect(r.situacao).toBe("concluido");
    expect(r.diasParaPrazo).toBeNull();
  });

  it("sem prazo é pendente, nunca atrasado", () => {
    const r = avaliarItem(item({ prazoDias: null }), new Date(2026, 0, 1), HOJE);
    expect(r.situacao).toBe("pendente");
  });

  it("dentro do prazo é pendente e informa quantos dias restam", () => {
    // Admissão em 05/08 + 10 dias = 15/08; hoje é 10/08.
    const r = avaliarItem(item({ prazoDias: 10 }), new Date(2026, 7, 5), HOJE);
    expect(r.situacao).toBe("pendente");
    expect(r.diasParaPrazo).toBe(5);
  });

  it("passou do prazo é atrasado, com dias negativos", () => {
    // Admissão em 01/08 + 3 dias = 04/08; hoje é 10/08.
    const r = avaliarItem(item({ prazoDias: 3 }), new Date(2026, 7, 1), HOJE);
    expect(r.situacao).toBe("atrasado");
    expect(r.diasParaPrazo).toBe(-6);
  });

  it("no último dia do prazo ainda não está atrasado", () => {
    const r = avaliarItem(item({ prazoDias: 5 }), new Date(2026, 7, 5), HOJE);
    expect(r.situacao).toBe("pendente");
    expect(r.diasParaPrazo).toBe(0);
  });

  it("sem data de referência não acusa atraso", () => {
    // Colaborador sem data de admissão no cadastro: culpá-lo por um prazo que
    // ninguém sabe quando começou seria inventar informação.
    const r = avaliarItem(item({ prazoDias: 1 }), null, HOJE);
    expect(r.situacao).toBe("pendente");
    expect(r.diasParaPrazo).toBeNull();
  });

  it("o prazo conta do EVENTO, não da abertura do checklist", () => {
    // Checklist aberto com atraso não ganha prazo extra: o relógio do exame
    // admissional começou quando a pessoa foi admitida.
    const admissao = new Date(2026, 6, 1); // 01/07
    const r = avaliarItem(item({ prazoDias: 7 }), admissao, HOJE);
    expect(r.situacao).toBe("atrasado");
  });
});

describe("progresso", () => {
  it("conta só os obrigatórios no percentual", () => {
    const r = calcularProgresso(
      [
        item({ id: "a", ordem: 1, concluidoEm: new Date() }),
        item({ id: "b", ordem: 2, obrigatorio: false }),
      ],
      null, HOJE,
    );
    expect(r.percentual).toBe(100);
    expect(r.completo).toBe(true);
    // O opcional continua visível como pendente.
    expect(r.itens.find(i => i.id === "b")!.situacao).toBe("pendente");
  });

  it("meio caminho dá 50", () => {
    const r = calcularProgresso(
      [
        item({ id: "a", ordem: 1, concluidoEm: new Date() }),
        item({ id: "b", ordem: 2 }),
      ],
      null, HOJE,
    );
    expect(r.percentual).toBe(50);
    expect(r.completo).toBe(false);
  });

  it("checklist sem item obrigatório vale 100, não 0", () => {
    const r = calcularProgresso([item({ obrigatorio: false })], null, HOJE);
    expect(r.percentual).toBe(100);
    expect(r.completo).toBe(true);
  });

  it("checklist vazio vale 100", () => {
    const r = calcularProgresso([], null, HOJE);
    expect(r.percentual).toBe(100);
    expect(r.total).toBe(0);
  });

  it("conta os atrasados separadamente do percentual", () => {
    const r = calcularProgresso(
      [
        item({ id: "a", ordem: 1, prazoDias: 1 }),
        item({ id: "b", ordem: 2, prazoDias: 90 }),
      ],
      new Date(2026, 7, 1), HOJE,
    );
    expect(r.atrasados).toBe(1);
    expect(r.percentual).toBe(0);
  });

  it("devolve os itens em ordem, não na ordem de entrada", () => {
    const r = calcularProgresso(
      [item({ id: "c", ordem: 3 }), item({ id: "a", ordem: 1 }), item({ id: "b", ordem: 2 })],
      null, HOJE,
    );
    expect(r.itens.map(i => i.id)).toEqual(["a", "b", "c"]);
  });
});

describe("reindexar", () => {
  it("renumera em 1..N mantendo a sequência", () => {
    expect(reindexar([{ ordem: 9 }, { ordem: 2 }, { ordem: 5 }]).map(i => i.ordem))
      .toEqual([1, 2, 3]);
  });
});
