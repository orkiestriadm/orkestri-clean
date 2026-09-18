import { expandLegacyPermissions, legacyAliasesOf } from "./permission-aliases";
import { PEOPLE_PERMISSIONS } from "../modules/people/people.permissions";

/**
 * Sem estes testes, o deploy que introduz as rotas do People tiraria acesso de
 * quem hoje usa papel customizado com `colaboradores:*` — esses papéis não estão
 * em ROLE_DEFAULTS e não recebem as permissões novas pela semente.
 */
describe("compatibilidade de permissões", () => {
  it("quem via colaboradores continua vendo colaboradores", () => {
    const perms = expandLegacyPermissions(["colaboradores:ver"]);
    expect(perms.has(PEOPLE_PERMISSIONS.colaborador.ver)).toBe(true);
  });

  it("ver colaboradores também mostra o catálogo de cargos", () => {
    const perms = expandLegacyPermissions(["colaboradores:ver"]);
    expect(perms.has(PEOPLE_PERMISSIONS.cargo.ver)).toBe(true);
  });

  it("editar colaborador também permite mudar a situação funcional", () => {
    const perms = expandLegacyPermissions(["colaboradores:editar"]);
    expect(perms.has(PEOPLE_PERMISSIONS.colaborador.editar)).toBe(true);
    expect(perms.has(PEOPLE_PERMISSIONS.colaborador.mudarSituacao)).toBe(true);
  });

  it("preserva as permissões originais", () => {
    const perms = expandLegacyPermissions(["colaboradores:ver", "chamados:ver"]);
    expect(perms.has("colaboradores:ver")).toBe(true);
    expect(perms.has("chamados:ver")).toBe(true);
  });

  it("aceita permissões já no formato novo sem alterá-las", () => {
    const perms = expandLegacyPermissions([PEOPLE_PERMISSIONS.colaborador.criar]);
    expect(perms.has(PEOPLE_PERMISSIONS.colaborador.criar)).toBe(true);
    expect(perms.size).toBe(1);
  });

  describe("o alias não concede além do que a permissão antiga autorizava", () => {
    // Documento é dado restrito, com concessão própria. Ninguém consentiu com
    // esse acesso ao marcar "ver colaboradores" no passado.
    it("ver colaboradores NÃO dá acesso a documentos", () => {
      const perms = expandLegacyPermissions(["colaboradores:ver"]);
      expect(perms.has(PEOPLE_PERMISSIONS.documento.ver)).toBe(false);
      expect(perms.has(PEOPLE_PERMISSIONS.documento.enviar)).toBe(false);
      expect(perms.has(PEOPLE_PERMISSIONS.documento.aprovar)).toBe(false);
    });

    // `ver_todos` é o que define escopo organizacional. Concedê-lo por alias
    // daria a qualquer gestor a visão da empresa inteira.
    it("ver colaboradores NÃO amplia o escopo para a organização", () => {
      const perms = expandLegacyPermissions(["colaboradores:ver"]);
      expect(perms.has(PEOPLE_PERMISSIONS.colaborador.verTodos)).toBe(false);
    });

    it("leitura não vira escrita", () => {
      const perms = expandLegacyPermissions(["colaboradores:ver"]);
      expect(perms.has(PEOPLE_PERMISSIONS.colaborador.criar)).toBe(false);
      expect(perms.has(PEOPLE_PERMISSIONS.colaborador.excluir)).toBe(false);
    });

    it("não concede nada a quem não tem permissão relacionada", () => {
      const perms = expandLegacyPermissions(["chamados:ver", "frota:ver"]);
      expect(perms.has(PEOPLE_PERMISSIONS.colaborador.ver)).toBe(false);
      expect(perms.size).toBe(2);
    });
  });

  it("lida com lista vazia", () => {
    expect(expandLegacyPermissions([]).size).toBe(0);
  });

  it("não inventa alias para permissão desconhecida", () => {
    expect(legacyAliasesOf("inexistente:acao")).toEqual([]);
  });
});

describe("formato das permissões", () => {
  // O guard compara `${recurso}:${acao}`. Um valor sem dois-pontos jamais
  // existiria na tabela `permissions` — seria inconcedível e inverificável.
  it("toda permissão do People é armazenável como recurso:acao", () => {
    const todas = Object.values(PEOPLE_PERMISSIONS).flatMap(g => Object.values(g));
    for (const perm of todas) {
      expect(perm.split(":")).toHaveLength(2);
      expect(perm.startsWith("people.")).toBe(true);
    }
  });
});

/**
 * O sentido que faltava: papel criado já no formato novo precisa passar nas
 * telas ainda guardadas pelo formato antigo. Caso real: "Gestor de RH" no Hub,
 * 17/09/2026 — sem isto, a gestora de RH não via Colaboradores no menu e
 * Equipes respondia 403.
 */
describe("temPermissao — exigência antiga atendida pelas novas", () => {
  const { temPermissao } = require("./permission-aliases");
  const RH = [PEOPLE_PERMISSIONS.colaborador.ver, PEOPLE_PERMISSIONS.cargo.ver, PEOPLE_PERMISSIONS.colaborador.verTodos];

  it("quem tem as novas equivalentes atende colaboradores:ver", () => {
    expect(temPermissao(RH, "colaboradores:ver")).toBe(true);
  });

  it("exige TODAS as novas: só ver colaborador não basta para colaboradores:ver", () => {
    // A antiga concedia colaborador E cargo. Aceitar metade seria conceder a
    // mais do que o papel novo deu.
    expect(temPermissao([PEOPLE_PERMISSIONS.colaborador.ver], "colaboradores:ver")).toBe(false);
  });

  it("editar antigo exige editar e mudar situação", () => {
    expect(temPermissao([PEOPLE_PERMISSIONS.colaborador.editar], "colaboradores:editar")).toBe(false);
    expect(temPermissao(
      [PEOPLE_PERMISSIONS.colaborador.editar, PEOPLE_PERMISSIONS.colaborador.mudarSituacao],
      "colaboradores:editar",
    )).toBe(true);
  });

  it("o sentido antigo continua: quem tem a antiga atende a nova", () => {
    expect(temPermissao(["colaboradores:ver"], PEOPLE_PERMISSIONS.colaborador.ver)).toBe(true);
    expect(temPermissao(["colaboradores:ver"], "colaboradores:ver")).toBe(true);
  });

  it("não inventa equivalência para permissão sem alias", () => {
    expect(temPermissao(RH, "chamados:ver")).toBe(false);
    expect(temPermissao(["*"], "chamados:ver")).toBe(true);
  });
});
