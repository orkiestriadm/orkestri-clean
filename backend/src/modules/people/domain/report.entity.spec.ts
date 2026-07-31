import {
  turnover, tempoMedioDeCasaMeses, mesesEntre, distribuicao, campoCsv, montarCsv,
} from "./report.entity";

const d = (iso: string) => new Date(`${iso}T00:00:00`);

describe("turnover", () => {
  it("usa a média entre admissões e desligamentos", () => {
    // (10 + 6) / 2 / 100 = 8%
    expect(turnover({ admissoes: 10, desligamentos: 6, efetivoInicial: 100, efetivoFinal: 100 }))
      .toBe(8);
  });

  it("é zero quando nada se moveu", () => {
    expect(turnover({ admissoes: 0, desligamentos: 0, efetivoInicial: 50, efetivoFinal: 50 }))
      .toBe(0);
  });

  // Sem isto, dividir por zero devolveria Infinity e o painel mostraria "∞%".
  it("é zero quando não havia efetivo", () => {
    expect(turnover({ admissoes: 3, desligamentos: 0, efetivoInicial: 0, efetivoFinal: 0 }))
      .toBe(0);
  });

  // Empresa que dobrou de tamanho: usar só desligamentos daria 4%, escondendo
  // que metade do quadro é gente nova.
  it("acusa rotatividade em empresa que cresceu", () => {
    expect(turnover({ admissoes: 50, desligamentos: 4, efetivoInicial: 50, efetivoFinal: 96 }))
      .toBe(37);
  });
});

describe("tempo de casa", () => {
  const hoje = d("2026-07-29");

  it("faz a média em meses", () => {
    expect(tempoMedioDeCasaMeses([d("2025-07-29"), d("2024-07-29")], hoje)).toBe(18);
  });

  it("ignora quem não tem data de admissão", () => {
    expect(tempoMedioDeCasaMeses([d("2025-07-29"), null], hoje)).toBe(12);
  });

  it("é zero sem ninguém", () => {
    expect(tempoMedioDeCasaMeses([], hoje)).toBe(0);
  });

  it("ignora admissão futura", () => {
    expect(tempoMedioDeCasaMeses([d("2027-01-01")], hoje)).toBe(0);
  });
});

describe("mesesEntre", () => {
  it("conta meses completos", () => {
    expect(mesesEntre(d("2026-01-15"), d("2026-07-15"))).toBe(6);
  });

  // Faltando um dia, o mês ainda não fechou.
  it("não conta mês incompleto", () => {
    expect(mesesEntre(d("2026-01-15"), d("2026-07-14"))).toBe(5);
  });

  it("nunca é negativo", () => {
    expect(mesesEntre(d("2026-07-15"), d("2026-01-15"))).toBe(0);
  });
});

describe("distribuição", () => {
  const rotulos = new Map([["a", "Engenharia"], ["b", "Comercial"]]);

  it("ordena da maior para a menor com percentual", () => {
    const r = distribuicao([{ chave: "b", total: 3 }, { chave: "a", total: 7 }], rotulos);
    expect(r[0]).toEqual({ rotulo: "Engenharia", total: 7, percentual: 70 });
    expect(r[1]).toEqual({ rotulo: "Comercial", total: 3, percentual: 30 });
  });

  // Lacuna de cadastro não é categoria: no topo, esconderia o dado real.
  it("joga 'sem informação' para o fim mesmo sendo a maior fatia", () => {
    const r = distribuicao([{ chave: null, total: 90 }, { chave: "a", total: 10 }], rotulos);
    expect(r[0].rotulo).toBe("Engenharia");
    expect(r[1].rotulo).toBe("Sem informação");
    expect(r[1].total).toBe(90);
  });

  it("não divide por zero em lista vazia", () => {
    expect(distribuicao([], rotulos)).toEqual([]);
  });

  // Distribuição de texto livre (tipo de vínculo) não tem mapa de rótulos: a
  // própria chave É o rótulo. Devolver "—" fazia "CLT" parecer dado ausente.
  it("usa a própria chave quando não há rótulo traduzido", () => {
    expect(distribuicao([{ chave: "CLT", total: 1 }], new Map())[0].rotulo).toBe("CLT");
  });

  it("ainda separa o vazio da chave desconhecida", () => {
    const r = distribuicao([{ chave: null, total: 2 }, { chave: "PJ", total: 5 }], new Map());
    expect(r[0].rotulo).toBe("PJ");
    expect(r[1].rotulo).toBe("Sem informação");
  });
});

describe("CSV", () => {
  it("deixa texto simples intacto", () => {
    expect(campoCsv("Ana Silva")).toBe("Ana Silva");
  });

  it("protege campo com separador", () => {
    expect(campoCsv("Silva; Ana")).toBe('"Silva; Ana"');
  });

  it("duplica aspas internas", () => {
    expect(campoCsv('Ana "Aninha" Silva')).toBe('"Ana ""Aninha"" Silva"');
  });

  it("formata data no padrão brasileiro", () => {
    expect(campoCsv(d("2026-03-10"))).toBe("10/03/2026");
  });

  it("vazio para nulo e indefinido", () => {
    expect(campoCsv(null)).toBe("");
    expect(campoCsv(undefined)).toBe("");
  });

  // Nome gravado como fórmula vira execução ao abrir no Excel.
  it("neutraliza injeção de fórmula", () => {
    expect(campoCsv("=CMD()")).toBe("'=CMD()");
    expect(campoCsv("+1234")).toBe("'+1234");
    expect(campoCsv("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("protege fórmula que também tem separador", () => {
    expect(campoCsv("=A1;B2")).toBe(`"'=A1;B2"`);
  });

  it("monta o arquivo com BOM e CRLF", () => {
    const csv = montarCsv(["Nome", "Cargo"], [["Ana", "Analista"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("Nome;Cargo\r\nAna;Analista");
  });
});
