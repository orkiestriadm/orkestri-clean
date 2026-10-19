import {
  MODULO_IDS, moduloValido, normalizarModulo, modulosVisiveis,
  severidadeAtende, ehCritico,
} from "./notificacao-modulos";

/**
 * Regra de permissão falha em SILÊNCIO: quando ela quebra, ninguém vê erro na
 * tela — a pessoa simplesmente para de receber, ou passa a receber o que não
 * devia. É a razão de existir teste aqui e não só validação manual.
 */
describe("notificacao-modulos", () => {
  describe("normalizarModulo — ponte entre os dois vocabulários", () => {
    // `UserProfile.modulos` guarda slugs LEGADOS em português enquanto o menu e
    // as preferências usam ids de produto em inglês. Sem esta ponte a
    // comparação falharia calada.
    it("converte slug legado para id de produto", () => {
      expect(normalizarModulo("projetos")).toBe("projects");
      expect(normalizarModulo("orcamento")).toBe("budget");
      expect(normalizarModulo("financeiro")).toBe("finance");
      expect(normalizarModulo("agenda")).toBe("space");
    });

    it("mantém id que já é de produto", () => {
      expect(normalizarModulo("projects")).toBe("projects");
      expect(normalizarModulo("finance")).toBe("finance");
    });

    // Os slugs dos módulos removidos em 18/10/2026 seguem no mapa: contas
    // antigas ainda os têm gravados, e traduzi-los devolve um id reconhecível
    // em vez do slug cru. Eles simplesmente não casam com módulo vivo.
    it("ainda traduz slug de módulo removido, que deixa de ser válido", () => {
      expect(normalizarModulo("frota")).toBe("fleet");
      expect(moduloValido("fleet")).toBe(false);
    });

    it("é indiferente a caixa e espaços", () => {
      expect(normalizarModulo("  PROJETOS  ")).toBe("projects");
    });

    it("devolve vazio para entrada vazia", () => {
      expect(normalizarModulo("")).toBe("");
      expect(normalizarModulo(null as any)).toBe("");
    });
  });

  describe("modulosVisiveis", () => {
    // Retrocompatibilidade já estabelecida no gating do Sidebar: lista vazia
    // significa "vê tudo". Se este helper tratasse vazio como "nada", quem
    // nunca foi configurado perderia acesso E notificação de uma vez.
    it("lista vazia significa ver tudo", () => {
      expect(modulosVisiveis("[]")).toHaveLength(MODULO_IDS.length);
      expect(modulosVisiveis(null)).toHaveLength(MODULO_IDS.length);
      expect(modulosVisiveis(undefined)).toHaveLength(MODULO_IDS.length);
    });

    it("JSON inválido não derruba — cai no ver tudo", () => {
      expect(modulosVisiveis("{quebrado")).toHaveLength(MODULO_IDS.length);
    });

    it("restringe e normaliza ao mesmo tempo", () => {
      expect(modulosVisiveis('["projetos"]')).toEqual(["projects"]);
      expect(modulosVisiveis('["projetos","financeiro"]')).toEqual(["projects", "finance"]);
    });
  });

  describe("severidadeAtende", () => {
    it("recebe do nível mínimo para cima", () => {
      expect(severidadeAtende("critico", "aviso")).toBe(true);
      expect(severidadeAtende("aviso", "aviso")).toBe(true);
      expect(severidadeAtende("critico", "info")).toBe(true);
    });

    it("filtra abaixo do mínimo", () => {
      expect(severidadeAtende("info", "critico")).toBe(false);
      expect(severidadeAtende("aviso", "critico")).toBe(false);
    });

    it("severidade desconhecida é tratada como o nível mais baixo", () => {
      expect(severidadeAtende("qualquer", "critico")).toBe(false);
      expect(severidadeAtende("qualquer", "info")).toBe(true);
    });
  });

  describe("moduloValido", () => {
    it("aceita id conhecido e recusa inventado", () => {
      expect(moduloValido("projects")).toBe(true);
      expect(moduloValido("inventado")).toBe(false);
    });
  });

  it("ehCritico só para critico", () => {
    expect(ehCritico("critico")).toBe(true);
    expect(ehCritico("aviso")).toBe(false);
  });
});
