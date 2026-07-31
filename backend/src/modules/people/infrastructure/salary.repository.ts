import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../../../prisma/prisma.service";

/**
 * Único ponto que fala Prisma para remuneração.
 *
 * `Decimal` do Prisma vira `number` na saída: o domínio calcula percentual e
 * posição em faixa, e Decimal não faz aritmética com operador. A precisão que
 * importa está no banco — aqui os valores só são lidos e comparados.
 */
@Injectable()
export class SalaryRepository {
  constructor(private readonly db: PrismaService) {}

  private paraNumero(v: any): number {
    return v === null || v === undefined ? 0 : Number(v);
  }

  async historico(collaboratorId: string, organizationId: string) {
    const linhas = await this.db.collaboratorSalary.findMany({
      where: { collaboratorId, organizationId },
      orderBy: { vigenciaInicio: "desc" },
      include: { position: { select: { id: true, titulo: true } } },
    });
    return linhas.map((l: any) => ({ ...l, valor: this.paraNumero(l.valor) }));
  }

  criar(dados: {
    organizationId: string;
    collaboratorId: string;
    valor: number;
    vigenciaInicio: Date;
    motivo: string;
    positionId?: string | null;
    observacoes?: string | null;
    criadoPorId?: string | null;
  }) {
    return this.db.collaboratorSalary.create({
      data: { id: randomUUID(), ...dados },
      include: { position: { select: { titulo: true } } },
    });
  }

  obter(id: string, organizationId: string) {
    return this.db.collaboratorSalary.findFirst({ where: { id, organizationId } });
  }

  excluir(id: string) {
    return this.db.collaboratorSalary.delete({ where: { id } });
  }

  /** Cargo do colaborador hoje — gravado junto da mudança para o histórico. */
  async cargoAtual(collaboratorId: string): Promise<string | null> {
    const c = await this.db.collaborator.findUnique({
      where: { id: collaboratorId },
      select: { positionId: true },
    });
    return c?.positionId ?? null;
  }

  async faixaDoCargo(positionId: string | null, organizationId: string) {
    if (!positionId) return null;
    const p = await this.db.position.findFirst({
      where: { id: positionId, organizationId },
      select: { id: true, titulo: true, salarioMinimo: true, salarioMedio: true, salarioMaximo: true },
    });
    if (!p) return null;
    return {
      id: p.id,
      titulo: p.titulo,
      minimo: p.salarioMinimo === null ? null : this.paraNumero(p.salarioMinimo),
      medio: p.salarioMedio === null ? null : this.paraNumero(p.salarioMedio),
      maximo: p.salarioMaximo === null ? null : this.paraNumero(p.salarioMaximo),
    };
  }

  /** Faixa de todos os cargos ativos, para a tela de administração de faixas. */
  async faixasDoCatalogo(organizationId: string) {
    const cargos = await this.db.position.findMany({
      where: { organizationId, ativo: true },
      select: {
        id: true, titulo: true, nivel: true,
        salarioMinimo: true, salarioMedio: true, salarioMaximo: true,
        _count: { select: { collaborators: true } },
      },
      orderBy: { titulo: "asc" },
    });
    return cargos.map((p: any) => ({
      id: p.id,
      titulo: p.titulo,
      nivel: p.nivel,
      colaboradores: p._count?.collaborators ?? 0,
      minimo: p.salarioMinimo === null ? null : this.paraNumero(p.salarioMinimo),
      medio: p.salarioMedio === null ? null : this.paraNumero(p.salarioMedio),
      maximo: p.salarioMaximo === null ? null : this.paraNumero(p.salarioMaximo),
    }));
  }

  definirFaixa(
    positionId: string,
    faixa: { minimo: number | null; medio: number | null; maximo: number | null },
    porId: string | null,
  ) {
    return this.db.position.update({
      where: { id: positionId },
      data: {
        salarioMinimo: faixa.minimo,
        salarioMedio: faixa.medio,
        salarioMaximo: faixa.maximo,
        atualizadoPorId: porId,
      },
    });
  }

  /**
   * Todos os registros salariais dos colaboradores no escopo.
   *
   * Traz o histórico inteiro, não só o vigente: quem decide qual vale é o
   * domínio, que sabe descartar vigência futura. Filtrar por data em SQL
   * duplicaria essa regra num lugar sem teste.
   */
  registrosDoQuadro(organizationId: string, collaboratorIds?: string[]) {
    return this.db.collaboratorSalary.findMany({
      where: {
        organizationId,
        ...(collaboratorIds ? { collaboratorId: { in: collaboratorIds } } : {}),
        collaborator: { excluidoEm: null, status: "ATIVO" },
      },
      select: {
        collaboratorId: true,
        valor: true,
        vigenciaInicio: true,
        motivo: true,
        collaborator: {
          select: {
            id: true, nomeCompleto: true,
            user: { select: { nome: true } },
            position: {
              select: {
                id: true, titulo: true,
                salarioMinimo: true, salarioMedio: true, salarioMaximo: true,
              },
            },
          },
        },
      },
    });
  }
}
