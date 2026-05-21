import {
  Module, Controller, Get, Post, Put, Patch, Delete, Body, Param, Query,
  UseGuards, Req, Injectable, BadRequestException, NotFoundException, ForbiddenException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../../prisma/prisma.service";
import { PermissionsGuard } from "../auth/permissions.guard";
import { Permissions } from "../auth/permissions.decorator";

const TIPOS_VALIDOS = ["ferias", "atestado", "folga", "licenca", "banco_horas", "outro"];

class CreateAusenciaDto {
  collaboratorId: string;
  tipo: string;
  dataInicio: string;
  dataFim: string;
  diaInteiro?: boolean;
  horasDia?: number;
  descricao?: string;
  documentoUrl?: string;
}

class UpdateAusenciaDto {
  tipo?: string;
  dataInicio?: string;
  dataFim?: string;
  diaInteiro?: boolean;
  horasDia?: number;
  descricao?: string;
  documentoUrl?: string;
}

class RejectAusenciaDto { motivo: string; }

@Injectable()
export class AusenciasService {
  constructor(private prisma: PrismaService) {}

  private orgScope(user: any) {
    return user?.organizationId ? { organizationId: user.organizationId } : {};
  }

  private async notify(userId: string | null | undefined, tipo: string, titulo: string, mensagem: string, refId?: string) {
    if (!userId) return;
    try {
      await (this.prisma as any).notification.create({
        data: { userId, tipo, titulo, mensagem, referenciaTipo: "ausencia", referenciaId: refId || null },
      });
    } catch {}
  }

  private async canManage(ausenciaId: string, user: any): Promise<{ ausencia: any; isOwn: boolean; isGestor: boolean; isMaster: boolean }> {
    const a = await (this.prisma as any).ausencia.findFirst({
      where: { id: ausenciaId, ...this.orgScope(user) },
      include: { collaborator: { include: { gestor: true, user: { select: { id: true } } } } },
    });
    if (!a) throw new NotFoundException("Ausência não encontrada");
    const isMaster = !!user?.isMaster;
    const isOwn = a.collaborator.user.id === user.id;
    const isGestor = a.collaborator.gestor?.userId === user.id;
    return { ausencia: a, isOwn, isGestor, isMaster };
  }

  async findAll(user: any, status?: string, collaboratorId?: string, from?: string, to?: string) {
    const where: any = { ...this.orgScope(user) };
    if (status) where.status = status;
    if (collaboratorId) where.collaboratorId = collaboratorId;
    if (from || to) {
      where.OR = [];
      if (from && to) {
        where.OR.push({ dataInicio: { lte: new Date(to) }, dataFim: { gte: new Date(from) } });
      } else if (from) {
        where.OR.push({ dataFim: { gte: new Date(from) } });
      } else if (to) {
        where.OR.push({ dataInicio: { lte: new Date(to) } });
      }
    }
    return (this.prisma as any).ausencia.findMany({
      where,
      include: {
        collaborator: { include: { user: { select: { id: true, nome: true, email: true } }, setor: { select: { id: true, nome: true, cor: true } } } },
        solicitadaPor: { select: { id: true, nome: true } },
        aprovadaPor:   { select: { id: true, nome: true } },
      },
      orderBy: { dataInicio: "desc" },
    });
  }

  async create(dto: CreateAusenciaDto, user: any) {
    if (!dto.collaboratorId) throw new BadRequestException("Colaborador obrigatório");
    if (!TIPOS_VALIDOS.includes(dto.tipo)) throw new BadRequestException("Tipo inválido");
    if (!dto.dataInicio || !dto.dataFim) throw new BadRequestException("Datas obrigatórias");
    const dInicio = new Date(dto.dataInicio);
    const dFim    = new Date(dto.dataFim);
    if (isNaN(+dInicio) || isNaN(+dFim)) throw new BadRequestException("Datas inválidas");
    if (dFim < dInicio) throw new BadRequestException("Data fim deve ser após data início");

    const collab = await (this.prisma as any).collaborator.findFirst({
      where: { id: dto.collaboratorId, ...this.orgScope(user) },
      include: { user: { select: { nome: true } }, gestor: { select: { userId: true } } },
    });
    if (!collab) throw new NotFoundException("Colaborador não encontrado");

    const ausencia = await (this.prisma as any).ausencia.create({
      data: {
        organizationId: user.organizationId,
        collaboratorId: dto.collaboratorId,
        tipo: dto.tipo,
        dataInicio: dInicio,
        dataFim: dFim,
        diaInteiro: dto.diaInteiro ?? true,
        horasDia: dto.horasDia ?? null,
        descricao: dto.descricao?.trim() || null,
        documentoUrl: dto.documentoUrl?.trim() || null,
        solicitadaPorId: user.id,
        status: "PENDENTE",
      },
      include: {
        collaborator: { include: { user: { select: { id: true, nome: true } } } },
      },
    });
    // Notifica gestor direto
    await this.notify(collab.gestor?.userId, "ausencia_solicitada",
      "Nova solicitação de ausência",
      `${collab.user.nome} solicitou ${dto.tipo} de ${dInicio.toLocaleDateString("pt-BR")} a ${dFim.toLocaleDateString("pt-BR")}`,
      ausencia.id);
    return ausencia;
  }

  async update(id: string, dto: UpdateAusenciaDto, user: any) {
    const { ausencia, isOwn, isMaster } = await this.canManage(id, user);
    if (ausencia.status !== "PENDENTE") throw new BadRequestException("Apenas ausências pendentes podem ser editadas");
    if (!isOwn && !isMaster) throw new ForbiddenException("Apenas o solicitante ou master pode editar");

    const data: any = {};
    if (dto.tipo !== undefined) {
      if (!TIPOS_VALIDOS.includes(dto.tipo)) throw new BadRequestException("Tipo inválido");
      data.tipo = dto.tipo;
    }
    if (dto.dataInicio !== undefined) data.dataInicio = new Date(dto.dataInicio);
    if (dto.dataFim !== undefined)    data.dataFim    = new Date(dto.dataFim);
    if (dto.diaInteiro !== undefined) data.diaInteiro = dto.diaInteiro;
    if (dto.horasDia !== undefined)   data.horasDia   = dto.horasDia;
    if (dto.descricao !== undefined)  data.descricao  = dto.descricao?.trim() || null;
    if (dto.documentoUrl !== undefined) data.documentoUrl = dto.documentoUrl?.trim() || null;

    if (data.dataInicio && data.dataFim && data.dataFim < data.dataInicio)
      throw new BadRequestException("Data fim deve ser após data início");

    return (this.prisma as any).ausencia.update({
      where: { id },
      data,
      include: {
        collaborator: { include: { user: { select: { id: true, nome: true } } } },
      },
    });
  }

  async approve(id: string, user: any) {
    const { ausencia, isGestor, isMaster } = await this.canManage(id, user);
    if (ausencia.status !== "PENDENTE") throw new BadRequestException("Ausência não está pendente");
    if (!isGestor && !isMaster) throw new ForbiddenException("Apenas gestor direto ou master pode aprovar");
    const updated = await (this.prisma as any).ausencia.update({
      where: { id },
      data: { status: "APROVADA", aprovadaPorId: user.id, aprovadaEm: new Date(), motivoRejeicao: null },
    });
    await this.notify(ausencia.solicitadaPorId, "ausencia_aprovada",
      "Ausência aprovada", `Sua solicitação de ${ausencia.tipo} foi aprovada.`, id);
    return updated;
  }

  async reject(id: string, motivo: string, user: any) {
    const { ausencia, isGestor, isMaster } = await this.canManage(id, user);
    if (ausencia.status !== "PENDENTE") throw new BadRequestException("Ausência não está pendente");
    if (!isGestor && !isMaster) throw new ForbiddenException("Apenas gestor direto ou master pode rejeitar");
    const updated = await (this.prisma as any).ausencia.update({
      where: { id },
      data: { status: "REJEITADA", aprovadaPorId: user.id, aprovadaEm: new Date(), motivoRejeicao: motivo?.trim() || null },
    });
    await this.notify(ausencia.solicitadaPorId, "ausencia_rejeitada",
      "Ausência rejeitada", `Sua solicitação de ${ausencia.tipo} foi rejeitada.${motivo ? " Motivo: " + motivo : ""}`, id);
    return updated;
  }

  async cancel(id: string, user: any) {
    const { ausencia, isOwn, isMaster, isGestor } = await this.canManage(id, user);
    if (!isOwn && !isMaster && !isGestor) throw new ForbiddenException("Sem permissão");
    if (ausencia.status === "CANCELADA") throw new BadRequestException("Ausência já cancelada");
    return (this.prisma as any).ausencia.update({
      where: { id },
      data: { status: "CANCELADA" },
    });
  }

  async remove(id: string, user: any) {
    const { ausencia, isOwn, isMaster } = await this.canManage(id, user);
    if (!isOwn && !isMaster) throw new ForbiddenException("Sem permissão");
    if (ausencia.status === "APROVADA") throw new BadRequestException("Ausência aprovada não pode ser removida — cancele-a primeiro");
    return (this.prisma as any).ausencia.delete({ where: { id } });
  }

  // ── Helpers para Capacity ────────────────────────────────────────────────
  /**
   * Retorna mapa { userId -> Set<dateISO> } dos dias em que cada usuário está em ausência APROVADA no período.
   * Usado pelo CapacityService para deduzir da capacidade nominal.
   */
  async getAbsentDaysByUser(user: any, from: Date, to: Date, userIds?: string[]) {
    const where: any = {
      ...this.orgScope(user),
      status: "APROVADA",
      dataInicio: { lte: to },
      dataFim:    { gte: from },
    };
    if (userIds?.length) {
      where.collaborator = { userId: { in: userIds } };
    }
    const rows = await (this.prisma as any).ausencia.findMany({
      where,
      include: { collaborator: { select: { userId: true } } },
    });
    const map = new Map<string, { days: Set<string>; horasDeduzidas: Map<string, number> }>();
    rows.forEach((a: any) => {
      const uid = a.collaborator.userId;
      if (!map.has(uid)) map.set(uid, { days: new Set(), horasDeduzidas: new Map() });
      const entry = map.get(uid)!;
      const start = new Date(Math.max(+from, +new Date(a.dataInicio)));
      const end   = new Date(Math.min(+to, +new Date(a.dataFim)));
      const cur = new Date(start); cur.setHours(0, 0, 0, 0);
      const endD = new Date(end);  endD.setHours(0, 0, 0, 0);
      while (cur <= endD) {
        const d = cur.getDay();
        if (d !== 0 && d !== 6) {
          const key = cur.toISOString().slice(0, 10);
          if (a.diaInteiro) entry.days.add(key);
          else if (a.horasDia) entry.horasDeduzidas.set(key, (entry.horasDeduzidas.get(key) || 0) + a.horasDia);
        }
        cur.setDate(cur.getDate() + 1);
      }
    });
    return map;
  }
}

@Controller("ausencias")
@UseGuards(AuthGuard("jwt"))
export class AusenciasController {
  constructor(private svc: AusenciasService) {}

  @Get()
  findAll(@Req() req: any,
    @Query("status") status?: string,
    @Query("collaboratorId") collaboratorId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.svc.findAll(req.user, status, collaboratorId, from, to);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateAusenciaDto) {
    return this.svc.create(dto, req.user);
  }

  @Put(":id")
  update(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateAusenciaDto) {
    return this.svc.update(id, dto, req.user);
  }

  @Patch(":id/aprovar")
  approve(@Req() req: any, @Param("id") id: string) {
    return this.svc.approve(id, req.user);
  }

  @Patch(":id/rejeitar")
  reject(@Req() req: any, @Param("id") id: string, @Body() dto: RejectAusenciaDto) {
    return this.svc.reject(id, dto.motivo, req.user);
  }

  @Patch(":id/cancelar")
  cancel(@Req() req: any, @Param("id") id: string) {
    return this.svc.cancel(id, req.user);
  }

  @Delete(":id")
  remove(@Req() req: any, @Param("id") id: string) {
    return this.svc.remove(id, req.user);
  }
}

@Module({
  controllers: [AusenciasController],
  providers: [AusenciasService],
  exports: [AusenciasService],
})
export class AusenciasModule {}
