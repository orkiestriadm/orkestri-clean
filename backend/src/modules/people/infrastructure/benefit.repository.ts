import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../../../prisma/prisma.service";

/** Único ponto que fala Prisma para benefícios (BACKEND.md §4). */
@Injectable()
export class BenefitRepository {
  constructor(private readonly db: PrismaService) {}

  /* ── Catálogo ─────────────────────────────────────────────────────────── */

  listarCatalogo(organizationId: string, incluirInativos = false) {
    return this.db.benefit.findMany({
      where: {
        organizationId,
        excluidoEm: null,
        ...(incluirInativos ? {} : { ativo: true }),
      },
      orderBy: [{ categoria: "asc" }, { nome: "asc" }],
      include: { _count: { select: { concessoes: true } } },
    });
  }

  obterBeneficio(id: string, organizationId: string) {
    return this.db.benefit.findFirst({ where: { id, organizationId, excluidoEm: null } });
  }

  async nomeEmUso(organizationId: string, nome: string, ignorarId?: string) {
    const achado = await this.db.benefit.findFirst({
      where: {
        organizationId,
        excluidoEm: null,
        nome: { equals: nome, mode: "insensitive" },
        ...(ignorarId ? { id: { not: ignorarId } } : {}),
      },
      select: { id: true },
    });
    return !!achado;
  }

  criarBeneficio(dados: {
    organizationId: string;
    nome: string;
    categoria: string;
    descricao?: string | null;
    valorReferencia?: number | null;
    criadoPorId?: string | null;
  }) {
    return this.db.benefit.create({ data: { id: randomUUID(), ...dados } });
  }

  atualizarBeneficio(id: string, dados: Record<string, unknown>) {
    return this.db.benefit.update({ where: { id }, data: dados });
  }

  /** Soft delete: o histórico de concessões referencia esta linha. */
  excluirBeneficio(id: string, porId: string | null) {
    return this.db.benefit.update({
      where: { id },
      data: { excluidoEm: new Date(), ativo: false, atualizadoPorId: porId },
    });
  }

  contarConcessoes(benefitId: string) {
    return this.db.collaboratorBenefit.count({ where: { benefitId } });
  }

  /* ── Concessões ───────────────────────────────────────────────────────── */

  listarConcessoes(collaboratorId: string, organizationId: string) {
    return this.db.collaboratorBenefit.findMany({
      where: { collaboratorId, organizationId },
      orderBy: [{ inicio: "desc" }],
      include: { benefit: { select: { id: true, nome: true, categoria: true } } },
    });
  }

  /** Concessões do MESMO benefício — base da checagem de sobreposição. */
  concessoesDoBeneficio(collaboratorId: string, benefitId: string, ignorarId?: string) {
    return this.db.collaboratorBenefit.findMany({
      where: {
        collaboratorId,
        benefitId,
        ...(ignorarId ? { id: { not: ignorarId } } : {}),
      },
      select: { id: true, inicio: true, fim: true },
    });
  }

  obterConcessao(id: string, organizationId: string) {
    return this.db.collaboratorBenefit.findFirst({
      where: { id, organizationId },
      include: { benefit: { select: { nome: true } } },
    });
  }

  criarConcessao(dados: {
    organizationId: string;
    collaboratorId: string;
    benefitId: string;
    inicio: Date;
    fim?: Date | null;
    valor?: number | null;
    observacoes?: string | null;
    criadoPorId?: string | null;
  }) {
    return this.db.collaboratorBenefit.create({
      data: { id: randomUUID(), ...dados },
      include: { benefit: { select: { nome: true } } },
    });
  }

  atualizarConcessao(id: string, dados: Record<string, unknown>) {
    return this.db.collaboratorBenefit.update({
      where: { id },
      data: dados,
      include: { benefit: { select: { nome: true } } },
    });
  }

  /**
   * Custo por benefício das concessões vigentes — relatório da organização.
   *
   * Vigente = já começou e (não tem fim ou o fim ainda não passou).
   */
  concessoesVigentes(organizationId: string, collaboratorIds?: string[]) {
    const hoje = new Date();
    return this.db.collaboratorBenefit.findMany({
      where: {
        organizationId,
        ...(collaboratorIds ? { collaboratorId: { in: collaboratorIds } } : {}),
        inicio: { lte: hoje },
        OR: [{ fim: null }, { fim: { gte: hoje } }],
        collaborator: { excluidoEm: null },
      },
      select: {
        valor: true,
        collaboratorId: true,
        benefit: { select: { id: true, nome: true, categoria: true } },
      },
    });
  }
}
