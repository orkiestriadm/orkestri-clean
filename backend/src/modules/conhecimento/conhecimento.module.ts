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
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim().replace(/\s+/g, "-").replace(/-+/g, "-")
    .slice(0, 100);
}

async function uniqueSlug(db: any, base: string, excludeId?: string): Promise<string> {
  let slug = base; let n = 0;
  while (true) {
    const existing = await db.artigoConhecimento.findFirst({
      where: { slug, ...(excludeId && { id: { not: excludeId } }) },
    });
    if (!existing) return slug;
    n++;
    slug = `${base}-${n}`;
  }
}

const ARTIGO_SELECT_LIST = {
  id: true, titulo: true, slug: true, resumo: true, status: true,
  tags: true, visualizacoes: true, publicadoEm: true, criadoEm: true, atualizadoEm: true,
  categoriaId: true,
  categoria: { select: { id: true, nome: true, cor: true, icone: true } },
  autor: { select: { id: true, nome: true, avatar: true } },
};

// ── Categories Controller ─────────────────────────────────────────────────────
@Controller("conhecimento/categorias")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class CategoriasController {
  constructor(private prisma: PrismaService) {}
  private get db() { return this.prisma as any; }

  @Get()
  @Permissions("conhecimento:ver")
  async findAll(@Req() req: any) {
    const orgId = req.user?.organizationId;
    const cats = await this.db.categoriaConhecimento.findMany({
      where: { ativo: true, ...(orgId ? { organizationId: orgId } as any : {}) },
      orderBy: { ordem: "asc" },
      include: { _count: { select: { artigos: true } } },
    });
    return cats.map((c: any) => ({ ...c, totalArtigos: c._count.artigos }));
  }

  @Post()
  @Permissions("conhecimento:criar")
  async create(@Body() body: { nome: string; descricao?: string; icone?: string; cor?: string; ordem?: number }, @Req() req: any) {
    if (!body.nome?.trim()) throw new BadRequestException("Nome obrigatorio");
    const orgId = req.user?.organizationId;
    try {
      return await this.db.categoriaConhecimento.create({
        data: {
          id:       require("crypto").randomUUID(),
          nome:     body.nome.trim(),
          descricao: body.descricao || null,
          icone:    body.icone || "book",
          cor:      body.cor || "#7c3aed",
          ordem:    body.ordem ?? 0,
          ...(orgId ? { organizationId: orgId } : {}),
        } as any,
      });
    } catch (e: any) {
      if (e.code === "P2002") throw new BadRequestException("Categoria ja existe");
      throw e;
    }
  }

  @Put(":id")
  @Permissions("conhecimento:editar")
  async update(@Param("id") id: string, @Body() body: any) {
    const existing = await this.db.categoriaConhecimento.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Categoria nao encontrada");
    return this.db.categoriaConhecimento.update({
      where: { id },
      data: {
        ...(body.nome      && { nome: body.nome.trim() }),
        ...(body.descricao !== undefined && { descricao: body.descricao }),
        ...(body.icone     && { icone: body.icone }),
        ...(body.cor       && { cor: body.cor }),
        ...(body.ordem     !== undefined && { ordem: Number(body.ordem) }),
        ...(body.ativo     !== undefined && { ativo: Boolean(body.ativo) }),
      },
    });
  }

  @Delete(":id")
  @Permissions("conhecimento:deletar")
  async remove(@Param("id") id: string) {
    const existing = await this.db.categoriaConhecimento.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Categoria nao encontrada");
    // Disassociate articles before deleting
    await this.db.artigoConhecimento.updateMany({ where: { categoriaId: id }, data: { categoriaId: null } });
    await this.db.categoriaConhecimento.delete({ where: { id } });
    return { message: "Categoria removida" };
  }
}

