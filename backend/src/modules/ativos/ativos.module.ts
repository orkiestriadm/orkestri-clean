import {
  Module, Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, UseGuards, Req, Headers,
  NotFoundException, BadRequestException,
  UnauthorizedException, Logger,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../../prisma/prisma.service";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { AutomacaoService } from "../automacoes/automacoes.module";
import { AutomacoesModule } from "../automacoes/automacoes.module";
import * as crypto from "crypto";

// ── helpers ───────────────────────────────────────────────────────────────────
const STATUS_VALID = ["ativo", "inativo", "em_manutencao", "descartado", "emprestado"];

const ATIVO_INCLUDE = {
  categoria:   { select: { id: true, nome: true, cor: true, icone: true } },
  responsavel: { select: { id: true, nome: true, email: true, avatar: true } },
  setor:       { select: { id: true, nome: true, cor: true } },
};

function mapAtivo(a: any) {
  const now = new Date();
  const garantiaOk    = a.dataGarantiaFim ? new Date(a.dataGarantiaFim) > now : null;
  const garantiaRisco = a.dataGarantiaFim
    ? !garantiaOk && new Date(a.dataGarantiaFim) > new Date(now.getTime() - 30 * 86400000)
    : null;
  return { ...a, garantiaOk, garantiaRisco, garantiaVencida: a.dataGarantiaFim ? !garantiaOk : false };
}

// ── Categories Controller ─────────────────────────────────────────────────────
@Controller("ativos/categorias")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class CategoriasAtivoController {
  constructor(private prisma: PrismaService) {}
  private get db() { return this.prisma as any; }

  @Get()
  @Permissions("ativos:ver")
  async findAll(@Req() req: any) {
    const orgId = req.user?.organizationId;
    const cats = await this.db.categoriaAtivo.findMany({
      where: { ativo: true, ...(orgId ? { organizationId: orgId } : {}) },
      orderBy: { nome: "asc" },
      include: { _count: { select: { ativos: true } } },
    });
    return cats.map((c: any) => ({ ...c, totalAtivos: c._count.ativos }));
  }

  @Post()
  @Permissions("ativos:criar")
  async create(@Body() body: { nome: string; descricao?: string; icone?: string; cor?: string }, @Req() req: any) {
    if (!body.nome?.trim()) throw new BadRequestException("Nome obrigatorio");
    const orgId = req.user?.organizationId;
    try {
      return await this.db.categoriaAtivo.create({
        data: { id: crypto.randomUUID(), nome: body.nome.trim(), descricao: body.descricao || null, icone: body.icone || "monitor", cor: body.cor || "#7c3aed", ...(orgId ? { organizationId: orgId } : {}) } as any,
      });
    } catch (e: any) {
      if (e.code === "P2002") throw new BadRequestException("Categoria ja existe");
      throw e;
    }
  }

  @Put(":id")
  @Permissions("ativos:editar")
  async update(@Param("id") id: string, @Body() body: any) {
    const existing = await this.db.categoriaAtivo.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Categoria nao encontrada");
    return this.db.categoriaAtivo.update({ where: { id }, data: { ...(body.nome && { nome: body.nome.trim() }), ...(body.descricao !== undefined && { descricao: body.descricao }), ...(body.icone && { icone: body.icone }), ...(body.cor && { cor: body.cor }), ...(body.ativo !== undefined && { ativo: Boolean(body.ativo) }) } });
  }

  @Delete(":id")
  @Permissions("ativos:deletar")
  async remove(@Param("id") id: string) {
    const existing = await this.db.categoriaAtivo.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Categoria nao encontrada");
    await this.db.ativo.updateMany({ where: { categoriaId: id }, data: { categoriaId: null } });
    await this.db.categoriaAtivo.delete({ where: { id } });
    return { message: "Categoria removida" };
  }
}

// ── Monitoring Controller ─────────────────────────────────────────────────────
@Controller("ativos/monitoramento")
class MonitoramentoController {
  private readonly logger = new Logger(MonitoramentoController.name);
  constructor(private prisma: PrismaService, private automacao: AutomacaoService) {}
  private get db() { return this.prisma as any; }

  private executarAutomacao(trigger: string, ctx: Record<string, any>) {
    this.automacao.executar(trigger, ctx).catch(() => {});
  }

  private async resolveOrg(key: string): Promise<string | null> {
    if (!key) return null;
    const org = await this.db.organization.findFirst({ where: { monitoringKey: key }, select: { id: true } });
    return org?.id || null;
  }

  // GET /ativos/monitoramento — dashboard (JWT auth)
  @Get()
  @UseGuards(AuthGuard("jwt"), PermissionsGuard)
  @Permissions("ativos:ver")
  async getDashboard(@Req() req: any) {
    const orgId = req.user?.organizationId;
    const where: any = orgId ? { organizationId: orgId } : {};

    const [todos, monitorados, onlineCount, offlineCount, semIp] = await Promise.all([
      this.db.ativo.count({ where }),
      this.db.ativo.count({ where: { ...where, monitorar: true } }),
      this.db.ativo.count({ where: { ...where, monitorar: true, online: true } }),
      this.db.ativo.count({ where: { ...where, monitorar: true, online: false } }),
      this.db.ativo.count({ where: { ...where, monitorar: true, ip: null } }),
    ]);

    const ativos = await this.db.ativo.findMany({
      where: { ...where, monitorar: true },
      select: {
        id: true, codigo: true, nome: true, ip: true, online: true,
        ultimoPing: true, latenciaMs: true, status: true,
        categoria: { select: { nome: true, cor: true, icone: true } },
        setor:     { select: { nome: true } },
      },
      orderBy: [{ online: "asc" }, { nome: "asc" }],
    });

    const since24h  = new Date(Date.now() - 24 * 3600 * 1000);
    const ativoIds  = ativos.map((a: any) => a.id);
    const logs24h   = ativoIds.length ? await this.db.pingLog.groupBy({
      by: ["ativoId", "online"],
      where: { ativoId: { in: ativoIds }, criadoEm: { gte: since24h } },
      _count: true,
    }) : [];

    const uptimeMap: Record<string, number | null> = {};
    for (const id of ativoIds) {
      const rows = (logs24h as any[]).filter((r: any) => r.ativoId === id);
      if (!rows.length) { uptimeMap[id] = null; continue; }
      const total       = rows.reduce((s: number, r: any) => s + r._count, 0);
      const onlineRows  = rows.find((r: any) => r.online === true)?._count || 0;
      uptimeMap[id]     = Math.round((onlineRows / total) * 100);
    }

    const org = orgId ? await this.db.organization.findUnique({ where: { id: orgId }, select: { monitoringKey: true } }) : null;

    return {
      stats: { todos, monitorados, online: onlineCount, offline: offlineCount, semIp },
      ativos: ativos.map((a: any) => ({ ...a, uptime24h: uptimeMap[a.id] ?? null })),
      temChave: !!org?.monitoringKey,
    };
  }

  // GET /ativos/monitoramento/historico/:id — ping history (JWT auth)
  @Get("historico/:id")
  @UseGuards(AuthGuard("jwt"), PermissionsGuard)
  @Permissions("ativos:ver")
  async getHistorico(@Param("id") id: string, @Query("limit") limit?: string) {
    const take = Math.min(Number(limit) || 48, 200);
    return this.db.pingLog.findMany({
      where: { ativoId: id },
      orderBy: { criadoEm: "desc" },
      take,
      select: { id: true, online: true, latenciaMs: true, erro: true, criadoEm: true },
    });
  }

  // POST /ativos/monitoramento/gerar-chave — generate key (JWT auth)
  @Post("gerar-chave")
  @UseGuards(AuthGuard("jwt"), PermissionsGuard)
  @Permissions("ativos:editar")
  async gerarChave(@Req() req: any) {
    const orgId = req.user?.organizationId;
    if (!orgId) throw new BadRequestException("Organizacao nao encontrada");
    const key = `mkey_${crypto.randomUUID().replace(/-/g, "")}`;
    await this.db.organization.update({ where: { id: orgId }, data: { monitoringKey: key } as any });
    return { key };
  }

  // GET /ativos/monitoramento/agent/assets — agent fetches assets (key auth, no JWT)
  @Get("agent/assets")
  async getAgentAssets(@Headers("x-monitoring-key") key: string) {
    const orgId = await this.resolveOrg(key);
    if (!orgId) throw new UnauthorizedException("Chave de monitoramento invalida");
    const ativos = await this.db.ativo.findMany({
      where: { organizationId: orgId, monitorar: true, ip: { not: null } },
      select: { id: true, nome: true, codigo: true, ip: true },
    });
    return { organizationId: orgId, ativos };
  }

  // POST /ativos/monitoramento/agent/report — agent pushes results (key auth, no JWT)
  @Post("agent/report")
  async receiveReport(
    @Headers("x-monitoring-key") key: string,
    @Body() body: { resultados: { ativoId: string; online: boolean; latenciaMs?: number; erro?: string }[] },
  ) {
    const orgId = await this.resolveOrg(key);
    if (!orgId) throw new UnauthorizedException("Chave de monitoramento invalida");
    if (!Array.isArray(body.resultados) || !body.resultados.length) return { ok: true, processados: 0 };

    const now = new Date();
    let processados = 0;
    for (const r of body.resultados) {
      if (!r.ativoId) continue;
      try {
        // Busca estado anterior para detectar mudança online/offline
        const anterior = await this.db.ativo.findUnique({ where: { id: r.ativoId }, select: { online: true, nome: true, ip: true } });
        await this.db.ativo.update({
          where: { id: r.ativoId },
          data: { online: r.online, ultimoPing: now, latenciaMs: r.latenciaMs ?? null },
        });
        await this.db.pingLog.create({
          data: { id: crypto.randomUUID(), ativoId: r.ativoId, organizationId: orgId, online: r.online, latenciaMs: r.latenciaMs ?? null, erro: r.erro ?? null },
        });
        // Dispara automação quando muda de estado (online ↔ offline)
        if (anterior && anterior.online !== r.online) {
          const ctx = { id: r.ativoId, nome: anterior.nome, ip: anterior.ip, online: r.online, latenciaMs: r.latenciaMs, organizationId: orgId };
          const trigger = r.online ? "ativo_online" : "ativo_offline";
          this.db.automacao && this.executarAutomacao(trigger, ctx);
        }
        processados++;
      } catch (err: any) {
        this.logger.warn(`Falha ping ativo ${r.ativoId}: ${err.message}`);
      }
    }

    // Limpa logs com mais de 7 dias
    this.db.pingLog.deleteMany({ where: { organizationId: orgId, criadoEm: { lt: new Date(Date.now() - 7 * 86400000) } } }).catch(() => {});

    return { ok: true, processados };
  }
}

// ── Assets Controller ─────────────────────────────────────────────────────────
@Controller("ativos")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class AtivosController {
  constructor(private prisma: PrismaService) {}
  private get db() { return this.prisma as any; }

  @Get("stats")
  @Permissions("ativos:ver")
  async getStats(@Req() req: any) {
    const orgId = req.user?.organizationId;
    const orgWhere = orgId ? { organizationId: orgId } as any : {};
    const [total, porStatus, porCategoria, garantiaVencendo] = await Promise.all([
      this.db.ativo.count({ where: orgWhere }),
      this.db.ativo.groupBy({ by: ["status"], _count: true, where: orgWhere }),
      this.db.ativo.groupBy({ by: ["categoriaId"], _count: true, where: orgWhere, orderBy: { _count: { categoriaId: "desc" } }, take: 8 }),
      this.db.ativo.findMany({
        where: { dataGarantiaFim: { gte: new Date(), lte: new Date(Date.now() + 30 * 86400000) }, ...orgWhere },
        select: { id: true, codigo: true, nome: true, dataGarantiaFim: true },
        orderBy: { dataGarantiaFim: "asc" }, take: 10,
      }),
    ]);
    const catIds = porCategoria.map((c: any) => c.categoriaId).filter(Boolean);
    const cats   = catIds.length ? await this.db.categoriaAtivo.findMany({ where: { id: { in: catIds } }, select: { id: true, nome: true, cor: true } }) : [];
    return {
      total,
      porStatus: Object.fromEntries((porStatus as any[]).map(s => [s.status, s._count])),
      porCategoria: (porCategoria as any[]).map(c => ({ categoriaId: c.categoriaId, count: c._count, ...cats.find((cat: any) => cat.id === c.categoriaId) })),
      garantiaVencendo,
    };
  }

  @Get()
  @Permissions("ativos:ver")
  async findAll(
    @Query("q") q?: string, @Query("status") status?: string,
    @Query("categoriaId") categoriaId?: string, @Query("responsavelId") responsavelId?: string,
    @Query("setorId") setorId?: string, @Query("page") page?: string,
    @Query("limit") limit?: string, @Req() req?: any,
  ) {
    const take = Math.min(Number(limit) || 30, 200);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
    const orgId = req.user?.organizationId;
    const where: any = { ...(orgId ? { organizationId: orgId } as any : {}) };
    if (status)        where.status        = status;
    if (categoriaId)   where.categoriaId   = categoriaId;
    if (responsavelId) where.responsavelId = responsavelId;
    if (setorId)       where.setorId       = setorId;
    if (q) {
      where.OR = [
        { nome:        { contains: q, mode: "insensitive" } },
        { codigo:      { contains: q, mode: "insensitive" } },
        { marca:       { contains: q, mode: "insensitive" } },
        { modelo:      { contains: q, mode: "insensitive" } },
        { numeroSerie: { contains: q, mode: "insensitive" } },
        { localizacao: { contains: q, mode: "insensitive" } },
        { ip:          { contains: q, mode: "insensitive" } },
      ];
    }
    const [items, total] = await Promise.all([
      this.db.ativo.findMany({ where, include: ATIVO_INCLUDE, orderBy: { criadoEm: "desc" }, take, skip }),
      this.db.ativo.count({ where }),
    ]);
    return { items: items.map(mapAtivo), total, page: Math.max(Number(page) || 1, 1), limit: take };
  }

  @Get(":id")
  @Permissions("ativos:ver")
  async findOne(@Param("id") id: string) {
    const ativo = await this.db.ativo.findUnique({
      where: { id },
      include: {
        ...ATIVO_INCLUDE,
        transferencias: {
          orderBy: { criadoEm: "desc" }, take: 20,
          include: {
            deResponsavel:   { select: { id: true, nome: true, avatar: true } },
            paraResponsavel: { select: { id: true, nome: true, avatar: true } },
            realizadoPor:    { select: { id: true, nome: true, avatar: true } },
          },
        },
      },
    });
    if (!ativo) throw new NotFoundException("Ativo nao encontrado");
    return mapAtivo(ativo);
  }

  @Post()
  @Permissions("ativos:criar")
  async create(@Body() body: {
    nome: string; codigo?: string; descricao?: string; categoriaId?: string;
    status?: string; marca?: string; modelo?: string; numeroSerie?: string;
    localizacao?: string; responsavelId?: string; setorId?: string;
    dataAquisicao?: string; valorAquisicao?: number; dataGarantiaFim?: string;
    observacoes?: string; ip?: string; monitorar?: boolean;
  }, @Req() req: any) {
    if (!body.nome?.trim()) throw new BadRequestException("Nome obrigatorio");
    const orgId = req.user?.organizationId;

    let codigo = body.codigo?.trim();
    if (!codigo) {
      const count = await this.db.ativo.count();
      codigo = `AT-${String(count + 1).padStart(5, "0")}`;
      let exists = await this.db.ativo.findFirst({ where: { codigo } });
      let n = count + 2;
      while (exists) { codigo = `AT-${String(n++).padStart(5, "0")}`; exists = await this.db.ativo.findFirst({ where: { codigo } }); }
    } else {
      const dup = await this.db.ativo.findFirst({ where: { codigo } });
      if (dup) throw new BadRequestException("Codigo ja utilizado");
    }

    return mapAtivo(await this.db.ativo.create({
      data: {
        id: crypto.randomUUID(), codigo, nome: body.nome.trim(),
        descricao: body.descricao || null, categoriaId: body.categoriaId || null,
        status: STATUS_VALID.includes(body.status || "") ? body.status! : "ativo",
        marca: body.marca || null, modelo: body.modelo || null,
        numeroSerie: body.numeroSerie || null, localizacao: body.localizacao || null,
        responsavelId: body.responsavelId || null, setorId: body.setorId || null,
        dataAquisicao: body.dataAquisicao ? new Date(body.dataAquisicao) : null,
        valorAquisicao: body.valorAquisicao ?? null,
        dataGarantiaFim: body.dataGarantiaFim ? new Date(body.dataGarantiaFim) : null,
        observacoes: body.observacoes || null,
        ip: body.ip?.trim() || null, monitorar: body.monitorar === true,
        ...(orgId ? { organizationId: orgId } : {}),
      } as any,
      include: ATIVO_INCLUDE,
    }));
  }

  @Put(":id")
  @Permissions("ativos:editar")
  async update(@Param("id") id: string, @Body() body: any) {
    const existing = await this.db.ativo.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Ativo nao encontrado");
    if (body.status && !STATUS_VALID.includes(body.status)) throw new BadRequestException("Status invalido");
    return mapAtivo(await this.db.ativo.update({
      where: { id },
      data: {
        ...(body.nome        && { nome:        body.nome.trim() }),
        ...(body.descricao   !== undefined && { descricao:   body.descricao || null }),
        ...(body.categoriaId !== undefined && { categoriaId: body.categoriaId || null }),
        ...(body.status      && { status:      body.status }),
        ...(body.marca       !== undefined && { marca:       body.marca || null }),
        ...(body.modelo      !== undefined && { modelo:      body.modelo || null }),
        ...(body.numeroSerie !== undefined && { numeroSerie: body.numeroSerie || null }),
        ...(body.localizacao !== undefined && { localizacao: body.localizacao || null }),
        ...(body.responsavelId !== undefined && { responsavelId: body.responsavelId || null }),
        ...(body.setorId     !== undefined && { setorId:     body.setorId || null }),
        ...(body.dataAquisicao  && { dataAquisicao:  new Date(body.dataAquisicao) }),
        ...(body.valorAquisicao !== undefined && { valorAquisicao: body.valorAquisicao ?? null }),
        ...(body.dataGarantiaFim && { dataGarantiaFim: new Date(body.dataGarantiaFim) }),
        ...(body.observacoes !== undefined && { observacoes: body.observacoes || null }),
        ...(body.ip          !== undefined && { ip:          body.ip?.trim() || null }),
        ...(body.monitorar   !== undefined && { monitorar:   Boolean(body.monitorar) }),
      },
      include: ATIVO_INCLUDE,
    }));
  }

  @Patch(":id/transferir")
  @Permissions("ativos:transferir")
  async transferir(@Param("id") id: string, @Body() body: { responsavelId?: string; setorId?: string; motivo?: string }, @Req() req: any) {
    const ativo = await this.db.ativo.findUnique({ where: { id } });
    if (!ativo) throw new NotFoundException("Ativo nao encontrado");
    if (!body.responsavelId && !body.setorId) throw new BadRequestException("Informe responsavel ou setor de destino");
    await this.db.transferenciaAtivo.create({
      data: { id: crypto.randomUUID(), ativoId: id, deResponsavelId: ativo.responsavelId || null, paraResponsavelId: body.responsavelId || null, deSetorId: ativo.setorId || null, paraSetorId: body.setorId || null, motivo: body.motivo || null, realizadoPorId: req.user.id },
    });
    return mapAtivo(await this.db.ativo.update({
      where: { id },
      data: { ...(body.responsavelId !== undefined && { responsavelId: body.responsavelId || null }), ...(body.setorId !== undefined && { setorId: body.setorId || null }) },
      include: ATIVO_INCLUDE,
    }));
  }

  @Delete(":id")
  @Permissions("ativos:deletar")
  async remove(@Param("id") id: string) {
    const existing = await this.db.ativo.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Ativo nao encontrado");
    await this.db.ativo.delete({ where: { id } });
    return { message: "Ativo removido" };
  }
}

// ── Module ────────────────────────────────────────────────────────────────────
@Module({
  imports:     [AutomacoesModule],
  controllers: [CategoriasAtivoController, MonitoramentoController, AtivosController],
  providers:   [PrismaService, AutomacaoService],
})
export class AtivosModule {}
