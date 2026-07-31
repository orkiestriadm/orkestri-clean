import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";

/**
 * Agregações para os painéis de pessoas.
 *
 * Tudo aqui aceita `collaboratorIds` opcional: quando o usuário não tem escopo
 * organizacional, o relatório mostra a equipe dele e não a empresa inteira.
 * `undefined` significa "sem restrição"; uma lista vazia restringe a nada — e
 * é o comportamento correto, não um bug.
 */
@Injectable()
export class ReportRepository {
  constructor(private readonly db: PrismaService) {}

  private escopo(organizationId: string, ids?: string[]) {
    return {
      organizationId,
      excluidoEm: null,
      ...(ids ? { id: { in: ids } } : {}),
    };
  }

  contarPorStatus(organizationId: string, ids?: string[]) {
    return this.db.collaborator.groupBy({
      by: ["status"],
      where: this.escopo(organizationId, ids),
      _count: { _all: true },
    });
  }

  contarPorSetor(organizationId: string, ids?: string[]) {
    return this.db.collaborator.groupBy({
      by: ["setorId"],
      where: { ...this.escopo(organizationId, ids), status: "ATIVO" },
      _count: { _all: true },
    });
  }

  contarPorCargo(organizationId: string, ids?: string[]) {
    return this.db.collaborator.groupBy({
      by: ["positionId"],
      where: { ...this.escopo(organizationId, ids), status: "ATIVO" },
      _count: { _all: true },
    });
  }

  contarPorVinculo(organizationId: string, ids?: string[]) {
    return this.db.collaborator.groupBy({
      by: ["tipoVinculo"],
      where: { ...this.escopo(organizationId, ids), status: "ATIVO" },
      _count: { _all: true },
    });
  }

  nomesDeSetor(organizationId: string) {
    return this.db.setor.findMany({
      where: { organizationId },
      select: { id: true, nome: true },
    });
  }

  nomesDeCargo(organizationId: string) {
    return this.db.position.findMany({
      where: { organizationId, excluidoEm: null },
      select: { id: true, titulo: true },
    });
  }

  /** Admissões e desligamentos do período — base do gráfico de movimentação. */
  admissoesNoPeriodo(organizationId: string, de: Date, ate: Date, ids?: string[]) {
    return this.db.collaborator.findMany({
      where: { ...this.escopo(organizationId, ids), dataAdmissao: { gte: de, lte: ate } },
      select: { dataAdmissao: true },
    });
  }

  desligamentosNoPeriodo(organizationId: string, de: Date, ate: Date, ids?: string[]) {
    return this.db.collaborator.findMany({
      where: { ...this.escopo(organizationId, ids), dataDesligamento: { gte: de, lte: ate } },
      select: { dataDesligamento: true },
    });
  }

  /** Quantos colaboradores ativos havia no início do período — base do turnover. */
  ativosAntesDe(organizationId: string, data: Date, ids?: string[]) {
    return this.db.collaborator.count({
      where: {
        ...this.escopo(organizationId, ids),
        dataAdmissao: { lte: data },
        OR: [{ dataDesligamento: null }, { dataDesligamento: { gt: data } }],
      },
    });
  }

  contarDocumentosPorAprovacao(organizationId: string, ids?: string[]) {
    return this.db.collaboratorDocument.groupBy({
      by: ["aprovacao"],
      where: {
        organizationId,
        excluidoEm: null,
        ...(ids ? { collaboratorId: { in: ids } } : {}),
        collaborator: { excluidoEm: null },
      },
      _count: { _all: true },
    });
  }

  documentosVencendo(organizationId: string, limite: Date, ids?: string[]) {
    return this.db.collaboratorDocument.count({
      where: {
        organizationId,
        excluidoEm: null,
        dataValidade: { not: null, lte: limite },
        ...(ids ? { collaboratorId: { in: ids } } : {}),
        collaborator: { excluidoEm: null },
      },
    });
  }

  /** Saldo de férias somado e passivo vencido, em uma varredura. */
  periodosParaSaldo(organizationId: string, ids?: string[]) {
    return this.db.collaboratorVacationPeriod.findMany({
      where: {
        organizationId,
        ...(ids ? { collaboratorId: { in: ids } } : {}),
        collaborator: { excluidoEm: null, status: "ATIVO" },
      },
      select: {
        diasDireito: true, diasGozados: true, limiteConcessivo: true, status: true,
      },
    });
  }

  /** Linhas cruas do quadro — usadas na exportação. */
  linhasParaExportar(organizationId: string, ids?: string[]) {
    return this.db.collaborator.findMany({
      where: this.escopo(organizationId, ids),
      orderBy: [{ nomeCompleto: "asc" }],
      select: {
        matricula: true,
        nomeCompleto: true,
        emailCorporativo: true,
        status: true,
        cargo: true,
        dataAdmissao: true,
        dataDesligamento: true,
        tipoVinculo: true,
        senioridade: true,
        position: { select: { titulo: true } },
        setor: { select: { nome: true } },
        gestor: { select: { nomeCompleto: true, user: { select: { nome: true } } } },
        user: { select: { nome: true, email: true } },
      },
    });
  }
}
