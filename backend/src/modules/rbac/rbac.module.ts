import {
  Module, Controller, Get, Post, Patch, Delete,
  Body, Param, UseGuards, Req, HttpCode, HttpStatus,
  BadRequestException, NotFoundException, ForbiddenException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PassportModule } from "@nestjs/passport";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { AuthModule } from "../auth/auth.module";
import { CacheService } from "../cache/cache.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { randomUUID } from "crypto";

const JwtAuthGuard = AuthGuard("jwt");
const CACHE_ROLES   = "cache:roles:list";
const CACHE_PERMS   = "cache:perms:list";
const CACHE_MATRIX  = "cache:rbac:matrix";
const TTL_ROLES     = 300;  // 5 min
const TTL_PERMS     = 3600; // 1 h
const TTL_MATRIX    = 300;  // 5 min

// ──────────────────────────────────────────────
// Controller de Papéis (Roles)
// ──────────────────────────────────────────────
@Controller("rbac/roles")
@UseGuards(JwtAuthGuard)
class RolesController {
  constructor(private prisma: PrismaService, private cache: CacheService) {}

  @Get()
  async listRoles() {
    const cached = await this.cache.get(CACHE_ROLES);
    if (cached) return cached;

    const roles = await this.prisma.role.findMany({
      orderBy: { nivel: "desc" },
      include: {
        rolePermissions: { include: { permission: true } },
        _count: { select: { userRoles: true } },
      },
    });
    await this.cache.set(CACHE_ROLES, roles, TTL_ROLES);
    return roles;
  }

  @Post()
  async createRole(@Body() body: any, @Req() req: any) {
    if (!req.user.isMaster) throw new ForbiddenException("Apenas masters");
    const { nome, descricao, nivel = 0, permissoes = [] } = body;
    if (!nome) throw new BadRequestException("nome é obrigatório");
    const existing = await this.prisma.role.findUnique({ where: { nome } });
    if (existing) throw new BadRequestException("Papel com este nome já existe");

    const role = await this.prisma.role.create({
      data: { id: randomUUID(), nome, descricao, isMaster: false, nivel },
    });

    if (permissoes.length > 0) {
      const perms = await this.prisma.permission.findMany({
        where: { id: { in: permissoes } },
      });
      await this.prisma.rolePermission.createMany({
        data: perms.map(p => ({ roleId: role.id, permissionId: p.id })),
        skipDuplicates: true,
      });
    }

    await this.cache.del(CACHE_ROLES, CACHE_MATRIX);
    return this.prisma.role.findUnique({
      where: { id: role.id },
      include: { rolePermissions: { include: { permission: true } } },
    });
  }

  @Patch(":id")
  async updateRole(@Param("id") id: string, @Body() body: any, @Req() req: any) {
    if (!req.user.isMaster) throw new ForbiddenException("Apenas masters");
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException("Papel não encontrado");
    if (role.isMaster) throw new ForbiddenException("O papel master não pode ser alterado");

    const { nome, descricao, nivel, permissoes } = body;
    await this.prisma.role.update({
      where: { id },
      data: {
        ...(nome && { nome }),
        ...(descricao !== undefined && { descricao }),
        ...(nivel !== undefined && { nivel }),
      },
    });

    // Sincroniza permissões se fornecidas
    if (Array.isArray(permissoes)) {
      await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
      if (permissoes.length > 0) {
        await this.prisma.rolePermission.createMany({
          data: permissoes.map((permId: string) => ({ roleId: id, permissionId: permId })),
          skipDuplicates: true,
        });
      }
    }

    await this.cache.del(CACHE_ROLES, CACHE_MATRIX);
    return this.prisma.role.findUnique({
      where: { id },
      include: { rolePermissions: { include: { permission: true } } },
    });
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRole(@Param("id") id: string, @Req() req: any) {
    if (!req.user.isMaster) throw new ForbiddenException("Apenas masters");
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException("Papel não encontrado");
    if (role.isMaster) throw new ForbiddenException("O papel master não pode ser removido");
    const inUse = await this.prisma.userRole.count({ where: { roleId: id } });
    if (inUse > 0) throw new BadRequestException(`Papel em uso por ${inUse} usuário(s). Reatribua antes de remover.`);
    await this.prisma.role.delete({ where: { id } });
    await this.cache.del(CACHE_ROLES, CACHE_MATRIX);
  }
}

// ──────────────────────────────────────────────
// Controller de Permissões
// ──────────────────────────────────────────────
@Controller("rbac/permissions")
@UseGuards(JwtAuthGuard)
class PermissionsController {
  constructor(private prisma: PrismaService, private cache: CacheService) {}

  @Get()
  async listPermissions() {
    const cached = await this.cache.get(CACHE_PERMS);
    if (cached) return cached;
    const perms = await this.prisma.permission.findMany({ orderBy: [{ recurso: "asc" }, { acao: "asc" }] });
    await this.cache.set(CACHE_PERMS, perms, TTL_PERMS);
    return perms;
  }
}

// ──────────────────────────────────────────────
// Controller de Permissões por Usuário
// ──────────────────────────────────────────────
@Controller("rbac/users/:userId")
@UseGuards(JwtAuthGuard)
class UserPermissionsController {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
    private cache: CacheService,
  ) {}

