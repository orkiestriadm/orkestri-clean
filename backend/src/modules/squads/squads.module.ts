import {
  Module, Controller, Get, Post, Put, Delete, Body, Param,
  UseGuards, Req, Injectable, BadRequestException, NotFoundException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../../prisma/prisma.service";
import { PermissionsGuard } from "../auth/permissions.guard";
import { Permissions } from "../auth/permissions.decorator";

class CreateSquadDto {
  nome: string;
  descricao?: string;
  cor?: string;
  liderId?: string;
}
class UpdateSquadDto {
  nome?: string;
  descricao?: string | null;
  cor?: string | null;
  liderId?: string | null;
  ativo?: boolean;
}
class AddMemberDto {
  collaboratorId: string;
  alocacaoPercent?: number;
  papel?: string;
}
class UpdateMemberDto {
  alocacaoPercent?: number;
  papel?: string;
}

@Injectable()
export class SquadsService {
  constructor(private prisma: PrismaService) {}

  private orgScope(user: any) {
    return user?.organizationId ? { organizationId: user.organizationId } : {};
  }

  async findAll(user: any) {
    const squads = await (this.prisma as any).squad.findMany({
      where: { ...this.orgScope(user) },
      include: {
        lider: { include: { user: { select: { id: true, nome: true } } } },
        members: {
          include: {
            collaborator: {
              include: { user: { select: { id: true, nome: true } }, setor: { select: { nome: true } } },
            },
          },
        },
      },
      orderBy: { nome: "asc" },
    });
    // calcula capacidade do squad (soma das jornadas × alocação%)
    return squads.map((sq: any) => {
      const capacidadeHorasMes = sq.members.reduce((acc: number, m: any) => {
        const jornadaMes = (m.collaborator.jornadaHorasDia || 8) * 22;
        return acc + jornadaMes * (m.alocacaoPercent / 100);
      }, 0);
      return {
        ...sq,
        capacidadeHorasMes: Number(capacidadeHorasMes.toFixed(0)),
        totalMembros: sq.members.length,
      };
    });
  }

  async findOne(id: string, user: any) {
    const sq = await (this.prisma as any).squad.findFirst({
      where: { id, ...this.orgScope(user) },
      include: {
        lider: { include: { user: { select: { id: true, nome: true } } } },
        members: {
          include: {
            collaborator: {
              include: { user: { select: { id: true, nome: true, email: true } }, setor: { select: { nome: true, cor: true } } },
            },
          },
          orderBy: { criadoEm: "asc" },
        },
      },
    });
    if (!sq) throw new NotFoundException("Squad não encontrado");
    const capacidadeHorasMes = sq.members.reduce((acc: number, m: any) => {
      const jornadaMes = (m.collaborator.jornadaHorasDia || 8) * 22;
      return acc + jornadaMes * (m.alocacaoPercent / 100);
    }, 0);
    return { ...sq, capacidadeHorasMes: Number(capacidadeHorasMes.toFixed(0)), totalMembros: sq.members.length };
  }

  async create(dto: CreateSquadDto, user: any) {
    if (!dto.nome?.trim()) throw new BadRequestException("Nome obrigatório");
    const orgId = user.organizationId;
    const exists = await (this.prisma as any).squad.findFirst({ where: { organizationId: orgId, nome: dto.nome.trim() } });
    if (exists) throw new BadRequestException("Já existe um squad com este nome");
    return (this.prisma as any).squad.create({
      data: {
        organizationId: orgId,
        nome: dto.nome.trim(),
        descricao: dto.descricao?.trim() || null,
        cor: dto.cor || null,
        liderId: dto.liderId || null,
      },
    });
  }

  async update(id: string, dto: UpdateSquadDto, user: any) {
    await this.findOne(id, user);
    if (dto.nome) {
      const dup = await (this.prisma as any).squad.findFirst({
        where: { organizationId: user.organizationId, nome: dto.nome.trim(), NOT: { id } },
      });
      if (dup) throw new BadRequestException("Nome já em uso");
    }
    return (this.prisma as any).squad.update({
      where: { id },
      data: {
        ...(dto.nome !== undefined ? { nome: dto.nome.trim() } : {}),
        ...(dto.descricao !== undefined ? { descricao: dto.descricao?.trim() || null } : {}),
        ...(dto.cor !== undefined ? { cor: dto.cor || null } : {}),
        ...(dto.liderId !== undefined ? { liderId: dto.liderId || null } : {}),
        ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
      },
    });
  }

  async remove(id: string, user: any) {
    await this.findOne(id, user);
    return (this.prisma as any).squad.delete({ where: { id } });
  }

  async addMember(squadId: string, dto: AddMemberDto, user: any) {
    await this.findOne(squadId, user);
    const collab = await (this.prisma as any).collaborator.findFirst({
      where: { id: dto.collaboratorId, ...this.orgScope(user) },
    });
    if (!collab) throw new BadRequestException("Colaborador inválido");
    const dup = await (this.prisma as any).squadMember.findUnique({
      where: { squadId_collaboratorId: { squadId, collaboratorId: dto.collaboratorId } },
    });
    if (dup) throw new BadRequestException("Colaborador já é membro deste squad");
    const aloc = dto.alocacaoPercent ?? 100;
    if (aloc < 0 || aloc > 100) throw new BadRequestException("Alocação deve estar entre 0 e 100");
    return (this.prisma as any).squadMember.create({
      data: { squadId, collaboratorId: dto.collaboratorId, alocacaoPercent: aloc, papel: dto.papel || "membro" },
      include: { collaborator: { include: { user: { select: { id: true, nome: true } } } } },
    });
  }

  async updateMember(squadId: string, memberId: string, dto: UpdateMemberDto, user: any) {
    await this.findOne(squadId, user);
    const m = await (this.prisma as any).squadMember.findFirst({ where: { id: memberId, squadId } });
    if (!m) throw new NotFoundException("Membro não encontrado");
    if (dto.alocacaoPercent !== undefined && (dto.alocacaoPercent < 0 || dto.alocacaoPercent > 100))
      throw new BadRequestException("Alocação deve estar entre 0 e 100");
    return (this.prisma as any).squadMember.update({
      where: { id: memberId },
      data: {
        ...(dto.alocacaoPercent !== undefined ? { alocacaoPercent: dto.alocacaoPercent } : {}),
        ...(dto.papel !== undefined ? { papel: dto.papel } : {}),
      },
    });
  }

  async removeMember(squadId: string, memberId: string, user: any) {
    await this.findOne(squadId, user);
    const m = await (this.prisma as any).squadMember.findFirst({ where: { id: memberId, squadId } });
    if (!m) throw new NotFoundException("Membro não encontrado");
    return (this.prisma as any).squadMember.delete({ where: { id: memberId } });
  }
}

@Controller("squads")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class SquadsController {
  constructor(private svc: SquadsService) {}

  @Get()
  @Permissions("colaboradores:ver")
  findAll(@Req() req: any) { return this.svc.findAll(req.user); }

  @Get(":id")
  @Permissions("colaboradores:ver")
  findOne(@Req() req: any, @Param("id") id: string) { return this.svc.findOne(id, req.user); }

  @Post()
  @Permissions("colaboradores:criar")
  create(@Req() req: any, @Body() dto: CreateSquadDto) { return this.svc.create(dto, req.user); }

  @Put(":id")
  @Permissions("colaboradores:editar")
  update(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateSquadDto) { return this.svc.update(id, dto, req.user); }

  @Delete(":id")
  @Permissions("colaboradores:excluir")
  remove(@Req() req: any, @Param("id") id: string) { return this.svc.remove(id, req.user); }

  @Post(":id/members")
  @Permissions("colaboradores:editar")
  addMember(@Req() req: any, @Param("id") id: string, @Body() dto: AddMemberDto) { return this.svc.addMember(id, dto, req.user); }

  @Put(":id/members/:memberId")
  @Permissions("colaboradores:editar")
  updateMember(@Req() req: any, @Param("id") id: string, @Param("memberId") mid: string, @Body() dto: UpdateMemberDto) {
    return this.svc.updateMember(id, mid, dto, req.user);
  }

  @Delete(":id/members/:memberId")
  @Permissions("colaboradores:editar")
  removeMember(@Req() req: any, @Param("id") id: string, @Param("memberId") mid: string) {
    return this.svc.removeMember(id, mid, req.user);
  }
}

@Module({
  controllers: [SquadsController],
  providers: [SquadsService],
  exports: [SquadsService],
})
export class SquadsModule {}
