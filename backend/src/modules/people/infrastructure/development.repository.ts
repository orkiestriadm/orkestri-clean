import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../../../prisma/prisma.service";

/** Único ponto que fala Prisma para treinamentos e avaliações. */
@Injectable()
export class DevelopmentRepository {
  constructor(private readonly db: PrismaService) {}

  /* ── Catálogo de cursos ───────────────────────────────────────────────── */

  listarCursos(organizationId: string, incluirInativos = false) {
    return this.db.trainingCourse.findMany({
      where: {
        organizationId,
        excluidoEm: null,
        ...(incluirInativos ? {} : { ativo: true }),
      },
      orderBy: [{ categoria: "asc" }, { nome: "asc" }],
      include: { _count: { select: { participacoes: true } } },
    });
  }

  obterCurso(id: string, organizationId: string) {
    return this.db.trainingCourse.findFirst({ where: { id, organizationId, excluidoEm: null } });
  }

  async nomeCursoEmUso(organizationId: string, nome: string, ignorarId?: string) {
    const achado = await this.db.trainingCourse.findFirst({
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

  criarCurso(dados: {
    organizationId: string;
    nome: string;
    categoria: string;
    fornecedor?: string | null;
    cargaHoraria?: number | null;
    validadeMeses?: number | null;
    descricao?: string | null;
    criadoPorId?: string | null;
  }) {
    return this.db.trainingCourse.create({ data: { id: randomUUID(), ...dados } });
  }

  atualizarCurso(id: string, dados: Record<string, unknown>) {
    return this.db.trainingCourse.update({ where: { id }, data: dados });
  }

  excluirCurso(id: string, porId: string | null) {
    return this.db.trainingCourse.update({
      where: { id },
      data: { excluidoEm: new Date(), ativo: false, atualizadoPorId: porId },
    });
  }

  contarParticipacoes(trainingId: string) {
    return this.db.collaboratorTraining.count({ where: { trainingId } });
  }

  /* ── Participações ────────────────────────────────────────────────────── */

  listarParticipacoes(collaboratorId: string, organizationId: string) {
    return this.db.collaboratorTraining.findMany({
      where: { collaboratorId, organizationId },
      orderBy: [{ criadoEm: "desc" }],
      include: {
        training: { select: { id: true, nome: true, categoria: true, cargaHoraria: true, fornecedor: true } },
      },
    });
  }

  obterParticipacao(id: string, organizationId: string) {
    return this.db.collaboratorTraining.findFirst({
      where: { id, organizationId },
      include: { training: { select: { nome: true, validadeMeses: true } } },
    });
  }

  criarParticipacao(dados: Record<string, unknown>) {
    return this.db.collaboratorTraining.create({
      data: { id: randomUUID(), ...(dados as any) },
      include: { training: { select: { nome: true } } },
    });
  }

  atualizarParticipacao(id: string, dados: Record<string, unknown>) {
    return this.db.collaboratorTraining.update({
      where: { id },
      data: dados,
      include: { training: { select: { nome: true } } },
    });
  }

  /** Certificações que vencem até a data — alimenta o painel de vencimento. */
  certificacoesVencendoAte(organizationId: string, limite: Date, collaboratorIds?: string[]) {
    return this.db.collaboratorTraining.findMany({
      where: {
        organizationId,
        validade: { not: null, lte: limite },
        status: "CONCLUIDO",
        ...(collaboratorIds ? { collaboratorId: { in: collaboratorIds } } : {}),
        collaborator: { excluidoEm: null },
      },
      orderBy: { validade: "asc" },
      include: {
        training: { select: { nome: true } },
        collaborator: { select: { id: true, nomeCompleto: true, user: { select: { nome: true } } } },
      },
    });
  }

  contarParticipacoesPorStatus(organizationId: string, collaboratorIds?: string[]) {
    return this.db.collaboratorTraining.groupBy({
      by: ["status"],
      where: {
        organizationId,
        ...(collaboratorIds ? { collaboratorId: { in: collaboratorIds } } : {}),
        collaborator: { excluidoEm: null },
      },
      _count: { _all: true },
    });
  }

  /* ── Avaliações ───────────────────────────────────────────────────────── */

  listarAvaliacoes(collaboratorId: string, organizationId: string) {
    return this.db.performanceReview.findMany({
      where: { collaboratorId, organizationId },
      orderBy: [{ ciclo: "desc" }],
      include: {
        avaliador: { select: { id: true, nomeCompleto: true, user: { select: { nome: true } } } },
        metas: { orderBy: { criadoEm: "asc" } },
      },
    });
  }

  obterAvaliacao(id: string, organizationId: string) {
    return this.db.performanceReview.findFirst({
      where: { id, organizationId },
      include: { metas: true },
    });
  }

  avaliacaoDoCiclo(collaboratorId: string, ciclo: string) {
    return this.db.performanceReview.findFirst({
      where: { collaboratorId, ciclo },
      select: { id: true },
    });
  }

  criarAvaliacao(dados: Record<string, unknown>) {
    return this.db.performanceReview.create({
      data: { id: randomUUID(), ...(dados as any) },
      include: { metas: true },
    });
  }

  atualizarAvaliacao(id: string, dados: Record<string, unknown>) {
    return this.db.performanceReview.update({
      where: { id },
      data: dados,
      include: { metas: true },
    });
  }

  /* ── Metas ────────────────────────────────────────────────────────────── */

  criarMeta(dados: {
    organizationId: string;
    reviewId: string;
    titulo: string;
    descricao?: string | null;
    peso?: number;
    prazo?: Date | null;
  }) {
    return this.db.performanceGoal.create({ data: { id: randomUUID(), ...dados } });
  }

  obterMeta(id: string, organizationId: string) {
    return this.db.performanceGoal.findFirst({
      where: { id, organizationId },
      include: { review: { select: { id: true, status: true, collaboratorId: true } } },
    });
  }

  atualizarMeta(id: string, dados: Record<string, unknown>) {
    return this.db.performanceGoal.update({ where: { id }, data: dados });
  }

  excluirMeta(id: string) {
    return this.db.performanceGoal.delete({ where: { id } });
  }

  /** Média das notas finalizadas por ciclo — relatório de desempenho. */
  mediaPorCiclo(organizationId: string, collaboratorIds?: string[]) {
    return this.db.performanceReview.groupBy({
      by: ["ciclo"],
      where: {
        organizationId,
        status: "FINALIZADA",
        nota: { not: null },
        ...(collaboratorIds ? { collaboratorId: { in: collaboratorIds } } : {}),
        collaborator: { excluidoEm: null },
      },
      _avg: { nota: true },
      _count: { _all: true },
      orderBy: { ciclo: "desc" },
    });
  }
}
