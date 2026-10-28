import { NotFoundException, InternalServerErrorException } from "@nestjs/common";
import { acharNaOrganizacao, organizacaoDe } from "./escopo-organizacao";

const req = (organizationId?: any) => ({ user: { organizationId } });

function delegateQueRespeitaOFiltro(registros: any[]) {
  return {
    findFirst: jest.fn(({ where }: any) =>
      Promise.resolve(
        registros.find(r =>
          Object.entries(where).every(([k, v]) => v === undefined || (r as any)[k] === v),
        ) || null,
      ),
    ),
  };
}

// `deletedAt` presente porque um dos testes filtra por ele — sem o campo, o
// comparador do delegate falso rejeitaria o registro por ausencia, nao por
// regra.
const DA_ORG_A = { id: "x1", organizationId: "org-A", nome: "da org A", deletedAt: null };
const DA_ORG_B = { id: "x2", organizationId: "org-B", nome: "da org B", deletedAt: null };

describe("organizacaoDe", () => {
  it("devolve a organizacao de quem chamou", () => {
    expect(organizacaoDe(req("org-A"))).toBe("org-A");
  });

  /**
   * O caso que justifica o guarda existir. `where: { id, organizationId:
   * undefined }` no Prisma descarta o campo e volta a casar qualquer registro
   * com aquele id — o furo reabre sem erro nenhum.
   */
  it.each([
    ["undefined", undefined],
    ["null", null],
    ["string vazia", ""],
    ["numero", 123],
  ])("recusa organizacao %s em vez de consultar sem filtro", (_rotulo, valor) => {
    expect(() => organizacaoDe(req(valor))).toThrow(InternalServerErrorException);
  });

  it("recusa requisicao sem user", () => {
    expect(() => organizacaoDe({})).toThrow(InternalServerErrorException);
    expect(() => organizacaoDe(undefined)).toThrow(InternalServerErrorException);
  });
});

describe("acharNaOrganizacao", () => {
  it("devolve o registro da propria organizacao", async () => {
    const d = delegateQueRespeitaOFiltro([DA_ORG_A, DA_ORG_B]);
    await expect(acharNaOrganizacao(d, "x1", req("org-A"), "nao achou")).resolves.toEqual(DA_ORG_A);
  });

  it("consulta SEMPRE com o organizationId no filtro", async () => {
    const d = delegateQueRespeitaOFiltro([DA_ORG_A]);
    await acharNaOrganizacao(d, "x1", req("org-A"), "nao achou");

    expect(d.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "x1", organizationId: "org-A" }),
      }),
    );
  });

  it("nega registro de outra organizacao mesmo com o id certo", async () => {
    const d = delegateQueRespeitaOFiltro([DA_ORG_A, DA_ORG_B]);
    await expect(
      acharNaOrganizacao(d, "x2", req("org-A"), "Ativo nao encontrado"),
    ).rejects.toThrow(NotFoundException);
  });

  it("responde 404 e nao 403 — 403 confirmaria o id em outro tenant", async () => {
    const d = delegateQueRespeitaOFiltro([DA_ORG_B]);
    await expect(
      acharNaOrganizacao(d, "x2", req("org-A"), "Ativo nao encontrado"),
    ).rejects.toThrow("Ativo nao encontrado");
  });

  it("nao consulta quando a organizacao esta ausente", async () => {
    const d = delegateQueRespeitaOFiltro([DA_ORG_A]);
    await expect(
      acharNaOrganizacao(d, "x1", req(undefined), "nao achou"),
    ).rejects.toThrow(InternalServerErrorException);

    expect(d.findFirst).not.toHaveBeenCalled();
  });

  it("preserva include e where extra sem perder o escopo", async () => {
    const d = delegateQueRespeitaOFiltro([DA_ORG_A]);
    await acharNaOrganizacao(d, "x1", req("org-A"), "nao achou", {
      include: { setor: true },
      where: { deletedAt: null },
    });

    expect(d.findFirst).toHaveBeenCalledWith({
      where: { deletedAt: null, id: "x1", organizationId: "org-A" },
      include: { setor: true },
    });
  });

  it("nao deixa o where extra sobrescrever o organizationId", async () => {
    const d = delegateQueRespeitaOFiltro([DA_ORG_A, DA_ORG_B]);
    // Mesmo que alguem passe outra organizacao no extra, o escopo real vence.
    await expect(
      acharNaOrganizacao(d, "x2", req("org-A"), "nao achou", {
        where: { organizationId: "org-B" },
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
