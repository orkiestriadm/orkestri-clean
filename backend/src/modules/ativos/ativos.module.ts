import {
  Module, Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, UseGuards, Req,
  NotFoundException, BadRequestException, ForbiddenException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../../prisma/prisma.service";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";

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
  return {
    ...a,
    garantiaOk,
    garantiaRisco,
    garantiaVencida: a.dataGarantiaFim ? !garantiaOk : false,
  };
}

// ── Categories Controller ─────────────────────────────────────────────────────
@Controller("ativos/categorias")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class CategoriasAtivoController {
  constructor(private prisma: PrismaService) {}
  private get db() { return this.prisma as any; }

  @Get()
  @Permissions("ativos:ver")
  async findAll() {
    const cats = await this.db.categoriaAtivo.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      include: { _count: { select: { ativos: true } } },
    });
    return cats.map((c: any) => ({ ...c, totalAtivos: c._count.ativos }));
  }

  @Post()
  @Permissions("ativos:criar")
  async create(@Body() body: { nome: string; descricao?: string; icone?: string; cor?: string }) {
    if (!body.nome?.trim()) throw new BadRequestException("Nome obrigatorio");
    try {
      return await this.db.categoriaAtivo.create({
        data: { id: require("crypto").randomUUID(), nome: body.nome.trim(), descricao: body.descricao || null, icone: body.icone || "monitor", cor: body.cor || "#7c3aed" },
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

// ── Assets Controller ─────────────────────────────────────────────────────────
@Controller("ativos")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class AtivosController {
  constructor(private prisma: PrismaService) {}
  private get db() { return this.prisma as any; }

  // GET /ativos/stats — dashboard metrics
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
        orderBy: { dataGarantiaFim: "asc" },
        take: 10,
      }),
    ]);

    const catIds = porCategoria.map((c: any) => c.categoriaId).filter(Boolean);
    const cats = catIds.length
      ? await this.db.categoriaAtivo.findMany({ where: { id: { in: catIds } }, select: { id: true, nome: true, cor: true } })
      : [];

    return {
      total,
      porStatus: Object.fromEntries((porStatus as any[]).map(s => [s.status, s._count])),
      porCategoria: (porCategoria as any[]).map(c => ({
        categoriaId: c.categoriaId,
        count: c._count,
        ...cats.find((cat: any) => cat.id === c.categoriaId),
      })),
      garantiaVencendo,
    };
  }

  // GET /ativos — list with filters
  @Get()
  @Permissions("ativos:ver")
  async findAll(
    @Query("q")           q?: string,
    @Query("status")      status?: string,
    @Query("categoriaId") categoriaId?: string,
    @Query("responsavelId") responsavelId?: string,
    @Query("setorId")     setorId?: string,
    @Query("page")        page?: string,
    @Query("limit")       limit?: string,
    @Req() req?: any,
  ) {
    const take = Math.min(Number(limit) || 30, 200);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const orgId = req.user?.organizationId;
    const where: any = { ...(orgId ? { organizationId: orgId } as any : {}) };
    if (status)       where.status       = status;
    if (categoriaId)  where.categoriaId  = categoriaId;
    if (responsavelId) where.responsavelId = responsavelId;
    if (setorId)      where.setorId      = setorId;
    if (q) {
      where.OR = [
        { nome:        { contains: q, mode: "insensitive" } },
        { codigo:      { contains: q, mode: "insensitive" } },
        { marca:       { contains: q, mode: "insensitive" } },
        { modelo:      { contains: q, mode: "insensitive" } },
        { numeroSerie: { contains: q, mode: "insensitive" } },
        { localizacao: { contains: q, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      this.db.ativo.findMany({ where, include: ATIVO_INCLUDE, orderBy: { criadoEm: "desc" }, take, skip }),
      this.db.ativo.count({ where }),
    ]);

    return { items: items.map(mapAtivo), total, page: Math.max(Number(page) || 1, 1), limit: take };
  }

  // GET /ativos/:id — detail with transfer history
  @Get(":id")
  @Permissions("ativos:ver")
  async findOne(@Param("id") id: string) {
    const ativo = await this.db.ativo.findUnique({
      where: { id },
      include: {
        ...ATIVO_INCLUDE,
        transferencias: {
          orderBy: { criadoEm: "desc" },
          take: 20,
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

  // POST /ativos — create
  @Post()
  @Permissions("ativos:criar")
  async create(@Body() body: {
    nome: string; codigo?: string; descricao?: string; categoriaId?: string;
    status?: string; marca?: string; modelo?: string; numeroSerie?: string;
    localizacao?: string; responsavelId?: string; setorId?: string;
    dataAquisicao?: string; valorAquisicao?: number; dataGarantiaFim?: string; observacoes?: string;
  }, @Req() req: any) {
    if (!body.nome?.trim()) throw new BadRequestException("Nome obrigatorio");
    const orgId = req.user?.organizationId;

    // Auto-generate code if not provided
    let codigo = body.codigo?.trim();
    if (!codigo) {
      const count = await this.db.ativo.count();
      codigo = `AT-${String(count + 1).padStart(5, "0")}`;
      // ensure uniqueness
      let exists = await this.db.ativo.findFirst({ where: { codigo } });
      let n = count + 2;
      while (exists) { codigo = `AT-${String(n++).padStart(5, "0")}`; exists = await this.db.ativo.findFirst({ where: { codigo } }); }
    } else {
      const dup = await this.db.ativo.findFirst({ where: { codigo } });
      if (dup) throw new BadRequestException("Codigo ja utilizado");
    }

    return mapAtivo(await this.db.ativo.create({
      data: {
        id: require("crypto").randomUUID(),
        codigo,
        nome:           body.nome.trim(),
        descricao:      body.descricao || null,
        categoriaId:    body.categoriaId || null,
        status:         STATUS_VALID.includes(body.status || "") ? body.status! : "ativo",
        marca:          body.marca || null,
        modelo:         body.modelo || null,
        numeroSerie:    body.numeroSerie || null,
        localizacao:    body.localizacao || null,
        responsavelId:  body.responsavelId || null,
        setorId:        body.setorId || null,
        dataAquisicao:  body.dataAquisicao ? new Date(body.dataAquisicao) : null,
        valorAquisicao: body.valorAquisicao ?? null,
        dataGarantiaFim: body.dataGarantiaFim ? new Date(body.dataGarantiaFim) : null,
        observacoes:    body.observacoes || null,
        ...(orgId ? { organizationId: orgId } : {}),
      } as any,
      include: ATIVO_INCLUDE,
    }));
  }

  // PUT /ativos/:id — update
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
        ...(body.status      && { status: body.status }),
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
      },
      include: ATIVO_INCLUDE,
    }));
  }

  // PATCH /ativos/:id/transferir — transfer asset to new responsible/setor
  @Patch(":id/transferir")
  @Permissions("ativos:transferir")
  async transferir(@Param("id") id: string, @Body() body: { responsavelId?: string; setorId?: string; motivo?: string }, @Req() req: any) {
    const ativo = await this.db.ativo.findUnique({ where: { id } });
    if (!ativo) throw new NotFoundException("Ativo nao encontrado");
    if (!body.responsavelId && !body.setorId) throw new BadRequestException("Informe responsavel ou setor de destino");

    // Record transfer
    await this.db.transferenciaAtivo.create({
      data: {
        id:               require("crypto").randomUUID(),
        ativoId:          id,
        deResponsavelId:  ativo.responsavelId || null,
        paraResponsavelId: body.responsavelId || null,
        deSetorId:        ativo.setorId || null,
        paraSetorId:      body.setorId || null,
        motivo:           body.motivo || null,
        realizadoPorId:   req.user.id,
      },
    });

    return mapAtivo(await this.db.ativo.update({
      where: { id },
      data: {
        ...(body.responsavelId !== undefined && { responsavelId: body.responsavelId || null }),
        ...(body.setorId       !== undefined && { setorId:       body.setorId || null }),
      },
      include: ATIVO_INCLUDE,
    }));
  }

  // DELETE /ativos/:id
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
  controllers: [CategoriasAtivoController, AtivosController],
  providers:   [PrismaService],
})
export class AtivosModule {}