// ── Articles Controller ───────────────────────────────────────────────────────
@Controller("conhecimento")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class ConhecimentoController {
  constructor(private prisma: PrismaService) {}
  private get db() { return this.prisma as any; }

  // GET /conhecimento/tags — distinct tags across published articles
  @Get("tags")
  @Permissions("conhecimento:ver")
  async getTags(@Req() req: any) {
    const orgId = req.user?.organizationId;
    const artigos = await this.db.artigoConhecimento.findMany({
      where: { status: "publicado", ...(orgId ? { organizationId: orgId } as any : {}) },
      select: { tags: true },
    });
    const set = new Set<string>();
    for (const a of artigos) for (const t of (a.tags || [])) set.add(t);
    return Array.from(set).sort();
  }

  // GET /conhecimento — published articles (with search/filter)
  @Get()
  @Permissions("conhecimento:ver")
  async findPublished(
    @Query("q")           q?: string,
    @Query("categoriaId") categoriaId?: string,
    @Query("tag")         tag?: string,
    @Query("page")        page?: string,
    @Query("limit")       limit?: string,
    @Req() req?: any,
  ) {
    const take = Math.min(Number(limit) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const orgId = req.user?.organizationId;
    const where: any = { status: "publicado", ...(orgId ? { organizationId: orgId } as any : {}) };
    if (categoriaId) where.categoriaId = categoriaId;
    if (tag) where.tags = { has: tag };
    if (q) {
      where.OR = [
        { titulo:   { contains: q, mode: "insensitive" } },
        { resumo:   { contains: q, mode: "insensitive" } },
        { conteudo: { contains: q, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      this.db.artigoConhecimento.findMany({ where, select: ARTIGO_SELECT_LIST, orderBy: { publicadoEm: "desc" }, take, skip }),
      this.db.artigoConhecimento.count({ where }),
    ]);
    return { items, total, page: Math.max(Number(page) || 1, 1), limit: take };
  }

  // GET /conhecimento/todos — all articles including drafts (editors only)
  @Get("todos")
  @Permissions("conhecimento:editar")
  async findAll(
    @Query("q")           q?: string,
    @Query("status")      status?: string,
    @Query("categoriaId") categoriaId?: string,
    @Query("page")        page?: string,
    @Query("limit")       limit?: string,
    @Req()                req?: any,
  ) {
    const take = Math.min(Number(limit) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const orgId = req.user?.organizationId;
    const where: any = { ...(orgId ? { organizationId: orgId } as any : {}) };
    // Non-masters only see their own drafts
    if (!req.user.isMaster && !req.user.permissions?.includes("*")) {
      where.OR = [{ status: "publicado" }, { autorId: req.user.id }];
    }
    if (status) where.status = status;
    if (categoriaId) where.categoriaId = categoriaId;
    if (q) where.OR = [
      ...(where.OR || []),
      { titulo:   { contains: q, mode: "insensitive" } },
      { resumo:   { contains: q, mode: "insensitive" } },
    ];

    const [items, total] = await Promise.all([
      this.db.artigoConhecimento.findMany({ where, select: ARTIGO_SELECT_LIST, orderBy: { criadoEm: "desc" }, take, skip }),
      this.db.artigoConhecimento.count({ where }),
    ]);
    return { items, total, page: Math.max(Number(page) || 1, 1), limit: take };
  }

  // GET /conhecimento/:id — article detail (increments view count)
  @Get(":id")
  @Permissions("conhecimento:ver")
  async findOne(@Param("id") id: string, @Req() req: any) {
    const artigo = await this.db.artigoConhecimento.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      include: {
        categoria: { select: { id: true, nome: true, cor: true, icone: true } },
        autor:     { select: { id: true, nome: true, avatar: true } },
      },
    });
    if (!artigo) throw new NotFoundException("Artigo nao encontrado");

    const canSeeDraft = req.user.isMaster ||
      req.user.permissions?.includes("*") ||
      req.user.permissions?.includes("conhecimento:editar") ||
      artigo.autorId === req.user.id;
    if (artigo.status !== "publicado" && !canSeeDraft) throw new ForbiddenException("Artigo nao publicado");

    // Increment view count async
    this.db.artigoConhecimento.update({ where: { id: artigo.id }, data: { visualizacoes: { increment: 1 } } }).catch(() => {});

    return artigo;
  }

  // POST /conhecimento — create article
  @Post()
  @Permissions("conhecimento:criar")
  async create(@Body() body: { titulo: string; resumo?: string; conteudo?: string; categoriaId?: string; tags?: string[]; status?: string }, @Req() req: any) {
    if (!body.titulo?.trim()) throw new BadRequestException("Titulo obrigatorio");
    const baseSlug = slugify(body.titulo);
    const slug = await uniqueSlug(this.db, baseSlug);
    const status = body.status === "publicado" ? "publicado" : "rascunho";
    const orgId = req.user?.organizationId;
    return this.db.artigoConhecimento.create({
      data: {
        id:          require("crypto").randomUUID(),
        titulo:      body.titulo.trim(),
        slug,
        resumo:      body.resumo || null,
        conteudo:    body.conteudo || "",
        status,
        categoriaId: body.categoriaId || null,
        tags:        body.tags || [],
        autorId:     req.user.id,
        publicadoEm: status === "publicado" ? new Date() : null,
        ...(orgId ? { organizationId: orgId } : {}),
      } as any,
      include: {
        categoria: { select: { id: true, nome: true, cor: true, icone: true } },
        autor:     { select: { id: true, nome: true, avatar: true } },
      },
    });
  }

  // PUT /conhecimento/:id — update article
  @Put(":id")
  @Permissions("conhecimento:editar")
  async update(@Param("id") id: string, @Body() body: any, @Req() req: any) {
    const existing = await this.db.artigoConhecimento.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Artigo nao encontrado");

    const canEdit = req.user.isMaster || req.user.permissions?.includes("*") ||
      req.user.permissions?.includes("conhecimento:editar") || existing.autorId === req.user.id;
    if (!canEdit) throw new ForbiddenException("Sem permissao para editar este artigo");

    let slug = existing.slug;
    if (body.titulo && body.titulo.trim() !== existing.titulo) {
      slug = await uniqueSlug(this.db, slugify(body.titulo.trim()), id);
    }

    return this.db.artigoConhecimento.update({
      where: { id },
      data: {
        ...(body.titulo      && { titulo: body.titulo.trim(), slug }),
        ...(body.resumo      !== undefined && { resumo:      body.resumo || null }),
        ...(body.conteudo    !== undefined && { conteudo:    body.conteudo }),
        ...(body.categoriaId !== undefined && { categoriaId: body.categoriaId || null }),
        ...(body.tags        !== undefined && { tags:        body.tags }),
      },
      include: {
        categoria: { select: { id: true, nome: true, cor: true, icone: true } },
        autor:     { select: { id: true, nome: true, avatar: true } },
      },
    });
  }

  // PATCH /conhecimento/:id/publicar — publish or unpublish
  @Patch(":id/publicar")
  @Permissions("conhecimento:publicar")
  async publicar(@Param("id") id: string, @Body() body: { publicar: boolean }, @Req() req: any) {
    const existing = await this.db.artigoConhecimento.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Artigo nao encontrado");
    const status = body.publicar ? "publicado" : "rascunho";
    return this.db.artigoConhecimento.update({
      where: { id },
      data: {
        status,
        publicadoEm: body.publicar && !existing.publicadoEm ? new Date() : existing.publicadoEm,
      },
      select: ARTIGO_SELECT_LIST,
    });
  }

  // DELETE /conhecimento/:id
  @Delete(":id")
  @Permissions("conhecimento:deletar")
  async remove(@Param("id") id: string, @Req() req: any) {
    const existing = await this.db.artigoConhecimento.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Artigo nao encontrado");
    const canDelete = req.user.isMaster || req.user.permissions?.includes("*") ||
      req.user.permissions?.includes("conhecimento:deletar") || existing.autorId === req.user.id;
    if (!canDelete) throw new ForbiddenException("Sem permissao");
    await this.db.artigoConhecimento.delete({ where: { id } });
    return { message: "Artigo removido" };
  }
}

// ── Public Controller (no auth) ───────────────────────────────────────────────
@Controller("conhecimento/publico")
class PublicConhecimentoController {
  constructor(private prisma: PrismaService) {}
  private get db() { return this.prisma as any; }

  @Get("categorias")
  async categorias() {
    const cats = await this.db.categoriaConhecimento.findMany({
      where: { ativo: true },
      orderBy: { ordem: "asc" },
      include: { _count: { select: { artigos: { where: { status: "publicado" } } } } },
    });
    return cats.map((c: any) => ({ ...c, totalArtigos: c._count.artigos }));
  }

  @Get("artigos")
  async artigos(@Query("search") search?: string, @Query("categoriaId") categoriaId?: string) {
    const where: any = { status: "publicado" };
    if (categoriaId) where.categoriaId = categoriaId;
    if (search) where.OR = [
      { titulo:  { contains: search, mode: "insensitive" } },
      { resumo:  { contains: search, mode: "insensitive" } },
      { conteudo:{ contains: search, mode: "insensitive" } },
    ];
    return this.db.artigoConhecimento.findMany({
      where,
      orderBy: [{ visualizacoes: "desc" }, { publicadoEm: "desc" }],
      take: 50,
      select: { ...ARTIGO_SELECT_LIST },
    });
  }

  @Get("artigos/:slug")
  async artigoBySlug(@Param("slug") slug: string) {
    const artigo = await this.db.artigoConhecimento.findFirst({
      where: { slug, status: "publicado" },
      include: {
        categoria: { select: { id: true, nome: true, cor: true, icone: true } },
        autor:     { select: { id: true, nome: true } },
      },
    });
    if (!artigo) throw new NotFoundException("Artigo nao encontrado");
    this.db.artigoConhecimento.update({ where: { id: artigo.id }, data: { visualizacoes: { increment: 1 } } }).catch(() => {});
    return artigo;
  }
}

// ── Module ────────────────────────────────────────────────────────────────────
@Module({
  controllers: [CategoriasController, ConhecimentoController, PublicConhecimentoController],
})
export class ConhecimentoModule {}
