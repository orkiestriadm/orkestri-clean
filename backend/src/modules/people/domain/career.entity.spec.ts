import {
  ordemNivel, nivelAtende, reindexar, degrauAtual, proximoDegrau,
  avaliarProntidao, validarRequisito, validarNivelMinimo,
  Degrau, Requisito, ContextoDoColaborador,
} from "./career.entity";

/** Contexto vazio; cada teste preenche só o que exercita. */
function contexto(over: Partial<ContextoDoColaborador> = {}): ContextoDoColaborador {
  return {
    competencias: new Map(),
    treinamentos: new Set(),
    mesesNoDegrau: null,
    ultimaNota: null,
    ...over,
  };
}

const req = (over: Partial<Requisito> = {}): Requisito => ({
  id: "r1", tipo: "manual", obrigatorio: true, ...over,
});

describe("níveis de competência", () => {
  it("ordena júnior abaixo de especialista", () => {
    expect(ordemNivel("junior")).toBeLessThan(ordemNivel("especialista"));
    expect(ordemNivel("pleno")).toBeLessThan(ordemNivel("senior"));
  });

  it("trata nível desconhecido como fora da escala", () => {
    expect(ordemNivel("guru")).toBe(-1);
    expect(ordemNivel(null)).toBe(-1);
  });

  it("aceita nível acima do exigido", () => {
    expect(nivelAtende("senior", "pleno")).toBe(true);
  });

  it("recusa nível abaixo do exigido", () => {
    expect(nivelAtende("junior", "senior")).toBe(false);
  });

  it("aceita o nível exato", () => {
    expect(nivelAtende("pleno", "pleno")).toBe(true);
  });

  it("sem exigência de nível, ter a competência basta", () => {
    expect(nivelAtende("junior", null)).toBe(true);
    // Mas não ter, não basta.
    expect(nivelAtende(null, null)).toBe(false);
  });
});

describe("ordem dos degraus", () => {
  const degraus: Degrau[] = [
    { id: "c", ordem: 7, positionId: "p3" },
    { id: "a", ordem: 1, positionId: "p1" },
    { id: "b", ordem: 4, positionId: "p2" },
  ];

  it("renumera em 1..N mantendo a sequência", () => {
    expect(reindexar(degraus).map(d => [d.id, d.ordem])).toEqual([
      ["a", 1], ["b", 2], ["c", 3],
    ]);
  });

  it("acha o degrau pelo cargo atual", () => {
    expect(degrauAtual(degraus, "p2")?.id).toBe("b");
  });

  it("devolve nulo para quem está fora da trilha", () => {
    expect(degrauAtual(degraus, "p9")).toBeNull();
    expect(degrauAtual(degraus, null)).toBeNull();
  });

  it("acha o próximo pela ordem, não pela posição na lista", () => {
    const atual = degraus.find(d => d.id === "a")!;
    expect(proximoDegrau(degraus, atual)?.id).toBe("b");
  });

  it("no topo da trilha não há próximo", () => {
    const topo = degraus.find(d => d.id === "c")!;
    expect(proximoDegrau(degraus, topo)).toBeNull();
  });
});

