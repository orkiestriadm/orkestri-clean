import {
  graphEventToOrkestri,
  orkestriEventToGraph,
  computeSyncHash,
  isSeriesMasterWithoutInstance,
  GraphEventLike,
} from "./outlook-mapper";

describe("outlook-mapper", () => {
  describe("graphEventToOrkestri", () => {
    it("converte horário UTC do Graph para Date correto (sem adivinhar fuso)", () => {
      const ev: GraphEventLike = {
        id: "AAA",
        subject: "Reunião com fornecedor",
        start: { dateTime: "2026-08-18T09:00:00.0000000", timeZone: "UTC" },
        end: { dateTime: "2026-08-18T10:00:00.0000000", timeZone: "UTC" },
        location: { displayName: "Sala 2" },
        showAs: "busy",
        "@odata.etag": 'W/"etag1"',
      };
      const m = graphEventToOrkestri(ev)!;
      expect(m.titulo).toBe("Reunião com fornecedor");
      expect(m.inicio.toISOString()).toBe("2026-08-18T09:00:00.000Z");
      expect(m.fim!.toISOString()).toBe("2026-08-18T10:00:00.000Z");
      expect(m.local).toBe("Sala 2");
      expect(m.diaTodo).toBe(false);
      expect(m.cancelled).toBe(false);
      expect(m.externalEtag).toBe('W/"etag1"');
    });

    it("trata evento de dia inteiro pela data", () => {
      const ev: GraphEventLike = {
        id: "DAY",
        subject: "Feriado",
        isAllDay: true,
        start: { date: "2026-12-25" },
        end: { date: "2026-12-26" },
        showAs: "oof",
      };
      const m = graphEventToOrkestri(ev)!;
      expect(m.diaTodo).toBe(true);
      expect(m.inicio.toISOString()).toBe("2026-12-25T00:00:00.000Z");
    });

    it("marca cancelado quando @removed vem no delta", () => {
      const ev: GraphEventLike = { id: "X", "@removed": { reason: "deleted" } };
      const m = graphEventToOrkestri(ev)!;
      expect(m.cancelled).toBe(true);
    });

    it("marca cancelado quando isCancelled=true", () => {
      const ev: GraphEventLike = {
        id: "C", subject: "Cancelada", isCancelled: true,
        start: { dateTime: "2026-08-18T09:00:00", timeZone: "UTC" },
      };
      expect(graphEventToOrkestri(ev)!.cancelled).toBe(true);
    });

    it('sinaliza showAsFree para "free" e "workingElsewhere" (não ocupa agenda)', () => {
      const base = { id: "F", subject: "Livre", start: { dateTime: "2026-08-18T09:00:00", timeZone: "UTC" } };
      expect(graphEventToOrkestri({ ...base, showAs: "free" })!.showAsFree).toBe(true);
      expect(graphEventToOrkestri({ ...base, showAs: "workingElsewhere" })!.showAsFree).toBe(true);
      expect(graphEventToOrkestri({ ...base, showAs: "busy" })!.showAsFree).toBe(false);
    });

    it("usa título de fallback quando subject vazio", () => {
      const ev: GraphEventLike = { id: "N", start: { dateTime: "2026-08-18T09:00:00", timeZone: "UTC" } };
      expect(graphEventToOrkestri(ev)!.titulo).toBe("(Sem título)");
    });

    it("retorna null quando não há início e não é removido", () => {
      expect(graphEventToOrkestri({ id: "Z", subject: "sem data" })).toBeNull();
    });

    it("anexa link de reunião online à descrição", () => {
      const ev: GraphEventLike = {
        id: "M", subject: "Call", start: { dateTime: "2026-08-18T09:00:00", timeZone: "UTC" },
        onlineMeeting: { joinUrl: "https://teams.microsoft.com/l/xyz" },
      };
      expect(graphEventToOrkestri(ev)!.descricao).toContain("teams.microsoft.com");
    });
  });

  describe("computeSyncHash", () => {
    it("é estável para o mesmo conteúdo e muda quando o conteúdo muda", () => {
      const a = computeSyncHash({ titulo: "T", inicio: new Date("2026-08-18T09:00:00Z"), fim: new Date("2026-08-18T10:00:00Z"), diaTodo: false, local: "Sala", cancelled: false });
      const b = computeSyncHash({ titulo: "T", inicio: new Date("2026-08-18T09:00:00Z"), fim: new Date("2026-08-18T10:00:00Z"), diaTodo: false, local: "Sala", cancelled: false });
      const c = computeSyncHash({ titulo: "T2", inicio: new Date("2026-08-18T09:00:00Z"), fim: new Date("2026-08-18T10:00:00Z"), diaTodo: false, local: "Sala", cancelled: false });
      expect(a).toBe(b);
      expect(a).not.toBe(c);
    });
  });

  describe("isSeriesMasterWithoutInstance", () => {
    it("identifica o mestre da série (que deve ser ignorado)", () => {
      expect(isSeriesMasterWithoutInstance({ id: "S", type: "seriesMaster" })).toBe(true);
      expect(isSeriesMasterWithoutInstance({ id: "O", type: "occurrence" })).toBe(false);
    });
  });

  describe("orkestriEventToGraph", () => {
    it("monta corpo com start/end em UTC e assume 1h sem fim", () => {
      const body = orkestriEventToGraph({ titulo: "Nova", inicio: new Date("2026-08-18T14:00:00Z"), fim: null, local: "Zoom" });
      expect(body.subject).toBe("Nova");
      expect(body.start.timeZone).toBe("UTC");
      expect(body.start.dateTime).toContain("2026-08-18T14:00:00");
      expect(body.end.dateTime).toContain("2026-08-18T15:00:00");
      expect(body.location.displayName).toBe("Zoom");
      expect(body.isAllDay).toBe(false);
    });

    it("monta evento de dia inteiro com limites de meia-noite", () => {
      const body = orkestriEventToGraph({ titulo: "Folga", inicio: new Date("2026-08-18T00:00:00Z"), diaTodo: true });
      expect(body.isAllDay).toBe(true);
      expect(body.start.dateTime).toContain("2026-08-18T00:00:00");
      expect(body.end.dateTime).toContain("2026-08-19T00:00:00");
    });
  });
});
