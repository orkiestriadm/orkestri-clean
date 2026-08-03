import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { PEOPLE_PERMISSIONS } from "../people.permissions";
import { expandLegacyPermissions } from "../../../common/permission-aliases";

/**
 * Resolve QUAIS colaboradores um usuário pode enxergar.
 *
 * O guard responde "esta rota é permitida?". Este serviço responde "sobre quais
 * registros?". Separação deliberada: o guard roda antes do serviço e não tem
 * acesso ao dado consultado — resolver escopo lá exigiria carregar registros no
 * guard, invertendo responsabilidades.
 *
 * REGRA: nenhuma consulta do People monta `where` de colaborador manualmente.
 * Todas partem do filtro devolvido aqui. É o ponto único onde o isolamento por
 * papel e por organização é decidido, e onde os testes de isolamento batem.
 *
 * Ver docs/people/ADR-003-modelo-permissoes.md §3 e PEOPLE_PERMISSIONS.md §20.
 */

export type PeopleScope =
  | { tipo: "organizacao" }
  | { tipo: "equipe"; collaboratorIds: string[] }
  | { tipo: "proprio"; collaboratorIds: string[] }
  | { tipo: "nenhum" };

/** Usuário autenticado, na forma que o JWT entrega. */
export type UsuarioContexto = {
  id?: string;
  organizationId?: string;
  isMaster?: boolean;
  roles?: string[];
  permissions?: string[];
};

/**
 * Escopo organizacional é decidido por PERMISSÃO, não por nome de papel.
 *
 * A primeira versão comparava contra `["administrador","rh_admin","rh_analista",
 * "hr_admin","hr_analyst"]` — quatro desses cinco nomes não existem no sistema.
 * Vieram de PEOPLE_PERMISSIONS.md §4, que descreve papéis conceituais, não os
 * papéis reais (`administrador, analista, auditor, cliente_portal, gestor,
 * master, operador, supervisor, tecnico, visualizador`). O resultado é que um
 * analista de RH enxergava só o próprio cadastro.
 *
 * Com permissão, cada cliente decide quem é RH sem depender de o nome do papel
 * casar com uma lista fixa no código.
 */
function temEscopoOrganizacional(user: UsuarioContexto): boolean {
  const perms = expandLegacyPermissions(user.permissions ?? []);
  return perms.has("*") || perms.has(PEOPLE_PERMISSIONS.colaborador.verTodos);
}

@Injectable()
export class PeopleScopeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve o escopo do usuário.
   *
   * Precedência: master/RH veem a organização inteira; gestor vê a própria
   * árvore (diretos e indiretos, incluindo ele mesmo); demais veem só a si.
   */
  async resolve(user: UsuarioContexto): Promise<PeopleScope> {
    if (!user?.organizationId) return { tipo: "nenhum" };

    if (user.isMaster || temEscopoOrganizacional(user)) return { tipo: "organizacao" };

    const proprio = await this.collaboratorDoUsuario(user);
    if (!proprio) return { tipo: "nenhum" };

    const equipe = await this.arvoreDeLiderados(proprio.id, user.organizationId);
    if (equipe.length > 1) return { tipo: "equipe", collaboratorIds: equipe };

    return { tipo: "proprio", collaboratorIds: [proprio.id] };
  }

  /**
   * Converte o escopo em filtro Prisma, já combinado com a organização.
   *
   * Sempre exclui registros com soft delete — filtrar em cada consulta seria
   * esquecido mais cedo ou mais tarde.
   */
  async whereColaborador(user: UsuarioContexto): Promise<Record<string, any>> {
    const escopo = await this.resolve(user);
    const base = { organizationId: user.organizationId, excluidoEm: null };

    switch (escopo.tipo) {
      case "organizacao":
        return base;
      case "equipe":
      case "proprio":
        return { ...base, id: { in: escopo.collaboratorIds } };
      case "nenhum":
        // `in: []` não retorna nada — negar por construção em vez de por omissão.
        return { ...base, id: { in: [] } };
    }
  }

  /** Verifica acesso a um colaborador específico, sem carregar a lista toda. */
  async podeAcessar(user: UsuarioContexto, collaboratorId: string): Promise<boolean> {
    const escopo = await this.resolve(user);
    if (escopo.tipo === "organizacao") {
      const alvo = await (this.prisma as any).collaborator.findFirst({
        where: { id: collaboratorId, organizationId: user.organizationId, excluidoEm: null },
        select: { id: true },
      });
      return !!alvo;
    }
    if (escopo.tipo === "nenhum") return false;
    return escopo.collaboratorIds.includes(collaboratorId);
  }

  /**
   * O colaborador é o próprio usuário?
   *
   * Separado de `resolve`: "sou eu" não é a mesma pergunta que "qual é o meu
   * alcance". Quem checava identidade pelo formato do escopo (`tipo ===
   * "proprio"`) errava com gestor — o escopo dele é "equipe", e ele deixava de
   * alcançar o próprio cadastro em regras que exigem ser o titular.
   */
  async ehOProprio(user: UsuarioContexto, collaboratorId: string): Promise<boolean> {
    const proprio = await this.collaboratorDoUsuario(user);
    return proprio?.id === collaboratorId;
  }

  private async collaboratorDoUsuario(user: UsuarioContexto) {
    if (!user.id) return null;
    return (this.prisma as any).collaborator.findFirst({
      where: { userId: user.id, organizationId: user.organizationId, excluidoEm: null },
      select: { id: true },
    });
  }

  /**
   * Caminha a hierarquia para baixo a partir da raiz, em largura.
   *
   * Uma query por nível em vez de recursão por nó: uma equipe de 200 pessoas em
   * 4 níveis custa 4 consultas, não 200. O `visitados` protege contra ciclo —
   * o domínio impede criá-los, mas dado legado pode conter.
   */
  private async arvoreDeLiderados(raizId: string, organizationId: string): Promise<string[]> {
    const visitados = new Set<string>([raizId]);
    let nivel = [raizId];

    while (nivel.length > 0) {
      const filhos = await (this.prisma as any).collaborator.findMany({
        where: { gestorId: { in: nivel }, organizationId, excluidoEm: null },
        select: { id: true },
      });

      nivel = filhos
        .map((f: { id: string }) => f.id)
        .filter((id: string) => !visitados.has(id));

      nivel.forEach((id: string) => visitados.add(id));
    }

    return [...visitados];
  }
}
