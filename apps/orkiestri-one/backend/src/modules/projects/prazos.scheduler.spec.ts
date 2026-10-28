import { PrazosProjetoScheduler } from "./prazos.scheduler";

/**
 * Os marcos de prazo.
 *
 * Duas coisas aqui erram em silêncio e só aparecem semanas depois, no aviso que
 * não chegou ou no que chegou todo dia:
 *
 *  1. contar dias por milissegundos em vez de dias de calendário — "vence
 *     amanhã" vira 0 quando a varredura roda de manhã e o prazo está gravado à
 *     noite, e o aviso sai com o marco errado;
 *  2. a chave de deduplicação — se ela carregasse a data, prazo vencido
 *     mandaria a mesma mensagem todo dia até alguém mexer.
 */

/** Alcança os métodos privados: é a lógica que interessa testar. */
const vigia = new PrazosProjetoScheduler({} as any, {} as any) as any;

const emDias = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

describe("marcos de prazo", () => {
  const hoje = new Date();

  describe("contagem em dias de calendário", () => {
    it("conta o dia, não 24 horas: prazo à noite ainda é 'amanhã' de manhã", () => {
      const amanhaTarde = emDias(1);
      amanhaTarde.setHours(23, 30, 0, 0);
      const manha = new Date(hoje);
      manha.setHours(7, 0, 0, 0);

      expect(vigia.diasAte(amanhaTarde, manha)).toBe(1);
    });

    it("hoje é zero, mesmo com horas diferentes", () => {
      const hojeTarde = new Date(hoje);
      hojeTarde.setHours(23, 0, 0, 0);
      const hojeCedo = new Date(hoje);
      hojeCedo.setHours(1, 0, 0, 0);

      expect(vigia.diasAte(hojeTarde, hojeCedo)).toBe(0);
    });

    it("passado é negativo", () => {
      expect(vigia.diasAte(emDias(-3), hoje)).toBe(-3);
    });
  });

  describe("quais dias geram aviso", () => {
    it("avisa nos marcos de antes", () => {
      for (const d of [15, 7, 3, 1, 0]) {
        expect(vigia.marcoDe(d)).not.toBeNull();
      }
    });

    it("cala nos dias entre marcos — senão vira aviso diário", () => {
      for (const d of [30, 20, 14, 10, 5, 2]) {
        expect(vigia.marcoDe(d)).toBeNull();
      }
    });

    it("insiste no atraso, mas só nos marcos", () => {
      for (const d of [1, 3, 7, 15, 30]) {
        expect(vigia.marcoDe(-d)).not.toBeNull();
      }
      for (const d of [2, 5, 9, 21, 45]) {
        expect(vigia.marcoDe(-d)).toBeNull();
      }
    });
  });

  describe("o texto e o tom", () => {
    it("'vence hoje' no dia, sem número", () => {
      expect(vigia.marcoDe(0).texto).toBe("vence hoje");
    });

    it("singular e plural, para não sair 'em 1 dias'", () => {
      expect(vigia.marcoDe(1).texto).toContain("1 dia");
      expect(vigia.marcoDe(1).texto).not.toContain("dias");
      expect(vigia.marcoDe(7).texto).toContain("7 dias");
      expect(vigia.marcoDe(-1).texto).toContain("1 dia");
      expect(vigia.marcoDe(-1).texto).not.toContain("dias");
    });

    it("véspera e atraso sobem de tom; o resto é informativo", () => {
      expect(vigia.marcoDe(15).grave).toBe(false);
      expect(vigia.marcoDe(7).grave).toBe(false);
      expect(vigia.marcoDe(1).grave).toBe(true);
      expect(vigia.marcoDe(0).grave).toBe(true);
      expect(vigia.marcoDe(-1).grave).toBe(true);
    });
  });

  describe("deduplicação", () => {
    it("a chave carrega o MARCO, não a data — aviso de futuro sai uma vez só", () => {
      expect(vigia.marcoDe(7).chave).toBe("prazo:7");
      expect(vigia.marcoDe(0).chave).toBe("prazo:0");
      // Sem data na chave, rodar a varredura de novo no mesmo dia não repete.
      expect(vigia.marcoDe(7).chave).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it("no atraso a chave MUDA a cada marco — a cobrança precisa insistir", () => {
      expect(vigia.marcoDe(-1).chave).toBe("atraso:1");
      expect(vigia.marcoDe(-7).chave).toBe("atraso:7");
      expect(vigia.marcoDe(-1).chave).not.toBe(vigia.marcoDe(-3).chave);
    });

    it("antes e depois nunca colidem", () => {
      expect(vigia.marcoDe(1).chave).not.toBe(vigia.marcoDe(-1).chave);
    });
  });
});
