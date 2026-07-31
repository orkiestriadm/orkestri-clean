import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";

/** Acesso a dados de cargos. Único ponto do submódulo que fala Prisma. */

const CAMPOS = {
  id: true, titulo: true, codigo: true, descricao: true,
  nivel: true, ativo: true, criadoEm: true,
} as const;

@Injectable()
export class PositionRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get db(): any {
    return this.prisma as any;
  }

  async listar(organizationId: string, incluirInativos: boolean) {
    return this.db.position.findMany({
      where: {
        organizationId,
        excluidoEm: null,
        ...(incluirInativos ? {} : { ativo: true }),
      },
      select: { ...CAMPOS, _count: { select: { collaborators: true } } },
      orderBy: { titulo: "asc" },
    });
  }

  async obter(id: string, organizationId: string) {
    return this.db.position.findFirst({
      where: { id, organizationId, excluidoEm: null },
      select: CAMPOS,
    });
  }

  async tituloEmUso(organizationId: string, titulo: string, excetoId?: string) {
    const achado = await this.db.position.findFirst({
      where: {
        organizationId,
        titulo: { equals: titulo, mode: "insensitive" },
        excluidoEm: null,
        ...(excetoId ? { NOT: { id: excetoId } } : {}),
      },
      select: { id: true },
    });
    return !!achado;
  }

  async criar(dados: Record<string, any>) {
    return this.db.position.create({ data: dados, select: CAMPOS });
  }

  async atualizar(id: string, dados: Record<string, any>) {
    return this.db.position.update({ where: { id }, data: dados, select: CAMPOS });
  }

  async contarColaboradores(id: string) {
    return this.db.collaborator.count({ where: { positionId: id, excluidoEm: null } });
  }

  async excluir(id: string, atorId: string | null) {
    return this.db.position.update({
      where: { id },
      data: { excluidoEm: new Date(), ativo: false, atualizadoPorId: atorId },
      select: { id: true },
    });
  }

  /**
   * Cargos distintos ainda existentes apenas como texto em `Collaborator.cargo`.
   *
   * Antes do People, cargo era string livre. Esta consulta alimenta a
   * importação que transforma esse texto em entidade — sem ela, o cliente
   * teria que redigitar todos os cargos à mão.
   */
  async cargosSoltos(organizationId: string): Promise<{ cargo: string; total: number }[]> {
    const linhas = await this.db.collaborator.groupBy({
      by: ["cargo"],
      where: {
        organizationId,
        excluidoEm: null,
        positionId: null,
        cargo: { not: null },
      },
      _count: { _all: true },
    });
    return linhas
      .filter((l: any) => l.cargo?.trim())
      .map((l: any) => ({ cargo: l.cargo.trim(), total: l._count._all }))
      .sort((a: any, b: any) => b.total - a.total);
  }

  /** Vincula ao cargo os colaboradores cujo texto bate exatamente. */
  async vincularPorTitulo(organizationId: string, titulo: string, positionId: string) {
    const { count } = await this.db.collaborator.updateMany({
      where: { organizationId, excluidoEm: null, positionId: null, cargo: titulo },
      data: { positionId },
    });
    return count;
  }
}
