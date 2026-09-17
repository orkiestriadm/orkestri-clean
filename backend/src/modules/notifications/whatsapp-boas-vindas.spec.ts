import { montarBoasVindasCadastro, normalizarWhatsapp } from "./whatsapp-boas-vindas";

describe("whatsapp-boas-vindas", () => {
  const base = {
    nome: "Daiana Mendes", email: "daiana.mendes@triunfo.com",
    marca: "HUB Triunfo Transbrasiliana", url: "https://hub.triunfotransbrasiliana.com.br",
  };

  describe("normalizarWhatsapp", () => {
    it("guarda só os dígitos", () => {
      expect(normalizarWhatsapp("(14) 99123-4567")).toBe("14991234567");
      expect(normalizarWhatsapp("+55 14 99123-4567")).toBe("5514991234567");
    });
    it("vazio vira null (sem WhatsApp)", () => {
      expect(normalizarWhatsapp("")).toBeNull();
      expect(normalizarWhatsapp(undefined)).toBeNull();
      expect(normalizarWhatsapp("  ")).toBeNull();
    });
    it("número curto ou longo demais é recusado", () => {
      expect(() => normalizarWhatsapp("99123-4567")).toThrow();
      expect(() => normalizarWhatsapp("55149912345678")).toThrow();
    });
  });

  describe("montarBoasVindasCadastro", () => {
    it("papel Projetos + Space: só os blocos de Projetos e Agenda", () => {
      const m = montarBoasVindasCadastro({
        ...base,
        permissoes: ["projetos:ver", "projetos:editar", "gantt:ver", "agenda:ver", "keep:ver"],
      });
      expect(m.startsWith("*👋 Olá, Daiana!*")).toBe(true);
      expect(m).toContain("📁 *Projetos*");
      expect(m).toContain("🗓️ *Agenda*");
      expect(m).not.toContain("Chamados");
      expect(m).not.toContain("Aprovações");
      expect(m).not.toContain("Frotas");
      expect(m).toContain("Endereço: https://hub.triunfotransbrasiliana.com.br");
      expect(m).toContain("Usuário: daiana.mendes@triunfo.com");
      expect(m).toContain("Não reconhece este cadastro?");
    });

    it("master recebe todos os blocos", () => {
      const m = montarBoasVindasCadastro({ ...base, permissoes: ["*"] });
      for (const t of ["Projetos", "Agenda", "Chamados", "Aprovações", "Frotas"]) expect(m).toContain(t);
    });

    it("sem nenhum módulo com aviso, não mostra a lista vazia", () => {
      const m = montarBoasVindasCadastro({ ...base, permissoes: ["keep:ver"] });
      expect(m).not.toContain("O que vai chegar");
      expect(m).toContain("Como acessar");
    });

    it("sem senha inicial informada, não escreve senha nenhuma", () => {
      const m = montarBoasVindasCadastro({ ...base, permissoes: ["*"] });
      expect(m.toLowerCase()).not.toMatch(/senha inicial:\s*\S/);
      expect(m).toContain("A senha inicial é passada pelo administrador");
    });

    it("com senha inicial, mostra a senha e avisa da troca no primeiro acesso", () => {
      const m = montarBoasVindasCadastro({ ...base, permissoes: ["projetos:ver"], senhaInicial: "123@Mudar" });
      expect(m).toContain("Senha inicial: 123@Mudar");
      expect(m).toContain("No primeiro acesso o sistema pede para você criar a sua senha.");
      expect(m).not.toContain("passada pelo administrador");
    });

    it("nada de Orkiestri no texto", () => {
      const m = montarBoasVindasCadastro({ ...base, permissoes: ["*"], senhaInicial: "123@Mudar" });
      expect(m.toLowerCase()).not.toMatch(/orkiestri|orkestri/);
    });
  });
});
