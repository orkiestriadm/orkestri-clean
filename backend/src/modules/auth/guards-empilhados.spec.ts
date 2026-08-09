import { Controller, Get, UseGuards, CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { GUARDS_METADATA } from "@nestjs/common/constants";

/**
 * Prova o que acontece com DOIS `@UseGuards` no mesmo handler.
 *
 * Existe por causa de um padrão encontrado em homologação durante a
 * convergência dos ambientes (CONVERGENCIA_AMBIENTES.md, grupo 2):
 *
 *     @UseGuards(PermissionsGuard)
 *     @Permissions("configuracoes:ver")
 *     @UseGuards(AuthGuard("jwt"))
 *     async getConfig() { ... }
 *
 * A pergunta que este teste responde: as duas guardas valem, ou uma anula a
 * outra? A resposta muda se aquilo é reforço de segurança ou uma proteção que
 * parece existir e não existe — e não dá para responder lendo o código.
 */

class GuardaA implements CanActivate { canActivate(_: ExecutionContext) { return true; } }
class GuardaB implements CanActivate { canActivate(_: ExecutionContext) { return true; } }

@Controller("teste")
class ControllerEmpilhado {
  @UseGuards(GuardaA)
  @UseGuards(GuardaB)
  empilhado() { return null; }

  @UseGuards(GuardaA, GuardaB)
  juntas() { return null; }

  @UseGuards(GuardaA)
  sozinha() { return null; }
}

describe("dois @UseGuards no mesmo handler", () => {
  const guardasDe = (metodo: string) =>
    Reflect.getMetadata(GUARDS_METADATA, (ControllerEmpilhado.prototype as any)[metodo]) ?? [];

  it("uma guarda só registra uma", () => {
    expect(guardasDe("sozinha")).toEqual([GuardaA]);
  });

  it("no mesmo decorador, as duas valem", () => {
    expect(guardasDe("juntas")).toEqual([GuardaA, GuardaB]);
  });

  /**
   * O resultado — que contraria a suspeita que motivou este teste.
   *
   * `@UseGuards` NÃO sobrescreve: ele lê a metadata existente e acumula. Como
   * decoradores são aplicados de baixo para cima, o de baixo entra primeiro na
   * lista e o de cima depois.
   *
   * Aplicado ao padrão de homologação:
   *
   *     @UseGuards(PermissionsGuard)   ← em cima, roda por último
   *     @Permissions("configuracoes:ver")
   *     @UseGuards(AuthGuard("jwt"))   ← embaixo, roda primeiro
   *
   * As duas valem, e na ordem correta: autentica e só então autoriza. Se a
   * ordem fosse a inversa, o PermissionsGuard leria `req.user` antes de o
   * AuthGuard tê-lo preenchido, e negaria acesso a todo mundo.
   *
   * Conclusão: o padrão é seguro. A suspeita de que uma guarda anulava a outra
   * era infundada.
   */
  it("empilhados, AMBAS valem — a de baixo primeiro", () => {
    expect(guardasDe("empilhado")).toEqual([GuardaB, GuardaA]);
  });
});
