import { Module, Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, Req, ConflictException, BadRequestException, NotFoundException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsEmail, IsString, MinLength, IsOptional, IsBoolean, IsArray } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import * as bcrypt from "bcryptjs";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { CacheService } from "../cache/cache.service";

const CACHE_USERS_LIST = "cache:users:list";
const CACHE_USER       = (id: string) => `cache:user:${id}`;
const TTL_LIST         = 60;   // 1 min
const TTL_USER         = 120;  // 2 min

const ALL_MODULOS = ["projetos", "crm", "keep", "gantt", "relatorios"];

function parseModulos(raw?: string | null): string[] {
  try { return JSON.parse(raw || "[]"); } catch { return [...ALL_MODULOS]; }
}

class CreateUserDto {
  @IsString() nome: string;
  @IsEmail() email: string;
  @IsString() @MinLength(6) senha: string;
  @IsOptional() @IsString() cargo?: string;
  @IsOptional() @IsString() telefone?: string;
  @IsOptional() @IsString() setorId?: string;
  @IsOptional() @IsArray() modulos?: string[];
}
class UpdateUserDto {
  @IsOptional() @IsString() nome?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
  @IsOptional() @IsString() cargo?: string;
  @IsOptional() @IsString() telefone?: string;
  @IsOptional() @IsString() setorId?: string;
}
class ChangePasswordDto { @IsString() @MinLength(6) novaSenha: string; }
class UpdateModulosDto { @IsArray() modulos: string[]; }

function mapUser(u: any) {
  return {
    id: u.id, nome: u.nome, email: u.email, ativo: u.ativo,
    avatar: u.avatar, ultimoLogin: u.ultimoLogin, criadoEm: u.criadoEm,
    cargo: u.profile?.cargo,
    telefone: u.profile?.telefone,
    setor: u.profile?.setor ? { id: u.profile.setor.id, nome: u.profile.setor.nome, cor: u.profile.setor.cor } : null,
    roles: u.userRoles.map((ur: any) => ur.role.nome),
    isMaster: u.userRoles.some((ur: any) => ur.role.isMaster),
    modulos: parseModulos(u.profile?.modulos),
  };
}

