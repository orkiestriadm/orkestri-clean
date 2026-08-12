/**
 * O portal do cliente e publico de proposito: o token NA URL e a credencial.
 * Por isso o PortalController nao tem guard nenhum.
 *
 * O acidente foi pendurar as rotas ADMINISTRATIVAS do token nesse mesmo
 * controller. Sem guard, qualquer pessoa na internet lia o token de qualquer
 * cliente — e a rota de regenerar devolvia um token novo a quem chamasse,
 * derrubando o link legitimo do cliente no processo.
 *
 * Estes testes olham os metadados das rotas em vez de subir a aplicacao: sao a
 * rede que impede a rota administrativa de voltar para o controller publico.
 */
import { AuthGuard } from "@nestjs/passport";
import { PermissionsGuard } from "../auth/permissions.guard";
import { PERMISSIONS_KEY } from "../auth/permissions.decorator";
import { PATH_METADATA, GUARDS_METADATA } from "@nestjs/common/constants";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const portalModule = require("./portal.module");

/** Recupera as classes de controller declaradas no modulo. */
function controllersDoModulo(): any[] {
  return Reflect.getMetadata("controllers", portalModule.PortalModule) || [];
}

function acharController(prefixo: string): any {
  const achado = controllersDoModulo().find(
    c => Reflect.getMetadata(PATH_METADATA, c) === prefixo,
  );
  if (!achado) throw new Error(`Controller com prefixo "${prefixo}" nao registrado no PortalModule`);
  return achado;
}

/**
 * So metodos de verdade. Um `get` (como o `db`) seria invocado ao ser lido do
 * prototype, com `this` sem dependencias — devolve undefined e derruba o
 * Reflect.getMetadata logo abaixo.
 */
function metodosDe(ctrl: any): string[] {
  return Object.getOwnPropertyNames(ctrl.prototype).filter(m => {
    if (m === "constructor") return false;
    const d = Object.getOwnPropertyDescriptor(ctrl.prototype, m);
    return !!d && typeof d.value === "function";
  });
}

function rotaDe(ctrl: any, metodo: string): string | undefined {
  return Reflect.getMetadata(PATH_METADATA, ctrl.prototype[metodo]);
}

describe("portal — separacao entre publico e administrativo", () => {
  it("registra os DOIS controllers: o publico e o administrativo", () => {
    const prefixos = controllersDoModulo().map(c => Reflect.getMetadata(PATH_METADATA, c));
    expect(prefixos).toEqual(expect.arrayContaining(["portal", "portal-admin"]));
  });

  it("o controller publico NAO expoe nenhuma rota administrativa de token", () => {
    const publico = acharController("portal");

    for (const metodo of metodosDe(publico)) {
      const rota = rotaDe(publico, metodo) ?? "";
      expect(rota).not.toMatch(/admin/i);
      expect(rota).not.toMatch(/regenerar/i);
    }
  });

  it("o controller administrativo exige JWT e PermissionsGuard", () => {
    const admin = acharController("portal-admin");
    const guards = Reflect.getMetadata(GUARDS_METADATA, admin) || [];

    // AuthGuard("jwt") devolve uma classe gerada; comparamos por heranca.
    const jwt = AuthGuard("jwt");
    expect(guards.length).toBeGreaterThanOrEqual(2);
    expect(guards.some((g: any) => g === jwt || g.prototype instanceof jwt)).toBe(true);
    expect(guards).toContain(PermissionsGuard);
  });

  it("toda rota administrativa declara uma permissao", () => {
    const admin = acharController("portal-admin");
    const rotas = metodosDe(admin).filter(m => rotaDe(admin, m) !== undefined);

    expect(rotas.length).toBeGreaterThan(0);
    for (const metodo of rotas) {
      const perms = Reflect.getMetadata(PERMISSIONS_KEY, admin.prototype[metodo]);
      expect(Array.isArray(perms) && perms.length > 0).toBe(true);
    }
  });

  it("regenerar exige permissao de escrita, nao so de leitura", () => {
    const admin = acharController("portal-admin");
    const perms = Reflect.getMetadata(PERMISSIONS_KEY, admin.prototype.regenerarToken);
    expect(perms).toContain("crm:editar");
  });
});

describe("portal-admin — escopo de organizacao", () => {
  /**
   * Resolver o cliente so por `id` foi o segundo defeito: mesmo com JWT, um
   * usuario do tenant A pegaria o token de um cliente do tenant B. A consulta
   * precisa levar o organizationId de quem chamou.
   */
  function novoController(prismaFalso: any) {
    const admin = acharController("portal-admin");
    return new admin(prismaFalso);
  }

  const clienteDoOutroTenant = { id: "cli-b", organizationId: "org-B", portalToken: "tok-b" };

  function prismaQueRespeitaOEscopo() {
    return {
      cliente: {
        findFirst: jest.fn(({ where }: any) =>
          Promise.resolve(
            where.id === clienteDoOutroTenant.id && where.organizationId === "org-B"
              ? clienteDoOutroTenant
              : null,
          ),
        ),
        update: jest.fn(() => Promise.resolve({ portalToken: "tok-novo" })),
      },
    };
  }

  it("consulta o cliente filtrando por organizationId de quem chamou", async () => {
    const prisma = prismaQueRespeitaOEscopo();
    const ctrl = novoController(prisma);
    await ctrl.getToken({ user: { organizationId: "org-B" } }, "cli-b");

    expect(prisma.cliente.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "cli-b", organizationId: "org-B" }),
      }),
    );
  });

  it("nega o token de cliente de outra organizacao", async () => {
    const prisma = prismaQueRespeitaOEscopo();
    const ctrl = novoController(prisma);

    // Usuario do tenant A pedindo um cliente que e do tenant B.
    await expect(
      ctrl.getToken({ user: { organizationId: "org-A" } }, "cli-b"),
    ).rejects.toThrow(/nao encontrado/i);

    expect(prisma.cliente.update).not.toHaveBeenCalled();
  });

  it("nao regenera token de cliente de outra organizacao", async () => {
    const prisma = prismaQueRespeitaOEscopo();
    const ctrl = novoController(prisma);

    await expect(
      ctrl.regenerarToken({ user: { organizationId: "org-A" } }, "cli-b"),
    ).rejects.toThrow(/nao encontrado/i);

    // O ponto do defeito: o token do cliente legitimo continua de pe.
    expect(prisma.cliente.update).not.toHaveBeenCalled();
  });
});
