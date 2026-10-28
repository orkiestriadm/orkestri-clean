import { calcPct, projetoConcluido, transicaoDeConclusao } from "./progresso";

/**
 * Quando o projeto sai da fila e vai para Projetos Concluídos.
 *
 * O erro silencioso aqui é tratar "100% na barra" como "acabou": o progresso é
 * ponderado e arredondado, então um projeto grande com uma tarefa ainda em
 * revisão já mostrava 100% — e sairia da fila com trabalho aberto.
 */

const tarefas = (...status: string[]) => status.map(s => ({ status: s }));

describe("conclusão do projeto", () => {
  it("concluído só com toda tarefa ativa em Concluída", () => {
    expect(projetoConcluido(tarefas("CONCLUIDA", "CONCLUIDA"))).toBe(true);
    expect(projetoConcluido(tarefas("CONCLUIDA", "EM_REVISAO"))).toBe(false);
    expect(projetoConcluido(tarefas("A_FAZER"))).toBe(false);
  });

  it("tarefa cancelada não trava a conclusão", () => {
    expect(projetoConcluido(tarefas("CONCLUIDA", "CANCELADA"))).toBe(true);
  });

  it("projeto sem tarefa (ou só com canceladas) não é concluído", () => {
    expect(projetoConcluido([])).toBe(false);
    expect(projetoConcluido(tarefas("CANCELADA"))).toBe(false);
  });

  it("a barra só mostra 100% quando concluiu de fato", () => {
    const quase = [...tarefas(...Array(99).fill("CONCLUIDA")), { status: "EM_REVISAO" }];
    expect(projetoConcluido(quase)).toBe(false);
    expect(calcPct(quase)).toBe(99);
    expect(calcPct(tarefas("CONCLUIDA", "CONCLUIDA"))).toBe(100);
  });

  it("progresso ponderado continua o mesmo abaixo de 100%", () => {
    expect(calcPct(tarefas("A_FAZER", "EM_ANDAMENTO"))).toBe(25);
    expect(calcPct(tarefas("EM_REVISAO", "CONCLUIDA"))).toBe(90);
  });

  describe("troca de fila", () => {
    const ontem = new Date(Date.now() - 86_400_000);

    it("chegou a 100% e ainda não tinha data: conclui", () => {
      expect(transicaoDeConclusao(true, null)).toBe("concluir");
    });

    it("já estava concluído: não repete (nem reenvia aviso)", () => {
      expect(transicaoDeConclusao(true, ontem)).toBeNull();
    });

    it("estava concluído e uma tarefa saiu de Concluída: reabre", () => {
      expect(transicaoDeConclusao(false, ontem)).toBe("reabrir");
    });

    it("em andamento que continua em andamento: nada muda", () => {
      expect(transicaoDeConclusao(false, null)).toBeNull();
    });
  });
});