  // GET /rbac/users/:userId/roles — papéis do usuário
  @Get("roles")
  async getUserRoles(@Param("userId") userId: string, @Req() req: any) {
    if (!req.user.isMaster && req.user.id !== userId) throw new ForbiddenException();
    return this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
    });
  }

  // POST /rbac/users/:userId/roles — atribuir papel
  @Post("roles")
  async assignRole(@Param("userId") userId: string, @Body() body: any, @Req() req: any) {
    if (!req.user.isMaster) throw new ForbiddenException("Apenas masters");
    const { roleId } = body;
    if (!roleId) throw new BadRequestException("roleId é obrigatório");
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException("Papel não encontrado");
    if (role.isMaster && !req.user.isMaster) throw new ForbiddenException("Apenas masters podem atribuir o papel master");
    if (role.nome === "administrador" && !req.user.isMaster) throw new ForbiddenException("Apenas o SA pode atribuir o papel Administrador");
    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      create: { userId, roleId, atribuidoPorId: req.user.id },
      update: {},
    });
    await this.cache.del(`cache:user:${userId}`, `cache:permissions:${userId}`, "cache:users:list");
    return { ok: true };
  }

  // DELETE /rbac/users/:userId/roles/:roleId — remover papel
  @Delete("roles/:roleId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeRole(@Param("userId") userId: string, @Param("roleId") roleId: string, @Req() req: any) {
    if (!req.user.isMaster) throw new ForbiddenException("Apenas masters");
    await this.prisma.userRole.deleteMany({ where: { userId, roleId } });
    await this.cache.del(`cache:user:${userId}`, `cache:permissions:${userId}`, "cache:users:list");
  }

  // GET /rbac/users/:userId/overrides — overrides individuais
  @Get("overrides")
  async getOverrides(@Param("userId") userId: string, @Req() req: any) {
    if (!req.user.isMaster && req.user.id !== userId) throw new ForbiddenException();
    return this.prisma.userPermissionOverride.findMany({
      where: { userId },
      include: { permission: true },
    });
  }

  // POST /rbac/users/:userId/overrides — criar/atualizar override
  @Post("overrides")
  async setOverride(@Param("userId") userId: string, @Body() body: any, @Req() req: any) {
    if (!req.user.isMaster) throw new ForbiddenException("Apenas masters");
    const { permissionId, conceder } = body;
    if (!permissionId) throw new BadRequestException("permissionId é obrigatório");
    const result = await this.prisma.userPermissionOverride.upsert({
      where: { userId_permissionId: { userId, permissionId } },
      create: { id: randomUUID(), userId, permissionId, conceder: conceder !== false },
      update: { conceder: conceder !== false },
    });
    await this.cache.del(`cache:user:${userId}`, `cache:permissions:${userId}`);
    return result;
  }

  // DELETE /rbac/users/:userId/overrides/:permissionId — remover override
  @Delete("overrides/:permissionId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeOverride(@Param("userId") userId: string, @Param("permissionId") permissionId: string, @Req() req: any) {
    if (!req.user.isMaster) throw new ForbiddenException("Apenas masters");
    await this.prisma.userPermissionOverride.deleteMany({ where: { userId, permissionId } });
    await this.cache.del(`cache:user:${userId}`, `cache:permissions:${userId}`);
  }

  // GET /rbac/users/:userId/effective — permissões efetivas resolvidas
  @Get("effective")
  async getEffective(@Param("userId") userId: string, @Req() req: any) {
    if (!req.user.isMaster && req.user.id !== userId) throw new ForbiddenException();
    const permissions = await this.authService.resolvePermissions(userId);
    return { userId, permissions };
  }
}

// ──────────────────────────────────────────────
// Controller de Matriz Role × Permissão
// ──────────────────────────────────────────────
@Controller("rbac/matrix")
@UseGuards(JwtAuthGuard)
class MatrixController {
  constructor(private prisma: PrismaService, private cache: CacheService) {}

  @Get()
  async getMatrix() {
    const cached = await this.cache.get(CACHE_MATRIX);
    if (cached) return cached;

    const [roles, permissions] = await Promise.all([
      this.prisma.role.findMany({
        orderBy: { nivel: "desc" },
        include: { rolePermissions: { select: { permissionId: true } } },
      }),
      this.prisma.permission.findMany({
        orderBy: [{ recurso: "asc" }, { acao: "asc" }],
      }),
    ]);

    const result = {
      roles: roles.map(r => ({
        id: r.id,
        nome: r.nome,
        nivel: r.nivel,
        isMaster: r.isMaster,
        permissoes: r.rolePermissions.map(rp => rp.permissionId),
      })),
      permissions: permissions.map(p => ({
        id: p.id,
        recurso: p.recurso,
        acao: p.acao,
        descricao: p.descricao,
      })),
    };

    await this.cache.set(CACHE_MATRIX, result, TTL_MATRIX);
    return result;
  }
}

// ──────────────────────────────────────────────
// Module
// ──────────────────────────────────────────────
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (cfg: ConfigService) => ({ secret: cfg.get("JWT_SECRET", "fallback"), signOptions: { expiresIn: "8h" } }),
      inject: [ConfigService],
    }),
    NotificationsModule,
    AuthModule, // herda AuthService + AutomacoesModule (re-exportado)
  ],
  controllers: [RolesController, PermissionsController, UserPermissionsController, MatrixController],
  providers: [PrismaService, CacheService],
})
export class RbacModule {}
