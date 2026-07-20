import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuditService } from "../../audit/audit.module";
import * as crypto from "crypto";

@Injectable()
export class ReservasService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async findAll(organizationId: string, options?: any) {
    const where: any = { organizationId };
    if (options?.veiculoId) where.veiculoId = options.veiculoId;
    if (options?.solicitanteId) where.solicitanteId = options.solicitanteId;
    if (options?.status) where.status = options.status;

    return this.prisma.reservaVeiculo.findMany({
      where,
      include: {
        veiculo: true,
        solicitante: { select: { id: true, nome: true, email: true, avatar: true } },
      },
      orderBy: { dataInicio: "asc" },
    });
  }

  async findOne(id: string, organizationId: string) {
    const reserva = await this.prisma.reservaVeiculo.findFirst({
      where: { id, organizationId },
      include: {
        veiculo: true,
        solicitante: { select: { id: true, nome: true, email: true, avatar: true } },
      },
    });
    if (!reserva) throw new NotFoundException("Reserva não encontrada");
    return reserva;
  }

  async checkConflict(veiculoId: string, dataInicio: Date, dataFim: Date, excludeId?: string) {
    const where: any = {
      veiculoId,
      status: { notIn: ["CANCELADA", "FINALIZADA"] },
      dataInicio: { lt: dataFim },
      dataFim: { gt: dataInicio },
    };
    if (excludeId) where.id = { not: excludeId };

    const conflict = await this.prisma.reservaVeiculo.findFirst({ where });
    if (conflict) {
      throw new BadRequestException("O veículo já possui uma reserva ativa neste período.");
    }
  }

  async create(data: any, userId: string, organizationId: string, ip: string) {
    const inicio = new Date(data.dataInicio);
    const fim = new Date(data.dataFim);

    if (inicio >= fim) {
      throw new BadRequestException("A data de início deve ser anterior à data de fim.");
    }

    await this.checkConflict(data.veiculoId, inicio, fim);

    const reservaData = {
      id: crypto.randomUUID(),
      organizationId,
      solicitanteId: userId,
      veiculoId: data.veiculoId,
      dataInicio: inicio,
      dataFim: fim,
      destino: data.destino,
      motivo: data.motivo,
      observacoes: data.observacoes,
      status: data.status || "CONFIRMADA",
      projetoId: data.projetoId,
      centroCustoId: data.centroCustoId,
    };

    const reserva = await this.prisma.reservaVeiculo.create({ data: reservaData });

    await this.audit.log({
      userId,
      modulo: "frota",
      tabela: "reservas_veiculo",
      registroId: reserva.id,
      acao: "criar",
      descricao: `Criou reserva do veículo para ${reserva.destino}`,
      dados: reservaData,
      ip,
    });

    return reserva;
  }

  async update(id: string, data: any, userId: string, organizationId: string, ip: string) {
    const existing = await this.findOne(id, organizationId);

    const inicio = data.dataInicio ? new Date(data.dataInicio) : existing.dataInicio;
    const fim = data.dataFim ? new Date(data.dataFim) : existing.dataFim;

    if (inicio >= fim) {
      throw new BadRequestException("A data de início deve ser anterior à data de fim.");
    }

    await this.checkConflict(existing.veiculoId, inicio, fim, id);

    const updateData: any = {};
    if (data.dataInicio) updateData.dataInicio = inicio;
    if (data.dataFim) updateData.dataFim = fim;
    if (data.destino) updateData.destino = data.destino;
    if (data.motivo) updateData.motivo = data.motivo;
    if (data.status) updateData.status = data.status;
    if (data.observacoes) updateData.observacoes = data.observacoes;
    if (data.kmInicial !== undefined) updateData.kmInicial = data.kmInicial;
    if (data.kmFinal !== undefined) updateData.kmFinal = data.kmFinal;

    const reserva = await this.prisma.reservaVeiculo.update({
      where: { id },
      data: updateData,
    });

    await this.audit.log({
      userId,
      modulo: "frota",
      tabela: "reservas_veiculo",
      registroId: reserva.id,
      acao: "atualizar",
      descricao: `Atualizou reserva do veículo`,
      dados: updateData,
      ip,
    });

    return reserva;
  }

  async cancel(id: string, userId: string, organizationId: string, ip: string) {
    const reserva = await this.update(id, { status: "CANCELADA" }, userId, organizationId, ip);
    return reserva;
  }
}
