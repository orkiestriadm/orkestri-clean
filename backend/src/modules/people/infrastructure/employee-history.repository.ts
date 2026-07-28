import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";

/**
 * Linha do tempo funcional do colaborador.
 *
 * Conteúdo de produto — alimenta a aba "Histórico" do perfil 360 e é lido pelo
 * RH. Não confundir com AuditLog, que é trilha técnica para auditor e
 * compliance. Um mesmo fato costuma gerar os dois, com finalidades distintas.
 *
 * Ver docs/people/ADR-004-auditoria-soft-delete.md §4.
 */

export type EventoHistorico = {
  organizationId: string;
  collaboratorId: string;
  evento: string;
  campo?: string | null;
  valorAnterior?: string | null;
  valorNovo?: string | null;
  descricao?: string | null;
  vigenciaEm?: Date | null;
  registradoPorId?: string | null;
};

@Injectable()
export class EmployeeHistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get db(): any {
    return this.prisma as any;
  }

  async registrar(evento: EventoHistorico) {
    return this.db.collaboratorHistory.create({ data: evento });
  }

  async registrarVarios(eventos: EventoHistorico[]) {
    if (eventos.length === 0) return { count: 0 };
    return this.db.collaboratorHistory.createMany({ data: eventos });
  }

  async listar(collaboratorId: string, organizationId: string, limite = 100) {
    return this.db.collaboratorHistory.findMany({
      where: { collaboratorId, organizationId },
      orderBy: { registradoEm: "desc" },
      take: limite,
    });
  }
}
