import {
  Module, Controller, Get, Post, Put, Patch, Delete, Body, Param, Query,
  UseGuards, Req, ForbiddenException, NotFoundException, BadRequestException,
  HttpCode, HttpStatus, Injectable,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsString, IsOptional, IsNumber, IsBoolean, IsArray } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { PermissionsGuard } from "../auth/permissions.guard";
import { Permissions } from "../auth/permissions.decorator";

// ─── DTOs ────────────────────────────────────────────────────────────────────

class CreateCollaboratorDto {
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsString() matricula?: string;
  @IsOptional() @IsString() fotoUrl?: string;
  @IsOptional() @IsString() emailCorporativo?: string;
  @IsOptional() @IsString() telefone?: string;
  @IsOptional() @IsString() cargo?: string;
  @IsOptional() @IsString() departamento?: string;
  @IsOptional() @IsString() setorId?: string;
  @IsOptional() @IsString() squad?: string;
  @IsOptional() @IsString() especialidade?: string;
  @IsOptional() @IsString() senioridade?: string;
  @IsOptional() @IsString() gestorId?: string;
  @IsOptional() @IsNumber() jornadaHorasDia?: number;
  @IsOptional() @IsNumber() jornadaHorasMes?: number;
  @IsOptional() @IsString() turno?: string;
  @IsOptional() @IsString() escala?: string;
  @IsOptional() @IsString() tipoVinculo?: string;
  @IsOptional() @IsArray() skills?: any;
  @IsOptional() @IsArray() certificacoes?: any;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

class UpdateCollaboratorDto {
  @IsOptional() @IsString() matricula?: string;
  @IsOptional() @IsString() fotoUrl?: string;
  @IsOptional() @IsString() emailCorporativo?: string;
  @IsOptional() @IsString() telefone?: string;
  @IsOptional() @IsString() cargo?: string;
  @IsOptional() @IsString() departamento?: string;
  @IsOptional() @IsString() setorId?: string;
  @IsOptional() @IsString() squad?: string;
  @IsOptional() @IsString() especialidade?: string;
  @IsOptional() @IsString() senioridade?: string;
  @IsOptional() @IsString() gestorId?: string;
  @IsOptional() @IsNumber() jornadaHorasDia?: number;
  @IsOptional() @IsNumber() jornadaHorasMes?: number;
  @IsOptional() @IsString() turno?: string;
  @IsOptional() @IsString() escala?: string;
  @IsOptional() @IsString() tipoVinculo?: string;
  @IsOptional() @IsArray() skills?: any;
  @IsOptional() @IsArray() certificacoes?: any;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class CollaboratorsService {
  constructor(private prisma: PrismaService) {}

  private scope(user: any) {
    return user?.organizationId ? { organizationId: user.organizationId } : {};
  }

  /** Gera a próxima matrícula: 3 letras da organização + sequencial 4 dígitos (ex: DEF0001). */
  async nextMatricula(user: any) {
    const orgId = user?.organizationId;
    const org = orgId ? await this.prisma.organization.findUnique({ where: { id: orgId } }) : null;
    const base = (org?.nome || "ORG")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")  // remove acentos
      .replace(/[^A-Za-z]/g, "").toUpperCase();
    const prefix = (base.slice(0, 3) || "ORG").padEnd(3, "X");
    const existing = await (this.prisma as any).collaborator.findMany({
      where: { organizationId: orgId, matricula: { startsWith: prefix } },
      select: { matricula: true },
    });
    let max = 0;
    for (const c of existing) {
      const n = parseInt(String(c.matricula || "").slice(prefix.length).replace(/\D/g, ""), 10);
      if (!isNaN(n) && n > max) max = n;
    }
    return { prefix, matricula: prefix + String(max + 1).padStart(4, "0") };
  }

  async findAll(user: any, search?: string, ativo?: string) {
    const where: any = { ...this.scope(user) };
    if (ativo === "true") where.ativo = true;
    if (ativo === "false") where.ativo = false;
    if (search) {
      where.OR = [
        { matricula: { contains: search, mode: "insensitive" } },
        { cargo: { contains: search, mode: "insensitive" } },
        { departamento: { contains: search, mode: "insensitive" } },
        { user: { nome: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ];
    }
    return (this.prisma as any).collaborator.findMany({
      where,
      include: {
        user:   { select: { id: true, nome: true, email: true, avatar: true, ativo: true } },
        setor:  { select: { id: true, nome: true, cor: true } },
        gestor: { include: { user: { select: { id: true, nome: true } } } },
      },
      orderBy: { criadoEm: "desc" },
    });
  }

  async findOne(id: string, user: any) {
    const c = await (this.prisma as any).collaborator.findFirst({
      where: { id, ...this.scope(user) },
      include: {
        user:   { select: { id: true, nome: true, email: true, avatar: true, ativo: true } },
        setor:  { select: { id: true, nome: true, cor: true } },
        gestor: { include: { user: { select: { id: true, nome: true } } } },
        liderados: { include: { user: { select: { id: true, nome: true } } } },
      },
    });
    if (!c) throw new NotFoundException("Colaborador não encontrado");
    return c;
  }

  async create(dto: CreateCollaboratorDto, user: any) {
    if (!dto.userId) throw new BadRequestException("userId obrigatório");
    const orgId = user.organizationId;
    // Verifica que o User pertence à mesma org
    const u = await this.prisma.user.findFirst({ where: { id: dto.userId, organizationId: orgId } as any });
    if (!u) throw new BadRequestException("Usuário não encontrado nesta organização");
    // Verifica que ainda não existe Collaborator para este User
    const exists = await (this.prisma as any).collaborator.findUnique({ where: { userId: dto.userId } });
    if (exists) throw new BadRequestException("Usuário já é colaborador");
    // Verifica matrícula única na org
    if (dto.matricula) {
      const dup = await (this.prisma as any).collaborator.findFirst({ where: { organizationId: orgId, matricula: dto.matricula } });
      if (dup) throw new BadRequestException("Matrícula já existe nesta organização");
    }
    return (this.prisma as any).collaborator.create({
      data: { ...dto, organizationId: orgId, ativo: dto.ativo ?? true },
      include: { user: { select: { id: true, nome: true, email: true } } },
    });
  }

  async update(id: string, dto: UpdateCollaboratorDto, user: any) {
    const c = await this.findOne(id, user);
    if (dto.matricula && dto.matricula !== c.matricula) {
      const dup = await (this.prisma as any).collaborator.findFirst({
        where: { organizationId: user.organizationId, matricula: dto.matricula, NOT: { id } },
      });
      if (dup) throw new BadRequestException("Matrícula já existe nesta organização");
    }
    if (dto.gestorId === id) throw new BadRequestException("Colaborador não pode ser gestor de si mesmo");
    return (this.prisma as any).collaborator.update({
      where: { id },
      data: dto,
      include: {
        user:  { select: { id: true, nome: true, email: true } },
        setor: { select: { id: true, nome: true, cor: true } },
        gestor:{ include: { user: { select: { id: true, nome: true } } } },
      },
    });
  }

  async remove(id: string, user: any) {
    await this.findOne(id, user);
    return (this.prisma as any).collaborator.delete({ where: { id } });
  }

  async toggleAtivo(id: string, user: any) {
    const c = await this.findOne(id, user);
    return (this.prisma as any).collaborator.update({
      where: { id },
      data: { ativo: !c.ativo },
    });
  }
}

// ─── Controller ──────────────────────────────────────────────────────────────

@Controller("collaborators")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class CollaboratorsController {
  constructor(private svc: CollaboratorsService) {}

  @Get()
  @Permissions("colaboradores:ver")
  findAll(@Req() req: any, @Query("search") search?: string, @Query("ativo") ativo?: string) {
    return this.svc.findAll(req.user, search, ativo);
  }

  @Get("next-matricula")
  @Permissions("colaboradores:ver")
  nextMatricula(@Req() req: any) {
    return this.svc.nextMatricula(req.user);
  }

  @Get(":id")
  @Permissions("colaboradores:ver")
  findOne(@Req() req: any, @Param("id") id: string) {
    return this.svc.findOne(id, req.user);
  }

  @Post()
  @Permissions("colaboradores:criar")
  create(@Req() req: any, @Body() dto: CreateCollaboratorDto) {
    return this.svc.create(dto, req.user);
  }

  @Put(":id")
  @Permissions("colaboradores:editar")
  update(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateCollaboratorDto) {
    return this.svc.update(id, dto, req.user);
  }

  @Patch(":id/toggle")
  @Permissions("colaboradores:editar")
  @HttpCode(HttpStatus.OK)
  toggle(@Req() req: any, @Param("id") id: string) {
    return this.svc.toggleAtivo(id, req.user);
  }

  @Delete(":id")
  @Permissions("colaboradores:excluir")
  remove(@Req() req: any, @Param("id") id: string) {
    return this.svc.remove(id, req.user);
  }
}

// ─── Module ──────────────────────────────────────────────────────────────────

@Module({
  controllers: [CollaboratorsController],
  providers: [CollaboratorsService],
  exports: [CollaboratorsService],
})
export class CollaboratorsModule {}
