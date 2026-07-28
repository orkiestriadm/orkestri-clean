import { PeopleScopeService } from "./people-scope.service";

/**
 * Testes de isolamento e escopo — o requisito de segurança central do módulo.
 *
 * PEOPLE_PERMISSIONS.md §20 e MULTITENANT.md §9: nenhum usuário pode enxergar
 * dado fora da própria organização, e gestor só vê a própria árvore.
 */

type Colaborador = { id: string; userId?: string | null; gestorId?: string | null; organizationId: string };

/** Prisma falso que respeita organizationId e gestorId — como o banco faria. */
function prismaFake(colaboradores: Colaborador[]) {
  const vivos = (where: any) =>
    colaboradores.filter((c) => !where.organizationId || c.organizationId === where.organizationId);

  return {
    collaborator: {
      findFirst: jest.fn(async ({ where }: any) => {
        const achados = vivos(where).filter((c) =>
          (where.id === undefined || c.id === where.id) &&
          (where.userId === undefined || c.userId === where.userId));
        return achados[0] ? { id: achados[0].id } : null;
      }),
      findMany: jest.fn(async ({ where }: any) => {
        const gestores: string[] = where.gestorId?.in ?? [];
        return vivos(where)
          .filter((c) => c.gestorId && gestores.includes(c.gestorId))
          .map((c) => ({ id: c.id }));
      }),
    },
  } as any;
}

// ORG-A: gestor g1 tem d1 e d2; d1 tem n1 (neto). Solto: s1.
// ORG-B: existe para provar que nunca vaza.
const BASE: Colaborador[] = [
  { id: "g1", userId: "u-gestor", gestorId: null, organizationId: "org-a" },
  { id: "d1", userId: "u-d1", gestorId: "g1", organizationId: "org-a" },
  { id: "d2", userId: "u-d2", gestorId: "g1", organizationId: "org-a" },
  { id: "n1", userId: null, gestorId: "d1", organizationId: "org-a" },
  { id: "s1", userId: "u-solto", gestorId: null, organizationId: "org-a" },
  { id: "b1", userId: "u-outra-org", gestorId: null, organizationId: "org-b" },
];

function servico(dados = BASE) {
  return new PeopleScopeService(prismaFake(dados));
}

describe("escopo por papel", () => {
  it("master enxerga a organização inteira", async () => {
    const escopo = await servico().resolve({ id: "u-x", organizationId: "org-a", isMaster: true });
    expect(escopo.tipo).toBe("organizacao");
  });

  // O escopo organizacional vem de PERMISSÃO, não de nome de papel. A primeira
  // versão comparava contra `rh_admin`/`hr_admin`, que não existem no sistema —
  // um analista de RH real enxergava só a si.
  it("quem tem ver_todos enxerga a organização inteira", async () => {
    const escopo = await servico().resolve({
      id: "u-rh", organizationId: "org-a", permissions: ["people.colaborador:ver_todos"],
    });
    expect(escopo.tipo).toBe("organizacao");
  });

  it("permissão coringa também dá escopo organizacional", async () => {
    const escopo = await servico().resolve({
      id: "u-x", organizationId: "org-a", permissions: ["*"],
    });
    expect(escopo.tipo).toBe("organizacao");
  });

  // Nome de papel não decide mais nada: um papel chamado "administrador" sem a
  // permissão não amplia escopo.
  it("nome de papel sozinho não amplia o escopo", async () => {
    const escopo = await servico().resolve({
      id: "u-gestor", organizationId: "org-a", roles: ["administrador"], permissions: [],
    });
    expect(escopo.tipo).toBe("equipe");
  });

  it("permissão apenas de leitura não amplia o escopo", async () => {
    const escopo = await servico().resolve({
      id: "u-solto", organizationId: "org-a", permissions: ["people.colaborador:ver"],
    });
    expect(escopo.tipo).toBe("proprio");
  });

  it("gestor enxerga a si, diretos e indiretos", async () => {
    const escopo = await servico().resolve({ id: "u-gestor", organizationId: "org-a" });
    expect(escopo.tipo).toBe("equipe");
    if (escopo.tipo !== "equipe") return;
    expect(escopo.collaboratorIds.sort()).toEqual(["d1", "d2", "g1", "n1"]);
  });

  it("colaborador sem liderados enxerga apenas a si", async () => {
    const escopo = await servico().resolve({ id: "u-solto", organizationId: "org-a" });
    expect(escopo.tipo).toBe("proprio");
    if (escopo.tipo !== "proprio") return;
    expect(escopo.collaboratorIds).toEqual(["s1"]);
  });

  it("usuário sem colaborador não enxerga ninguém", async () => {
    const escopo = await servico().resolve({ id: "u-fantasma", organizationId: "org-a" });
    expect(escopo.tipo).toBe("nenhum");
  });

  it("usuário sem organização no contexto não enxerga ninguém", async () => {
    const escopo = await servico().resolve({ id: "u-gestor" });
    expect(escopo.tipo).toBe("nenhum");
  });
});

