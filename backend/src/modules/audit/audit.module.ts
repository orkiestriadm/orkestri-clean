import {
  Module, Controller, Get, Injectable,
  UseGuards, Req, Query, ForbiddenException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../../prisma/prisma.service";

// ── Serviço de Auditoria (exportável para outros módulos) ──────────────────────
@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(data: {
    userId?: string | null;
    modulo?: string;
    tabela: string;
    registroId: string;
    acao: string;
    descricao?: string;
    dados?: Record<string, any> | null;
    ip?: string | null;
  }) {
    try {
      await (this.prisma.auditLog.create as any)({
        data: {
          id: require("crypto").randomUUID(),
          userId: data.userId || null,
          modulo: data.modulo || null,
          tabela: data.tabela,
          registroId: data.registroId,
          acao: data.acao,
          descricao: data.descricao || null,
          dados: data.dados || null,
          ip: data.ip || null,
        },
      });
    } catch {}
  }
}

// ── Controller de Auditoria ───────────────────────────────────────────────────
@Controller("audit")
class AuditController {
  constructor(private prisma: PrismaService) {}

  private canAccess(req: any) {
    const p: string[] = req.user?.permissions || [];
    return req.user?.isMaster || p.includes("*") || p.includes("historico:ver");
  }

  // GET /audit/stats — estatísticas dos últimos 30 dias
  @Get("stats")
  @UseGuards(AuthGuard("jwt"))
  async getStats(@Req() req: any) {
    if (!this.canAccess(req)) throw new ForbiddenException();
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const orgId = req.user?.organizationId;
    const ow = orgId ? { organizationId: orgId } as any : {};
    const [total, hoje, byAcao, byModulo, topUsers] = await Promise.all([
      this.prisma.auditLog.count({ where: { criadoEm: { gte: since30d }, ...ow } }),
      this.prisma.auditLog.count({ where: { criadoEm: { gte: today }, ...ow } }),
      this.prisma.auditLog.groupBy({ by: ["acao"] as any, _count: true, where: { criadoEm: { gte: since30d }, ...ow } }),
      (this.prisma.auditLog.groupBy as any)({
        by: ["modulo"],
        _count: true,
        where: { criadoEm: { gte: since30d }, modulo: { not: null }, ...ow },
        orderBy: { _count: { modulo: "desc" } },
        take: 10,
      }),
      this.prisma.auditLog.groupBy({
        by: ["userId"] as any,
        _count: true,
        where: { criadoEm: { gte: since30d }, userId: { not: null }, ...ow } as any,
        orderBy: { _count: { userId: "desc" } } as any,
        take: 5,
      }),
    ]);

    // Enrich top users with names
    const userIds = topUsers.map((u: any) => u.userId).filter(Boolean);
    const userMap = userIds.length > 0
      ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, nome: true, avatar: true } })
      : [];

    return {
      total,
      hoje,
      byAcao: Object.fromEntries((byAcao as any[]).map(r => [r.acao, r._count])),
      byModulo: Object.fromEntries((byModulo as any[]).map(r => [r.modulo, r._count])),
      topUsers: (topUsers as any[]).map(u => ({
        userId: u.userId,
        count: u._count,
        ...userMap.find(um => um.id === u.userId),
      })),
    };
  }

  // GET /audit — listagem com filtros e paginação
  @Get()
  @UseGuards(AuthGuard("jwt"))
  async findAll(
    @Req() req: any,
    @Query("userId") userId?: string,
    @Query("tabela") tabela?: string,
    @Query("modulo") modulo?: string,
    @Query("acao") acao?: string,
    @Query("q") q?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    if (!this.canAccess(req)) throw new ForbiddenException();

    const take = Math.min(Number(limit) || 50, 200);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const orgId2 = req.user?.organizationId;
    const ow2 = orgId2 ? { organizationId: orgId2 } as any : {};
    const where: any = { ...ow2 };
    if (userId) where.userId = userId;
    if (tabela) where.tabela = tabela;
    if (modulo) where.modulo = modulo;
    if (acao)   where.acao = acao;
    if (from || to) {
      where.criadoEm = {};
      if (from) where.criadoEm.gte = new Date(from);
      if (to)   { const t = new Date(to); t.setHours(23, 59, 59, 999); where.criadoEm.lte = t; }
    }
    if (q) {
      where.OR = [
        { descricao: { contains: q, mode: "insensitive" } },
        { tabela:    { contains: q, mode: "insensitive" } },
        { registroId:{ contains: q, mode: "insensitive" } },
        { user: { nome: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { criadoEm: "desc" },
        take,
        skip,
        include: { user: { select: { id: true, nome: true, email: true, avatar: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page: Math.max(Number(page) || 1, 1), limit: take };
  }

  // GET /audit/modulos — valores distintos de modulo para filtros
  @Get("modulos")
  @UseGuards(AuthGuard("jwt"))
  async getModulos(@Req() req: any) {
    if (!this.canAccess(req)) throw new ForbiddenException();
    const result = await (this.prisma.auditLog.findMany as any)({
      select: { modulo: true },
      distinct: ["modulo"],
      where: { modulo: { not: null } },
      orderBy: { modulo: "asc" },
    });
    return result.map((r: any) => r.modulo).filter(Boolean);
  }
}

// ── Module ────────────────────────────────────────────────────────────────────
@Module({
  controllers: [AuditController],
  providers: [PrismaService, AuditService],
  exports: [AuditService],
})
export class AuditModule {}
