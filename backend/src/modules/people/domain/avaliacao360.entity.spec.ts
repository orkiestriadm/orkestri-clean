import {
  MINIMO_PARES_PARA_EXIBIR, calibrar, consolidar, divergenciaAutoavaliacao, validarConvite,
} from "./avaliacao360.entity";

const respondida = (avaliadorId: string, origem: string, nota: number | null) =>
  ({ avaliadorId, origem, nota, status: "RESPONDIDA" });
const convidado = (avaliadorId: string, origem: string) =>
  ({ avaliadorId, origem, nota: null, status: "CONVIDADO" });

describe("validarConvite", () => {
  const base = {
    avaliadoId: "ana",
    jaConvidados: [] as string[],
    reviewFinalizada: false,
  };

  it("aceita par que não é o avaliado", () => {
    expect(validarConvite({ ...base, origem: "par", avaliadorId: "bruno" })).toBeNull();
  });

  it("aceita autoavaliação do próprio avaliado", () => {
    expect(validarConvite({ ...base, origem: "autoavaliacao", avaliadorId: "ana" })).toBeNull();
  });

  // Os dois casos espelhados: a autoavaliação é a checagem do par com o sinal
  // invertido, e escrevê-los juntos evita corrigir um e esquecer o outro.
  it("recusa autoavaliação preenchida por terceiro", () => {
    expect(validarConvite({ ...base, origem: "autoavaliacao", avaliadorId: "bruno" }))
      .toBe("auto_de_outra_pessoa");
  });

  it("recusa o avaliado como par de si mesmo", () => {
    expect(validarConvite({ ...base, origem: "par", avaliadorId: "ana" }))
      .toBe("par_e_o_proprio_avaliado");
  });

  it("recusa convite repetido — dois convites dariam dois pesos à mesma opinião", () => {
    expect(validarConvite({ ...base, origem: "par", avaliadorId: "bruno", jaConvidados: ["bruno"] }))
      .toBe("ja_convidado");
  });

  it("recusa convite depois de finalizada", () => {
    // A nota já foi comunicada: uma resposta nova mudaria o retrato de algo
    // que a pessoa já leu.
    expect(validarConvite({ ...base, origem: "par", avaliadorId: "bruno", reviewFinalizada: true }))
      .toBe("review_finalizada");
  });

  it("recusa origem que não existe", () => {
    expect(validarConvite({ ...base, origem: "cliente", avaliadorId: "bruno" }))
      .toBe("origem_invalida");
  });
});

describe("consolidar", () => {
  it("faz média por origem, ignorando quem não respondeu", () => {
    const r = consolidar([
      respondida("ana", "autoavaliacao", 4),
      respondida("b", "par", 3),
      respondida("c", "par", 5),
      convidado("d", "par"),
    ]);

    const pares = r.find(x => x.origem === "par")!;
    expect(pares.convidados).toBe(3);
    expect(pares.respondidas).toBe(2);
    expect(pares.media).toBe(4);
    expect(r.find(x => x.origem === "autoavaliacao")!.media).toBe(4);
  });

  it("omite origem sem ninguém convidado", () => {
    const r = consolidar([respondida("ana", "autoavaliacao", 4)]);
    expect(r).toHaveLength(1);
  });

  // O anonimato é o que sustenta a honestidade do par: com duas respostas, a
  // "média dos pares" identifica quem respondeu.
  it("esconde do avaliado a média de pares com poucas respostas", () => {
    const r = consolidar([respondida("b", "par", 2), respondida("c", "par", 3)], true);
    const pares = r.find(x => x.origem === "par")!;
    expect(pares.media).toBeNull();
    expect(pares.omitidaPorAnonimato).toBe(true);
    expect(pares.respondidas).toBe(2);
  });

  it("mostra a média de pares ao avaliado quando há respostas bastantes", () => {
    const entradas = Array.from({ length: MINIMO_PARES_PARA_EXIBIR }, (_, i) =>
      respondida(`p${i}`, "par", 4));
    const pares = consolidar(entradas, true).find(x => x.origem === "par")!;
    expect(pares.media).toBe(4);
    expect(pares.omitidaPorAnonimato).toBe(false);
  });

  it("nunca esconde a própria autoavaliação do avaliado", () => {
    const r = consolidar([respondida("ana", "autoavaliacao", 5)], true);
    expect(r[0].media).toBe(5);
  });

  it("para quem conduz a avaliação não há omissão", () => {
    const r = consolidar([respondida("b", "par", 2)], false);
    expect(r.find(x => x.origem === "par")!.media).toBe(2);
  });
});

describe("divergenciaAutoavaliacao", () => {
  it("positivo quando a pessoa se vê melhor que o gestor a vê", () => {
    expect(divergenciaAutoavaliacao(3, 4.5)).toBe(1.5);
  });

  it("negativo quando a pessoa se subestima", () => {
    expect(divergenciaAutoavaliacao(4.5, 3)).toBe(-1.5);
  });

  it("nulo enquanto faltar um dos dois lados", () => {
    expect(divergenciaAutoavaliacao(null, 4)).toBeNull();
    expect(divergenciaAutoavaliacao(4, null)).toBeNull();
  });
});

describe("calibrar", () => {
  const n = (gestorId: string, nota: number) => ({ gestorId, gestorNome: gestorId, nota });

  it("mostra quem pontua acima e quem pontua abaixo dos demais", () => {
    const r = calibrar("2026.1", [
      n("generoso", 5), n("generoso", 5), n("generoso", 4.5),
      n("rigoroso", 3), n("rigoroso", 2.5), n("rigoroso", 3),
    ]);

    expect(r.totalAvaliados).toBe(6);
    expect(r.mediaGeral).toBe(3.8);
    // Extremos primeiro: a reunião de calibração começa por onde a régua
    // mais destoa.
    expect(r.gestores[0].desvio).not.toBe(0);
    expect(r.gestores.find(g => g.gestorId === "generoso")!.desvio).toBeGreaterThan(0);
    expect(r.gestores.find(g => g.gestorId === "rigoroso")!.desvio).toBeLessThan(0);
  });

  it("inclui gestor com um único avaliado", () => {
    // Omiti-los esconderia as equipes pequenas, onde uma nota isolada pesa mais.
    const r = calibrar("2026.1", [n("a", 5), n("b", 3), n("b", 3)]);
    expect(r.gestores.find(g => g.gestorId === "a")!.avaliados).toBe(1);
  });

  it("distribui as notas em faixas sem estourar na nota cheia", () => {
    const r = calibrar("2026.1", [n("a", 5), n("a", 4.2), n("a", 0.5)]);
    const d = r.gestores[0].distribuicao;
    expect(d).toHaveLength(5);
    expect(d[4]).toBe(2);   // 5,0 e 4,2 caem na última faixa
    expect(d[0]).toBe(1);   // 0,5
    expect(d.reduce((s, x) => s + x, 0)).toBe(3);
  });

  it("agrupa quem não tem gestor sem quebrar", () => {
    const r = calibrar("2026.1", [{ gestorId: null, gestorNome: "Sem gestor", nota: 4 }]);
    expect(r.gestores[0].gestorId).toBeNull();
    expect(r.gestores[0].avaliados).toBe(1);
  });

  it("ciclo sem nota nenhuma não vira divisão por zero", () => {
    const r = calibrar("2026.1", []);
    expect(r.mediaGeral).toBeNull();
    expect(r.gestores).toEqual([]);
  });
});