describe("prontidão", () => {
  it("marca competência atendida quando o nível alcança o exigido", () => {
    const r = avaliarProntidao(
      null,
      [req({ id: "r1", tipo: "competencia", skillId: "s1", nivelMinimo: "pleno" })],
      contexto({ competencias: new Map([["s1", "senior"]]) }),
    );
    expect(r.requisitos[0].situacao).toBe("atendido");
    expect(r.requisitos[0].nivelAtual).toBe("senior");
    expect(r.pronto).toBe(true);
    expect(r.percentual).toBe(100);
  });

  it("marca competência pendente quando falta nível", () => {
    const r = avaliarProntidao(
      null,
      [req({ tipo: "competencia", skillId: "s1", nivelMinimo: "senior" })],
      contexto({ competencias: new Map([["s1", "junior"]]) }),
    );
    expect(r.requisitos[0].situacao).toBe("pendente");
    expect(r.pronto).toBe(false);
    expect(r.percentual).toBe(0);
  });

  it("marca treinamento concluído como atendido", () => {
    const r = avaliarProntidao(
      null,
      [req({ tipo: "treinamento", trainingId: "t1" })],
      contexto({ treinamentos: new Set(["t1"]) }),
    );
    expect(r.requisitos[0].situacao).toBe("atendido");
  });

  it("requisito de texto livre vira conferência manual, nunca atendido sozinho", () => {
    const r = avaliarProntidao(
      null,
      [req({ tipo: "manual", descricao: "Liderar um projeto de ponta a ponta" })],
      contexto(),
    );
    expect(r.requisitos[0].situacao).toBe("conferencia_manual");
    expect(r.conferenciasManuais).toBe(1);
  });

  it("conferência manual não derruba o percentual", () => {
    // Uma competência cumprida e um item manual: 100%, não 50%. Senão a pessoa
    // ficaria presa num número que o sistema nunca completa sozinho.
    const r = avaliarProntidao(
      null,
      [
        req({ id: "r1", tipo: "competencia", skillId: "s1", nivelMinimo: "pleno" }),
        req({ id: "r2", tipo: "manual", descricao: "Conduzir uma entrega crítica" }),
      ],
      contexto({ competencias: new Map([["s1", "pleno"]]) }),
    );
    expect(r.percentual).toBe(100);
    expect(r.pronto).toBe(true);
    expect(r.conferenciasManuais).toBe(1);
  });

  it("requisito não obrigatório não entra na conta", () => {
    const r = avaliarProntidao(
      null,
      [
        req({ id: "r1", tipo: "competencia", skillId: "s1", nivelMinimo: "pleno" }),
        req({ id: "r2", tipo: "competencia", skillId: "s2", nivelMinimo: "senior", obrigatorio: false }),
      ],
      contexto({ competencias: new Map([["s1", "pleno"]]) }),
    );
    expect(r.percentual).toBe(100);
    expect(r.pronto).toBe(true);
    // Continua visível como pendente, para servir de próximo passo.
    expect(r.requisitos[1].situacao).toBe("pendente");
  });

  it("competência sem alvo é cadastro incompleto, não requisito cumprido", () => {
    const r = avaliarProntidao(null, [req({ tipo: "competencia", skillId: null })], contexto());
    expect(r.requisitos[0].situacao).toBe("conferencia_manual");
  });

  it("degrau sem nada verificável fica em 100, não em 0", () => {
    const r = avaliarProntidao(null, [], contexto());
    expect(r.percentual).toBe(100);
    expect(r.pronto).toBe(true);
  });

  it("cobra o tempo mínimo no degrau", () => {
    const r = avaliarProntidao({ mesesMinimos: 18 }, [], contexto({ mesesNoDegrau: 7 }));
    expect(r.criterios[0].situacao).toBe("pendente");
    expect(r.criterios[0].detalhe).toBe("7 de 18 meses");
    expect(r.pronto).toBe(false);
  });

  it("aceita o tempo mínimo cumprido", () => {
    const r = avaliarProntidao({ mesesMinimos: 12 }, [], contexto({ mesesNoDegrau: 12 }));
    expect(r.criterios[0].situacao).toBe("atendido");
    expect(r.pronto).toBe(true);
  });

  it("sem data de referência, o tempo vira conferência e não pendência", () => {
    // Culpar a pessoa por um cadastro sem data seria mostrar "0 de 18 meses"
    // para quem talvez já tenha os 18.
    const r = avaliarProntidao({ mesesMinimos: 18 }, [], contexto({ mesesNoDegrau: null }));
    expect(r.criterios[0].situacao).toBe("conferencia_manual");
    expect(r.percentual).toBe(100);
  });

  it("cobra a nota mínima da última avaliação", () => {
    const abaixo = avaliarProntidao({ notaMinima: 4 }, [], contexto({ ultimaNota: 3.5 }));
    expect(abaixo.criterios[0].situacao).toBe("pendente");

    const acima = avaliarProntidao({ notaMinima: 4 }, [], contexto({ ultimaNota: 4.5 }));
    expect(acima.criterios[0].situacao).toBe("atendido");
  });

  it("sem avaliação nenhuma, a nota exigida fica pendente", () => {
    // Diferente do tempo: aqui a ausência É a pendência — a avaliação precisa
    // acontecer, e ninguém consegue conferir por fora o que não foi avaliado.
    const r = avaliarProntidao({ notaMinima: 4 }, [], contexto({ ultimaNota: null }));
    expect(r.criterios[0].situacao).toBe("pendente");
    expect(r.pronto).toBe(false);
  });

  it("soma requisitos e critérios no mesmo percentual", () => {
    const r = avaliarProntidao(
      { mesesMinimos: 12, notaMinima: 4 },
      [
        req({ id: "r1", tipo: "competencia", skillId: "s1", nivelMinimo: "pleno" }),
        req({ id: "r2", tipo: "treinamento", trainingId: "t1" }),
      ],
      contexto({
        competencias: new Map([["s1", "senior"]]),
        treinamentos: new Set(["t1"]),
        mesesNoDegrau: 6,
        ultimaNota: 4.2,
      }),
    );
    // 3 de 4: competência, treinamento e nota atendidos; tempo pendente.
    expect(r.percentual).toBe(75);
    expect(r.pronto).toBe(false);
  });
});

describe("validações de escrita", () => {
  it("recusa competência sem competência escolhida", () => {
    expect(validarRequisito({ tipo: "competencia" }).valido).toBe(false);
  });

  it("recusa treinamento sem curso escolhido", () => {
    expect(validarRequisito({ tipo: "treinamento" }).valido).toBe(false);
  });

  it("recusa item manual sem descrição", () => {
    expect(validarRequisito({ tipo: "manual", descricao: "   " }).valido).toBe(false);
  });

  it("aceita os três tipos bem preenchidos", () => {
    expect(validarRequisito({ tipo: "competencia", skillId: "s1" }).valido).toBe(true);
    expect(validarRequisito({ tipo: "treinamento", trainingId: "t1" }).valido).toBe(true);
    expect(validarRequisito({ tipo: "manual", descricao: "Liderar" }).valido).toBe(true);
  });

  it("recusa tipo desconhecido", () => {
    expect(validarRequisito({ tipo: "vibe" }).valido).toBe(false);
  });

  it("recusa nível fora da escala e aceita ausência de nível", () => {
    expect(validarNivelMinimo("guru").valido).toBe(false);
    expect(validarNivelMinimo(null).valido).toBe(true);
    expect(validarNivelMinimo("senior").valido).toBe(true);
  });
});
