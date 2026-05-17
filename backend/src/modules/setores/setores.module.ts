import { Module, Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsString, IsOptional } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";

class SetorDto {
  @IsString() nome: string;
  @IsOptional() @IsString() descricao?: string;
  @IsOptional() @IsString() cor?: string;
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @IsString() responsavelId?: string;
}

const SETOR_INCLUDE = {
  responsavel: { select: { id: true, nome: true, avatar: true } },
  _count: { select: { users: true } },
};

@Controller("setores")
class SetoresController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @UseGuards(AuthGuard("jwt"))
  async findAll(@Req() req: any) {
    const orgId = req.user?.organizationId;
    return this.prisma.setor.findMany({
      where: { ativo: true, ...(orgId ? { organizationId: orgId } as any : {}) },
      orderBy: { nome: "asc" },
      include: SETOR_INCLUDE,
    });
  }

  // Retorna setores raiz com filhos aninhados
  @Get("tree")
  @UseGuards(AuthGuard("jwt"))
  async getTree(@Req() req: any) {
    const orgId = req.user?.organizationId;
    const all = await this.prisma.setor.findMany({
      where: { ativo: true, ...(orgId ? { organizationId: orgId } as any : {}) },
      orderBy: { nome: "asc" },
      include: SETOR_INCLUDE,
    });

    const map = new Map<string, any>(all.map(s => [s.id, { ...s, filhos: [] }]));
    const roots: any[] = [];

    for (const s of map.values()) {
      const parentId = (s as any).parentId;
      if (parentId && map.has(parentId)) {
        map.get(parentId).filhos.push(s);
      } else {
        roots.push(s);
      }
    }
    return roots;
  }

  @Post()
  @UseGuards(AuthGuard("jwt"))
  async create(@Body() dto: SetorDto, @Req() req: any) {
    if (!req.user.isMaster) throw new Error("Apenas masters");
    const orgId = req.user?.organizationId;
    return (this.prisma.setor.create as any)({
      data: {
        nome: dto.nome,
        descricao: dto.descricao || null,
        cor: dto.cor || "#a78bfa",
        parentId: dto.parentId || null,
        responsavelId: dto.responsavelId || null,
        ...(orgId ? { organizationId: orgId } : {}),
      },
      include: SETOR_INCLUDE,
    });
  }

  @Put(":id")
  @UseGuards(AuthGuard("jwt"))
  async update(@Param("id") id: string, @Body() dto: SetorDto, @Req() req: any) {
    if (!req.user.isMaster) throw new Error("Apenas masters");
    if (dto.parentId === id) throw new Error("Um setor não pode ser pai de si mesmo");
    return (this.prisma.setor.update as any)({
      where: { id },
      data: {
        nome: dto.nome,
        descricao: dto.descricao ?? null,
        cor: dto.cor,
        parentId: dto.parentId || null,
        responsavelId: dto.responsavelId || null,
      },
      include: SETOR_INCLUDE,
    });
  }

  @Delete(":id")
  @UseGuards(AuthGuard("jwt"))
  async remove(@Param("id") id: string, @Req() req: any) {
    if (!req.user.isMaster) throw new Error("Apenas masters");
    const setor = await (this.prisma.setor.findUnique as any)({ where: { id } });
    // Move children up to grandparent
    await (this.prisma.setor.updateMany as any)({
      where: { parentId: id },
      data: { parentId: setor?.parentId || null },
    });
    await (this.prisma.setor.update as any)({ where: { id }, data: { ativo: false } });
    return { message: "Setor desativado" };
  }
}

// Diretório de pessoas da organização
@Controller("organizacao")
class OrganizacaoController {
  constructor(private prisma: PrismaService) {}

  @Get("diretorio")
  @UseGuards(AuthGuard("jwt"))
  async getDiretorio(@Req() req: any) {
    const orgId = req.user?.organizationId;
    const users = await this.prisma.user.findMany({
      where: { ativo: true, ...(orgId ? { organizationId: orgId } as any : {}) },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        email: true,
        avatar: true,
        ultimoLogin: true,
        userRoles: {
          select: { role: { select: { nome: true, nivel: true, isMaster: true } } },
        },
        profile: {
          select: {
            cargo: true,
            telefone: true,
            statusOnline: true,
            setor: { select: { id: true, nome: true, cor: true } },
          },
        },
      },
    });

    return users.map(u => ({
      id: u.id,
      nome: u.nome,
      email: u.email,
      avatar: u.avatar,
      ultimoLogin: u.ultimoLogin,
      cargo: (u.profile as any)?.cargo || null,
      telefone: (u.profile as any)?.telefone || null,
      statusOnline: (u.profile as any)?.statusOnline || "offline",
      setor: (u.profile as any)?.setor || null,
      roles: u.userRoles.map(ur => ur.role.nome),
      isMaster: u.userRoles.some(ur => ur.role.isMaster),
      nivel: u.userRoles.reduce((max, ur) => Math.max(max, ur.role.nivel), 0),
    }));
  }
}

@Module({
  controllers: [SetoresController, OrganizacaoController],
  providers: [PrismaService],
})
export class SetoresModule {}
