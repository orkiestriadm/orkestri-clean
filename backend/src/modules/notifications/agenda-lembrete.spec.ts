import {
  LEMBRETE_PADRAO, regrasDaOrganizacao, momentoAvisoDiaInteiro, horaDoAvisoDiaInteiro, recebeWhatsApp,
} from "./agenda-lembrete";

describe("agenda-lembrete", () => {
  describe("regrasDaOrganizacao", () => {
    const regras = [
      { organizationId: "org-a", minutos: 15, ativo: true },
      { organizationId: "org-a", minutos: 60, ativo: false },
      { organizationId: "org-b", minutos: 30, ativo: true },
    ];

    it("usa só as ativas da própria organização", () => {
      expect(regrasDaOrganizacao(regras, "org-a").map(r => r.minutos)).toEqual([15]);
      expect(regrasDaOrganizacao(regras, "org-b").map(r => r.minutos)).toEqual([30]);
    });

    it("organização sem regra nenhuma recebe o padrão de 15 minutos", () => {
      expect(regrasDaOrganizacao(regras, "org-c")).toEqual([LEMBRETE_PADRAO]);
      expect(LEMBRETE_PADRAO.minutos).toBe(15);
    });

    it("se o administrador desligou todas, não avisa (não cai no padrão)", () => {
      const desligadas = [{ organizationId: "org-a", minutos: 15, ativo: false }];
      expect(regrasDaOrganizacao(desligadas, "org-a")).toEqual([]);
    });
  });

  describe("dia inteiro", () => {
    it("do Outlook (meia-noite UTC): 08:00 de São Paulo do mesmo dia, não 21h da véspera", () => {
      const inicio = new Date("2026-09-20T00:00:00Z");
      expect(momentoAvisoDiaInteiro(inicio).toISOString()).toBe("2026-09-20T11:00:00.000Z");
    });

    it("criado no sistema (meia-noite local = 03:00 UTC): mesmo dia às 08:00", () => {
      const inicio = new Date("2026-09-20T03:00:00Z");
      expect(momentoAvisoDiaInteiro(inicio).toISOString()).toBe("2026-09-20T11:00:00.000Z");
    });

    it("avisa só na janela logo depois das 08:00", () => {
      const inicio = new Date("2026-09-20T00:00:00Z");
      expect(horaDoAvisoDiaInteiro(inicio, new Date("2026-09-19T21:00:00Z"))).toBe(false);
      expect(horaDoAvisoDiaInteiro(inicio, new Date("2026-09-20T10:59:00Z"))).toBe(false);
      expect(horaDoAvisoDiaInteiro(inicio, new Date("2026-09-20T11:01:00Z"))).toBe(true);
      expect(horaDoAvisoDiaInteiro(inicio, new Date("2026-09-20T11:30:00Z"))).toBe(false);
    });
  });

  describe("recebeWhatsApp", () => {
    it("só número confirmado pelo código", () => {
      expect(recebeWhatsApp({ whatsapp: "5514999990000", whatsappVerificado: true })).toBe(true);
      expect(recebeWhatsApp({ whatsapp: "5514999990000", whatsappVerificado: false })).toBe(false);
      expect(recebeWhatsApp({ whatsapp: "", whatsappVerificado: true })).toBe(false);
      expect(recebeWhatsApp(null)).toBe(false);
    });
  });
});
