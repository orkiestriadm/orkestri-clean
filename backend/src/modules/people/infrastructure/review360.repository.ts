import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";

/**
 * Entradas de 360 — autoavaliação e avaliação de pares.
 *
 * Única camada que fala Prisma (BACKEND.md §10). Separado do
 * DevelopmentRepository porque o ciclo tradicional e o 360 têm consumidores
 * distintos: o avaliado responde a própria autoavaliação sem nunca tocar no
 * resto da avaliação.
 */
@Injectable()
export class Review360Repository {
  constructor(private readonly prisma: PrismaService) {}

  private get db(): any {
    return this.prisma as any;
  }

  review(reviewId: string, organizationId: string) {
    return this.db.performanceReview.findFirst({
      where: { id: reviewId, organizationId },
      select: {
        id: true, ciclo: true, status: true, nota: true,
        collaboratorId: true, avaliadorId: true,
      },
    });
  }

  reviewDoCiclo(collaboratorId: string, ciclo: string, organizationId: string) {
    return this.db.performanceReview.findFirst({
      where: { collaboratorId, ciclo, organizationId },
      select: { id: true, ciclo: true, status: true, nota: true, collaboratorId: true },
    });
  }

  entradas(reviewId: string) {
    return this.db.performanceReviewInput.findMany({
      where: { reviewId },
      select: {
        id: true, avaliadorId: true, origem: true, nota: true, status: true,
        pontosFortes: true, pontosMelhoria: true, comentarios: true,
        respondidoEm: true, criadoEm: true,
        avaliador: {
          select: { id: true, nomeCompleto: true, user: { select: { nome: true } } },
        },
      },
      orderBy: { criadoEm: "asc" },
    });
  }

  entrada(id: string, organizationId: string) {
    return this.db.performanceReviewInput.findFirst({
      where: { id, organizationId },
      select: {
        id: true, reviewId: true, avaliadorId: true, origem: true, status: true,
        review: { select: { id: true, status: true, collaboratorId: true, ciclo: true } },
      },
    });
  }

  /** O convite de uma pessoa específica numa avaliação — base do autoatendimento. */
  entradaDoAvaliador(reviewId: string, avaliadorId: string) {
    return this.db.performanceReviewInput.findFirst({
      where: { reviewId, avaliadorId },
      select: {
        id: true, reviewId: true, avaliadorId: true, origem: true, status: true,
        nota: true, pontosFortes: true, pontosMelhoria: true, comentarios: true,
        respondidoEm: true,
      },
    });
  }

  /** O que esta pessoa tem para responder — dela mesma e dos colegas. */
  pendentesDoAvaliador(avaliadorId: string, organizationId: string) {
    return this.db.performanceReviewInput.findMany({
      where: { avaliadorId, organizationId, status: "CONVIDADO", review: { status: "RASCUNHO" } },
      select: {
        id: true, origem: true, criadoEm: true,
        review: {
          select: {
            id: true, ciclo: true,
            collaborator: {
              select: { id: true, nomeCompleto: true, user: { select: { nome: true } } },
            },
          },
        },
      },
      orderBy: { criadoEm: "asc" },
    });
  }

  criar(dados: Record<string, any>) {
    return this.db.performanceReviewInput.create({
      data: dados,
      select: { id: true, origem: true, avaliadorId: true, status: true },
    });
  }

  responder(id: string, dados: Record<string, any>) {
    return this.db.performanceReviewInput.update({
      where: { id },
      data: { ...dados, status: "RESPONDIDA", respondidoEm: new Date() },
      select: { id: true, origem: true, nota: true, status: true, respondidoEm: true },
    });
  }

  remover(id: string) {
    return this.db.performanceReviewInput.delete({ where: { id } });
  }

  /**
   * Notas finalizadas de um ciclo, com o gestor de cada avaliado.
   *
   * O gestor vem do CADASTRO do avaliado e não do campo `avaliadorId` do
   * review: o que a calibração compara é a régua de quem lidera a equipe, e
   * uma avaliação pode ter sido preenchida por outra pessoa (RH, substituto).
   */
  notasFinalizadasDoCiclo(organizationId: string, ciclo: string, collaboratorIds?: string[]) {
    return this.db.performanceReview.findMany({
      where: {
        organizationId, ciclo, status: "FINALIZADA", nota: { not: null },
        ...(collaboratorIds ? { collaboratorId: { in: collaboratorIds } } : {}),
        collaborator: { excluidoEm: null },
      },
      select: {
        nota: true,
        collaborator: {
          select: {
            id: true,
            gestor: { select: { id: true, nomeCompleto: true, user: { select: { nome: true } } } },
          },
        },
      },
    });
  }

  ciclosDisponiveis(organizationId: string) {
    return this.db.performanceReview.findMany({
      where: { organizationId },
      select: { ciclo: true },
      distinct: ["ciclo"],
      orderBy: { ciclo: "desc" },
      take: 24,
    });
  }
}
