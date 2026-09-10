import { marcoPrazo, degrauEscalonamento, marcoAging, cicloFollowUp, chaves } from "./alerta.entity";
import {
  nivelRisco, scoreRisco, classificacaoGeral, faixaAging, chaveNormalizada, diasEntre,
  oportunidadeEmEstruturacao, formatarCodigo,
} from "./caso.entity";

describe("marcoPrazo", () => {
  const regua = [15, 7, 3, 0];
  it("devolve o limiar mais recente cruzado, não só o exato", () => {
    expect(marcoPrazo(20, regua)).toBeNull();
    expect(marcoPrazo(15, regua)).toBe("15");
    expect(marcoPrazo(12, regua)).toBe("15");
    expect(marcoPrazo(5, regua)).toBe("7");
    expect(marcoPrazo(3, regua)).toBe("3");
    expect(marcoPrazo(0, regua)).toBe("0");
    expect(marcoPrazo(-1, regua)).toBe("vencido");
  });
});

describe("degrauEscalonamento", () => {
  it("sobe a cada ciclo e para no terceiro degrau", () => {
    expect(degrauEscalonamento(4, 5)).toBe(0);
    expect(degrauEscalonamento(5, 5)).toBe(1);
    expect(degrauEscalonamento(10, 5)).toBe(2);
    expect(degrauEscalonamento(40, 5)).toBe(3);
    expect(degrauEscalonamento(10, 0)).toBe(0);
  });
});

describe("marcoAging e cicloFollowUp", () => {
  it("aging devolve a maior faixa cruzada", () => {
    expect(marcoAging(29)).toBeNull();
    expect(marcoAging(30)).toBe(30);
    expect(marcoAging(75)).toBe(60);
    expect(marcoAging(200)).toBe(90);
  });
  it("follow-up: um ciclo por período aguardando", () => {
    expect(cicloFollowUp(29, 30)).toBe(0);
    expect(cicloFollowUp(32, 30)).toBe(1);
    expect(cicloFollowUp(61, 30)).toBe(2);
  });
  it("chave muda quando o prazo muda — é outro compromisso", () => {
    expect(chaves.acao("c", new Date("2026-09-20T00:00:00Z"), "7", "u"))
      .not.toBe(chaves.acao("c", new Date("2026-09-25T00:00:00Z"), "7", "u"));
  });
});

describe("risco", () => {
  it("matriz 5x5 em quatro faixas", () => {
    expect(nivelRisco(scoreRisco(1, 4))).toBe("baixo");
    expect(nivelRisco(scoreRisco(3, 3))).toBe("moderado");
    expect(nivelRisco(scoreRisco(2, 5))).toBe("alto");
    expect(nivelRisco(scoreRisco(3, 5))).toBe("critico");
    expect(nivelRisco(scoreRisco(null, 5))).toBeNull();
  });
  it("classificação geral fica com o pior entre matriz e dimensões", () => {
    expect(classificacaoGeral({ probabilidade: 1, impacto: 2, riscoJuridico: 5 })).toBe("critico");
    expect(classificacaoGeral({})).toBeNull();
  });
});

describe("utilitários", () => {
  it("faixas de aging", () => {
    expect(faixaAging(null)).toBe("sem_registro");
    expect(faixaAging(30)).toBe("ate_30");
    expect(faixaAging(31)).toBe("31_60");
    expect(faixaAging(91)).toBe("acima_90");
  });
  it("normalização une grafias diferentes do mesmo objetivo", () => {
    const a = chaveNormalizada("Alteração de parâmetros");
    expect(chaveNormalizada("Alteração parâmetros")).toBe(a);
    expect(chaveNormalizada("Alteração de parâmetro")).toBe(a);
    expect(chaveNormalizada("Reequilíbrio")).toBe(chaveNormalizada("Reequilibrio"));
    expect(chaveNormalizada("Reduzir condenação ")).toBe("reduzir condenacao");
  });
  it("diasEntre respeita coluna DATE (meia-noite UTC) sem recuar um dia", () => {
    expect(diasEntre(new Date(2026, 8, 10, 23, 0), new Date(Date.UTC(2026, 8, 10)))).toBe(0);
  });
  it("oportunidade deixa de estar em estruturação ao ser protocolada", () => {
    expect(oportunidadeEmEstruturacao("oportunidade", "validacao")).toBe(true);
    expect(oportunidadeEmEstruturacao("oportunidade", "protocolada")).toBe(false);
    expect(oportunidadeEmEstruturacao("assunto", null, "ideia")).toBe(true);
    expect(formatarCodigo(7)).toBe("EST-0007");
  });
});