describe("filtro Prisma resultante", () => {
  it("sempre exclui registros com soft delete", async () => {
    const where = await servico().whereColaborador({
      id: "u-rh", organizationId: "org-a", permissions: ["people.colaborador:ver_todos"],
    });
    expect(where.excluidoEm).toBeNull();
    expect(where.organizationId).toBe("org-a");
    // Escopo organizacional não restringe por id — se restringisse, a asserção
    // acima passaria mesmo com o escopo errado.
    expect(where.id).toBeUndefined();
  });

  it("restringe o gestor à própria árvore", async () => {
    const where = await servico().whereColaborador({ id: "u-gestor", organizationId: "org-a" });
    expect(where.id.in.sort()).toEqual(["d1", "d2", "g1", "n1"]);
  });

  // Nega por construção, não por omissão: um bug futuro que ignore o escopo
  // ainda assim não devolve linha nenhuma.
  it("nega acesso com lista vazia quando não há escopo", async () => {
    const where = await servico().whereColaborador({ id: "u-fantasma", organizationId: "org-a" });
    expect(where.id).toEqual({ in: [] });
  });
});

describe("isolamento entre organizações", () => {
  it("gestor de uma org não alcança colaborador de outra", async () => {
    expect(await servico().podeAcessar({ id: "u-gestor", organizationId: "org-a" }, "b1"))
      .toBe(false);
  });

  it("RH de uma org não alcança colaborador de outra", async () => {
    expect(await servico().podeAcessar(
      { id: "u-rh", organizationId: "org-a", permissions: ["people.colaborador:ver_todos"] }, "b1",
    )).toBe(false);
  });

  it("master de uma org não alcança colaborador de outra", async () => {
    expect(await servico().podeAcessar(
      { id: "u-x", organizationId: "org-a", isMaster: true }, "b1",
    )).toBe(false);
  });

  it("gestor não alcança colega fora da sua árvore na mesma org", async () => {
    expect(await servico().podeAcessar({ id: "u-gestor", organizationId: "org-a" }, "s1"))
      .toBe(false);
  });

  it("gestor alcança liderado indireto", async () => {
    expect(await servico().podeAcessar({ id: "u-gestor", organizationId: "org-a" }, "n1"))
      .toBe(true);
  });

  it("colaborador comum alcança apenas o próprio registro", async () => {
    const contexto = { id: "u-solto", organizationId: "org-a" };
    expect(await servico().podeAcessar(contexto, "s1")).toBe(true);
    expect(await servico().podeAcessar(contexto, "g1")).toBe(false);
  });
});

describe("robustez da travessia de hierarquia", () => {
  // O domínio impede criar ciclo, mas dado legado pode conter — a travessia
  // não pode entrar em laço infinito.
  it("termina mesmo com ciclo nos dados", async () => {
    const ciclico: Colaborador[] = [
      { id: "x", userId: "u-x", gestorId: "y", organizationId: "org-a" },
      { id: "y", userId: null, gestorId: "x", organizationId: "org-a" },
    ];
    const escopo = await servico(ciclico).resolve({ id: "u-x", organizationId: "org-a" });
    expect(escopo.tipo).toBe("equipe");
    if (escopo.tipo !== "equipe") return;
    expect(escopo.collaboratorIds.sort()).toEqual(["x", "y"]);
  });
});