@Controller("users")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class UsersController {
  constructor(private prisma: PrismaService, private cache: CacheService) {}

  @Get()
  @Permissions("usuarios:ver")
  async findAll(@Query("incluirMaster") incluirMaster?: string, @Req() req?: any) {
    const orgId = req?.user?.organizationId;
    const cacheKey = `${CACHE_USERS_LIST}:${orgId}:${incluirMaster ?? "0"}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const users = await this.prisma.user.findMany({
      where: orgId ? { organizationId: orgId } as any : undefined,
      orderBy: { criadoEm: "asc" },
      include: {
        userRoles: { include: { role: true } },
        profile: { include: { setor: true } },
      },
    });
    const result = users
      .filter(u => incluirMaster === "true" ? true : !u.userRoles.some(ur => ur.role.isMaster))
      .map(mapUser);
    await this.cache.set(cacheKey, result, TTL_LIST);
    return result;
  }

  @Get("roles/list")
  @Permissions("usuarios:ver")
  async getRoles() { return this.prisma.role.findMany({ orderBy: { nome: "asc" } }); }

  // Lista leve para seletores (participantes de eventos, membros de tarefas, etc).
  // Não exige usuarios:ver — qualquer usuário autenticado pode escolher colegas.
  @Get("picklist")
  async picklist(@Req() req: any) {
    const orgId = req?.user?.organizationId;
    const users = await this.prisma.user.findMany({
      where: { ...(orgId ? { organizationId: orgId } : {}), ativo: true } as any,
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, email: true, avatar: true },
    });
    return users;
  }

  // ── Self-profile endpoints (no extra permission required) ──────────────────
  @Get("me")
  async getMe(@Req() req: any) {
    const id = req.user.id;
    const u = await this.prisma.user.findUnique({
      where: { id },
      include: { userRoles: { include: { role: true } }, profile: { include: { setor: true } } },
    });
    if (!u) throw new NotFoundException("Usuario nao encontrado");
    return {
      ...mapUser(u),
      whatsapp: u.profile?.whatsapp,
      whatsappAlertas: u.profile?.whatsappAlertas ?? false,
      statusOnline: u.profile?.statusOnline ?? "disponivel",
    };
  }

  @Patch("me")
  async updateMe(@Req() req: any, @Body() body: {
    nome?: string; telefone?: string; cargo?: string;
    whatsapp?: string; whatsappAlertas?: boolean; statusOnline?: string;
  }) {
    const id = req.user.id;
    if (body.nome) {
      await this.prisma.user.update({ where: { id }, data: { nome: body.nome } });
    }
    await this.prisma.userProfile.upsert({
      where: { userId: id },
      update: {
        ...(body.telefone !== undefined && { telefone: body.telefone }),
        ...(body.cargo !== undefined && { cargo: body.cargo }),
        ...(body.whatsapp !== undefined && { whatsapp: body.whatsapp }),
        ...(body.whatsappAlertas !== undefined && { whatsappAlertas: body.whatsappAlertas }),
        ...(body.statusOnline !== undefined && { statusOnline: body.statusOnline }),
      },
      create: {
        userId: id, telefone: body.telefone, cargo: body.cargo,
        whatsapp: body.whatsapp, whatsappAlertas: body.whatsappAlertas ?? false,
        statusOnline: body.statusOnline ?? "disponivel",
      },
    });
    await this.cache.del(CACHE_USER(id));
    return this.getMe(req);
  }

  @Patch("me/senha")
  async changeMyPassword(@Req() req: any, @Body() body: { senhaAtual: string; novaSenha: string }) {
    const id = req.user.id;
    if (!body.senhaAtual || !body.novaSenha) throw new BadRequestException("Campos obrigatórios");
    if (body.novaSenha.length < 6) throw new BadRequestException("Senha deve ter ao menos 6 caracteres");
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("Usuário não encontrado");
    const ok = await bcrypt.compare(body.senhaAtual, user.senhaHash);
    if (!ok) throw new BadRequestException("Senha atual incorreta");
    await this.prisma.user.update({ where: { id }, data: { senhaHash: await bcrypt.hash(body.novaSenha, 12) } });
    return { message: "Senha alterada com sucesso" };
  }

  @Get(":id")
  @Permissions("usuarios:ver")
  async findOne(@Param("id") id: string) {
    const cached = await this.cache.get(CACHE_USER(id));
    if (cached) return cached;

    const u = await this.prisma.user.findUnique({
      where: { id },
      include: { userRoles: { include: { role: true } }, profile: { include: { setor: true } } },
    });
    if (!u) throw new NotFoundException("Usuario nao encontrado");
    const result = mapUser(u);
    await this.cache.set(CACHE_USER(id), result, TTL_USER);
    return result;
  }

  @Post()
  @Permissions("usuarios:criar")
  async create(@Body() dto: CreateUserDto, @Req() req: any) {
    const orgId = req.user?.organizationId;
    const exists = await this.prisma.user.findFirst({ where: { email: dto.email, ...(orgId ? { organizationId: orgId } : {}) } as any });
    if (exists) throw new ConflictException("E-mail ja cadastrado");

    // Verificar limite de usuários do plano
    if (orgId) {
      try {
        const billing = await (this.prisma as any).orgBilling.findUnique({
          where: { organizationId: orgId },
          select: { plano: true, status: true },
        });
        const PLAN_LIMITS: Record<string, number | null> = {
          business_cloud: 5, business_plus: 10, enterprise: null,
        };
        const maxUsers = billing ? (PLAN_LIMITS[billing.plano] ?? null) : null;
        if (maxUsers !== null) {
          const currentCount = await (this.prisma as any).user.count({
            where: { organizationId: orgId, ativo: true },
          });
          if (currentCount >= maxUsers) {
            throw new BadRequestException(
              `Limite de ${maxUsers} usuários atingido para o plano atual. Faça upgrade para adicionar mais usuários.`
            );
          }
        }
      } catch (e: any) {
        if (e instanceof BadRequestException) throw e;
        // Ignora erros de infraestrutura (tabela billing ainda não existe)
      }
    }

    const hash = await bcrypt.hash(dto.senha, 12);
    const modulosJson = JSON.stringify(dto.modulos ?? ALL_MODULOS);

    const user = await this.prisma.user.create({
      data: {
        nome: dto.nome, email: dto.email, senhaHash: hash,
        ...(orgId ? { organizationId: orgId } : {}),
        profile: { create: { cargo: dto.cargo, telefone: dto.telefone, setorId: dto.setorId || null, modulos: modulosJson } },
      } as any,
      include: { userRoles: { include: { role: true } }, profile: { include: { setor: true } } },
    });
    await this.cache.del(CACHE_USERS_LIST, `${CACHE_USERS_LIST}:true`, `${CACHE_USERS_LIST}:0`);
    return mapUser(user);
  }

  @Put(":id")
  @Permissions("usuarios:editar")
  async update(@Param("id") id: string, @Body() dto: UpdateUserDto, @Req() req?: any) {
    const orgId = req?.user?.organizationId;
    const exists = await this.prisma.user.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException("Usuario nao encontrado");
    if (dto.email && dto.email !== exists.email) {
      const t = await this.prisma.user.findFirst({ where: { email: dto.email, ...(orgId ? { organizationId: orgId } : {}) } as any });
      if (t) throw new ConflictException("E-mail ja em uso");
    }
    await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.nome && { nome: dto.nome }),
        ...(dto.email && { email: dto.email }),
        ...(dto.ativo !== undefined && { ativo: dto.ativo }),
      },
    });
    await this.prisma.userProfile.upsert({
      where: { userId: id },
      update: { cargo: dto.cargo, telefone: dto.telefone, ...(dto.setorId !== undefined && { setorId: dto.setorId || null }) },
      create: { userId: id, cargo: dto.cargo, telefone: dto.telefone, setorId: dto.setorId || null },
    });
    await this.cache.del(CACHE_USER(id), CACHE_USERS_LIST, `${CACHE_USERS_LIST}:true`, `${CACHE_USERS_LIST}:0`);
    return this.findOne(id);
  }

  @Patch(":id/password")
  @Permissions("usuarios:editar")
  async changePassword(@Param("id") id: string, @Body() dto: ChangePasswordDto) {
    const exists = await this.prisma.user.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException("Usuario nao encontrado");
    await this.prisma.user.update({ where: { id }, data: { senhaHash: await bcrypt.hash(dto.novaSenha, 12) } });
    return { message: "Senha alterada com sucesso" };
  }

  @Patch(":id/modulos")
  @Permissions("usuarios:editar")
  async updateModulos(@Param("id") id: string, @Body() dto: UpdateModulosDto) {
    const validModulos = dto.modulos.filter(m => ALL_MODULOS.includes(m));
    await this.prisma.userProfile.upsert({
      where: { userId: id },
      update: { modulos: JSON.stringify(validModulos) },
      create: { userId: id, modulos: JSON.stringify(validModulos) },
    });
    return { modulos: validModulos };
  }

  @Patch(":id/toggle")
  @Permissions("usuarios:editar")
  async toggle(@Param("id") id: string, @Req() req: any) {
    if (id === req.user.id) throw new BadRequestException("Voce nao pode desativar sua propria conta");
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("Usuario nao encontrado");
    const updated = await this.prisma.user.update({ where: { id }, data: { ativo: !user.ativo } });
    await this.cache.del(CACHE_USER(id), CACHE_USERS_LIST, `${CACHE_USERS_LIST}:true`, `${CACHE_USERS_LIST}:0`);
    return { message: updated.ativo ? "Usuario ativado" : "Usuario desativado", ativo: updated.ativo };
  }

  @Delete(":id")
  @Permissions("usuarios:deletar")
  async remove(@Param("id") id: string, @Req() req: any) {
    if (id === req.user.id) throw new BadRequestException("Voce nao pode remover sua propria conta");
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("Usuario nao encontrado");

    try {
    await this.prisma.$transaction(async (tx) => {
      // Nullify optional FK refs that have no CASCADE/SET NULL in DB
      await tx.userRole.updateMany({ where: { atribuidoPorId: id }, data: { atribuidoPorId: null } });
      await tx.task.updateMany({ where: { assigneeId: id }, data: { assigneeId: null } });
      await tx.chamado.updateMany({ where: { atendenteId: id }, data: { atendenteId: null } });
      await tx.clienteTimeline.updateMany({ where: { userId: id }, data: { userId: null } });
      await tx.auditLog.updateMany({ where: { userId: id }, data: { userId: null } });
      await tx.checklistItem.updateMany({ where: { assigneeId: id }, data: { assigneeId: null } });

      // Workforce: aprovações de workflow feitas pelo usuário.
      // A FK era SET NULL numa coluna NOT NULL — quebrava o delete.
      await (tx as any).workflowApproval.deleteMany({ where: { aprovadorId: id } });

      // Delete approval requests made by this user
      await tx.aprovacaoOrcamento.deleteMany({ where: { solicitadoPorId: id } });
      // Delete orcamento items created by user (cascades: meses, timeline, aprovacoes)
      await tx.itemOrcamento.deleteMany({ where: { criadoPorId: id } });
      // Delete knowledge base articles authored by user
      await tx.artigoConhecimento.deleteMany({ where: { autorId: id } });
      // Delete asset transfers performed by user
      await tx.transferenciaAtivo.deleteMany({ where: { realizadoPorId: id } });
      // Delete chamados where user was the requester (cascades: comentarios, apontamentos)
      await tx.chamado.deleteMany({ where: { solicitanteId: id } });

      // Delete owned records
      await tx.taskComment.deleteMany({ where: { userId: id } });
      await tx.task.deleteMany({ where: { criadoPorId: id } });
      await tx.project.deleteMany({ where: { criadoPorId: id } });
      await tx.event.deleteMany({ where: { OR: [{ userId: id }, { criadoPorId: id }] } });
      await tx.note.deleteMany({ where: { userId: id } });
      await tx.noteLabel.deleteMany({ where: { userId: id } });
      await tx.dailyTask.deleteMany({ where: { userId: id } });

      // Delete user — DB CASCADE handles: SuperAdmin, PasswordResetOtp, UserProfile,
      // UserRole, UserPermissionOverride, UserSession, EventParticipant,
      // ChamadoComentario, ProjectMember, Notification, ApontamentoHoras, NoteCollaborator
      await tx.user.delete({ where: { id } });
    }, { timeout: 30000 });
    } catch (e: any) {
      if (e?.code === "P2003" || /foreign key|constraint/i.test(e?.message || "")) {
        const alvo = e?.meta?.field_name || e?.meta?.constraint || "vínculo no sistema";
        throw new BadRequestException(
          `Não foi possível remover: o usuário ainda possui registros vinculados (${alvo}). Reatribua ou remova esses registros antes.`,
        );
      }
      throw e;
    }

    await this.cache.del(CACHE_USER(id), CACHE_USERS_LIST, `${CACHE_USERS_LIST}:true`, `${CACHE_USERS_LIST}:0`);
    return { message: "Usuario removido permanentemente" };
  }
}

@Module({
  controllers: [UsersController],
  providers: [CacheService],
})
export class UsersModule {}
