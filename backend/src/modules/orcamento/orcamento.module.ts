import {
  Module, Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, UseGuards, Req,
  NotFoundException, BadRequestException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import {
  IsString, IsOptional, IsNumber, IsBoolean, IsIn, Min, Max,
} from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";

// ── DTOs ──────────────────────────────────────────────────────────────────────

class CreateCicloDto {
  @IsNumber() ano: number;
  @IsOptional() @IsString() descricao?: string;
}

class CreateCentroCustoDto {
  @IsString() codigo: string;
  @IsString() nome: string;
  @IsOptional() @IsString() descricao?: string;
  @IsOptional() @IsString() cor?: string;
  @IsOptional() @IsString() responsavelId?: string;
}
class UpdateCentroCustoDto {
  @IsOptional() @IsString() codigo?: string;
  @IsOptional() @IsString() nome?: string;
  @IsOptional() @IsString() descricao?: string;
  @IsOptional() @IsString() cor?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
  @IsOptional() @IsString() responsavelId?: string;
}

class CreateCategoriaDto {
  @IsString() @IsIn(["CAPEX","OPEX"]) tipo: string;
  @IsString() codigo: string;
  @IsString() nome: string;
  @IsOptional() @IsString() cor?: string;
  @IsOptional() @IsString() icone?: string;
  @IsOptional() @IsString() paiId?: string;
}
class UpdateCategoriaDto {
  @IsOptional() @IsString() nome?: string;
  @IsOptional() @IsString() cor?: string;
  @IsOptional() @IsString() icone?: string;
}

class CreateFornecedorDto {
  @IsString() nome: string;
  @IsOptional() @IsString() cnpj?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() telefone?: string;
  @IsOptional() @IsString() segmento?: string;
}
class UpdateFornecedorDto {
  @IsOptional() @IsString() nome?: string;
  @IsOptional() @IsString() cnpj?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() telefone?: string;
  @IsOptional() @IsString() segmento?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

class CreateItemDto {
  @IsString() cicloId: string;
  @IsString() @IsIn(["OPEX","CAPEX"]) tipo: string;
  @IsOptional() @IsString() centroCustoId?: string;
  @IsString() categoriaId: string;
  @IsString() nome: string;
  @IsOptional() @IsString() descricao?: string;
  @IsOptional() @IsString() fornecedorId?: string;
  @IsOptional() @IsBoolean() recorrente?: boolean;
  @IsOptional() @IsString() periodicidade?: string;
  @IsOptional() @IsString() observacoes?: string;
  @IsOptional() valoresMensais?: Record<number, number>; // { 1: 1000, 2: 1000, ... }
}
class UpdateItemDto {
  @IsOptional() @IsString() nome?: string;
  @IsOptional() @IsString() descricao?: string;
  @IsOptional() @IsString() centroCustoId?: string;
  @IsOptional() @IsString() fornecedorId?: string;
  @IsOptional() @IsBoolean() recorrente?: boolean;
  @IsOptional() @IsString() periodicidade?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() observacoes?: string;
}

class LancarValorDto {
  @IsNumber() @Min(1) @Max(12) mes: number;
  @IsNumber() @Min(0) valorRealizado: number;
  @IsOptional() @IsString() observacoes?: string;
}
class UpdatePrevistoDto {
  @IsNumber() @Min(1) @Max(12) mes: number;
  @IsNumber() @Min(0) valorPrevisto: number;
}

class ResolverAprovacaoDto {
  @IsString() @IsIn(["aprovado","rejeitado"]) decisao: string;
  @IsOptional() @IsString() observacoes?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MESES = [1,2,3,4,5,6,7,8,9,10,11,12];

function uuid() { return require("crypto").randomUUID(); }

function fmtMes(m: number) {
  return ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][m-1];
}

function calcExecucao(previsto: number, realizado: number) {
  if (!previsto) return realizado > 0 ? 999 : 0;
  return Math.round((realizado / previsto) * 100);
}

async function addOrcTimeline(
  prisma: PrismaService,
  itemId: string, tipo: string, titulo: string,
  descricao?: string, userId?: string,
) {
  try {
    await (prisma as any).orcamentoTimeline.create({
      data: { id: uuid(), itemId, tipo, titulo, descricao: descricao || null, userId: userId || null },
    });
  } catch {}
}

function mapItem(item: any) {
  const previsto  = item.meses?.reduce((s: number, m: any) => s + (m.valorPrevisto  || 0), 0) ?? 0;
  const realizado = item.meses?.reduce((s: number, m: any) => s + (m.valorRealizado || 0), 0) ?? 0;
  return {
    id: item.id,
    cicloId: item.cicloId,
    tipo: item.tipo,
    nome: item.nome,
    descricao: item.descricao,
    recorrente: item.recorrente,
    periodicidade: item.periodicidade,
    status: item.status,
    observacoes: item.observacoes,
    categoria: item.categoria ? { id: item.categoria.id, nome: item.categoria.nome, cor: item.categoria.cor, tipo: item.categoria.tipo, paiId: item.categoria.paiId } : null,
    centroCusto: item.centroCusto ? { id: item.centroCusto.id, codigo: item.centroCusto.codigo, nome: item.centroCusto.nome, cor: item.centroCusto.cor } : null,
    fornecedor: item.fornecedor ? { id: item.fornecedor.id, nome: item.fornecedor.nome } : null,
    criadoPor: item.criadoPor ? { id: item.criadoPor.id, nome: item.criadoPor.nome } : null,
    criadoEm: item.criadoEm,
    meses: item.meses?.map((m: any) => ({
      id: m.id, mes: m.mes, mesLabel: fmtMes(m.mes),
      valorPrevisto: m.valorPrevisto, valorRealizado: m.valorRealizado,
      status: m.status, observacoes: m.observacoes,
      lancadoEm: m.lancadoEm,
      lancadoPor: m.lancadoPor ? { id: m.lancadoPor.id, nome: m.lancadoPor.nome } : null,
    })) ?? [],
    totais: { previsto, realizado, execucao: calcExecucao(previsto, realizado) },
  };
}

// ── Controller ────────────────────────────────────────────────────────────────

@Controller("orcamento")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class OrcamentoController {
  constructor(private prisma: PrismaService) {}

  // ── Dashboard ──────────────────────────────────────────────────────────────

  @Get("dashboard")
  @Permissions("orcamento:ver")
  async dashboard(@Req() req: any, @Query("ano") anoQ?: string, @Query("cicloId") cicloId?: string) {
    const orgId = req.user?.organizationId;
    const orgWhere = orgId ? { organizationId: orgId } as any : {};
    let ciclo: any;
    if (cicloId) {
      ciclo = await (this.prisma as any).orcamentoCiclo.findFirst({ where: { id: cicloId, ...orgWhere } });
    } else {
      const ano = anoQ ? parseInt(anoQ) : new Date().getFullYear();
      ciclo = await (this.prisma as any).orcamentoCiclo.findFirst({ where: { ano, ...orgWhere } });
    }
    if (!ciclo) return { ciclo: null, kpis: null, evolucaoMensal: [], topItens: [], alertas: [], distribuicao: [] };

    const itens = await (this.prisma as any).itemOrcamento.findMany({
      where: { cicloId: ciclo.id, status: { not: "cancelado" } },
      include: { meses: true, categoria: true, centroCusto: true },
    });

    // KPIs globais
    let totalPrevistoOpex = 0, totalRealizadoOpex = 0;
    let totalPrevistoCap  = 0, totalRealizadoCap  = 0;
    const mesAtual = new Date().getMonth() + 1;

    for (const item of itens) {
      const prev = item.meses.reduce((s: number, m: any) => s + (m.valorPrevisto || 0), 0);
      const real = item.meses.reduce((s: number, m: any) => s + (m.valorRealizado || 0), 0);
      if (item.tipo === "OPEX") { totalPrevistoOpex += prev; totalRealizadoOpex += real; }
      else                      { totalPrevistoCap  += prev; totalRealizadoCap  += real; }
    }

    // Evolução mensal (Jan–Dez)
    const evolucaoMensal = MESES.map(mes => {
      const prevMes  = itens.reduce((s: number, i: any) => s + (i.meses.find((m: any) => m.mes === mes)?.valorPrevisto  || 0), 0);
      const realMes  = itens.reduce((s: number, i: any) => s + (i.meses.find((m: any) => m.mes === mes)?.valorRealizado || 0), 0);
      return { mes, label: fmtMes(mes), previsto: prevMes, realizado: realMes };
    });

    // Top 5 por realizado
    const topItens = itens
      .map((i: any) => ({
        id: i.id, nome: i.nome, tipo: i.tipo,
        categoria: i.categoria?.nome,
        realizado: i.meses.reduce((s: number, m: any) => s + (m.valorRealizado || 0), 0),
        previsto:  i.meses.reduce((s: number, m: any) => s + (m.valorPrevisto  || 0), 0),
      }))
      .sort((a: any, b: any) => b.realizado - a.realizado)
      .slice(0, 5);

    // Alertas de estouro (mês atual)
    const alertas: any[] = [];
    for (const item of itens) {
      const mesObj = item.meses.find((m: any) => m.mes === mesAtual);
      if (!mesObj) continue;
      const exec = calcExecucao(mesObj.valorPrevisto, mesObj.valorRealizado || 0);
      if (exec >= 90) alertas.push({
        itemId: item.id, nome: item.nome, tipo: item.tipo,
        mes: mesAtual, previsto: mesObj.valorPrevisto,
        realizado: mesObj.valorRealizado || 0, execucao: exec,
      });
    }

    // Distribuição por categoria (OPEX)
    const distOpex: Record<string, number> = {};
    const distCapex: Record<string, number> = {};
    for (const item of itens) {
      const real = item.meses.reduce((s: number, m: any) => s + (m.valorRealizado || 0), 0);
      const catNome = item.categoria?.nome || "Outros";
      if (item.tipo === "OPEX") distOpex[catNome] = (distOpex[catNome] || 0) + real;
      else                      distCapex[catNome] = (distCapex[catNome] || 0) + real;
    }

    const totalPrevisto  = totalPrevistoOpex + totalPrevistoCap;
    const totalRealizado = totalRealizadoOpex + totalRealizadoCap;
    const estouros = alertas.filter(a => a.execucao > 100).length;

    // Distribuição unificada por categoria
    const distAll = { ...distOpex };
    for (const [k, v] of Object.entries(distCapex)) distAll[k] = (distAll[k] || 0) + v;
    const distTotal = Object.values(distAll).reduce((s, v) => s + v, 0) || 1;
    const distribuicao = Object.entries(distAll).map(([categoria, previsto]) => ({
      categoria, cor: "#a78bfa", previsto,
      percentual: Math.round((previsto / distTotal) * 100),
    })).sort((a, b) => b.previsto - a.previsto).slice(0, 8);

    // Normaliza topItens com campo execucao
    const topItensNorm = topItens.map((i: any) => ({
      ...i, execucao: calcExecucao(i.previsto, i.realizado),
    }));

    // Normaliza alertas para formato { tipo, mensagem, itemId? }
    const alertasNorm = alertas.sort((a: any, b: any) => b.execucao - a.execucao).slice(0, 8).map((a: any) => ({
      tipo: a.execucao > 100 ? "estouro" : "alerta",
      mensagem: `${a.nome}: ${a.execucao}% executado no mês ${fmtMes(a.mes)} (Prev: R$${a.previsto.toFixed(0)} / Real: R$${a.realizado.toFixed(0)})`,
      itemId: a.itemId,
    }));

    return {
      ciclo: { id: ciclo.id, ano: ciclo.ano, status: ciclo.status },
      kpis: {
        totalPrevisto, totalRealizado,
        execucao: calcExecucao(totalPrevisto, totalRealizado),
        estouros,
        alertas: alertasNorm.length,
        pendentesAprovacao: 0,
      },
      evolucaoMensal,
      topItens: topItensNorm,
      alertas: alertasNorm,
      distribuicao,
    };
  }

  // ── Ciclos ─────────────────────────────────────────────────────────────────

  @Get("ciclos")
  @Permissions("orcamento:ver")
  async listCiclos(@Req() req: any) {
    const orgId = req.user?.organizationId;
    const ciclos = await (this.prisma as any).orcamentoCiclo.findMany({ where: orgId ? { organizationId: orgId } as any : {}, orderBy: { ano: "desc" } });
    return ciclos.map((c: any) => ({ ...c, _count: undefined }));
  }

  @Post("ciclos")
  @Permissions("orcamento:admin")
  async createCiclo(@Body() dto: CreateCicloDto, @Req() req: any) {
    const orgId = req.user?.organizationId;
    const orgWhere = orgId ? { organizationId: orgId } as any : {};
    const exists = await (this.prisma as any).orcamentoCiclo.findFirst({ where: { ano: dto.ano, ...orgWhere } });
    if (exists) throw new BadRequestException(`Ciclo ${dto.ano} já existe`);
    return (this.prisma as any).orcamentoCiclo.create({
      data: { id: uuid(), ano: dto.ano, descricao: dto.descricao || null, ...(orgId ? { organizationId: orgId } : {}) } as any,
    });
  }

  @Patch("ciclos/:id/ativar")
  @Permissions("orcamento:admin")
  async ativarCiclo(@Param("id") id: string, @Req() req: any) {
    const orgId = req.user?.organizationId;
    const ciclo = await (this.prisma as any).orcamentoCiclo.findFirst({
      where: { id, ...(orgId ? { organizationId: orgId } : {}) },
    });
    if (!ciclo) throw new NotFoundException("Ciclo não encontrado");
    // Desativa apenas ciclos da mesma organização
    await (this.prisma as any).orcamentoCiclo.updateMany({
      where: { status: "ativo", ...(orgId ? { organizationId: orgId } : {}) },
      data: { status: "rascunho" },
    });
    return (this.prisma as any).orcamentoCiclo.update({ where: { id }, data: { status: "ativo" } });
  }

  @Patch("ciclos/:id/fechar")
  @Permissions("orcamento:admin")
  async fecharCiclo(@Param("id") id: string) {
    const ciclo = await (this.prisma as any).orcamentoCiclo.findUnique({ where: { id } });
    if (!ciclo) throw new NotFoundException("Ciclo não encontrado");
    return (this.prisma as any).orcamentoCiclo.update({ where: { id }, data: { status: "fechado" } });
  }

  // ── Categorias ─────────────────────────────────────────────────────────────

  @Get("categorias")
  @Permissions("orcamento:ver")
  async listCategorias(@Req() req: any, @Query("tipo") tipo?: string) {
    const orgId = req.user?.organizationId;
    const where: any = tipo ? { tipo, paiId: null } : { paiId: null };
    if (orgId) where.organizationId = orgId;
    const raizes = await (this.prisma as any).categoriaOrcamento.findMany({
      where,
      include: { filhas: { orderBy: { nome: "asc" } } },
      orderBy: { nome: "asc" },
    });
    return raizes;
  }

  @Post("categorias")
  @Permissions("orcamento:admin")
  async createCategoria(@Body() dto: CreateCategoriaDto) {
    return (this.prisma as any).categoriaOrcamento.create({
      data: {
        id: uuid(), tipo: dto.tipo, codigo: dto.codigo, nome: dto.nome,
        cor: dto.cor || "#a78bfa", icone: dto.icone || null, paiId: dto.paiId || null,
      },
    });
  }

  @Put("categorias/:id")
  @Permissions("orcamento:admin")
  async updateCategoria(@Param("id") id: string, @Body() dto: UpdateCategoriaDto) {
    return (this.prisma as any).categoriaOrcamento.update({ where: { id }, data: dto });
  }

  @Delete("categorias/:id")
  @Permissions("orcamento:admin")
  async deleteCategoria(@Param("id") id: string) {
    const itens = await (this.prisma as any).itemOrcamento.count({ where: { categoriaId: id } });
    if (itens > 0) throw new BadRequestException("Categoria possui itens vinculados");
    await (this.prisma as any).categoriaOrcamento.delete({ where: { id } });
    return { message: "Removida" };
  }

  // ── Centros de Custo ───────────────────────────────────────────────────────

  @Get("centros-custo")
  @Permissions("orcamento:ver")
  async listCentros(@Req() req: any) {
    const orgId = req.user?.organizationId;
    return (this.prisma as any).centroCusto.findMany({
      where: orgId ? { organizationId: orgId } as any : {},
      include: { responsavel: { select: { id: true, nome: true } } },
      orderBy: { codigo: "asc" },
    });
  }

  @Post("centros-custo")
  @Permissions("orcamento:admin")
  async createCentro(@Body() dto: CreateCentroCustoDto, @Req() req: any) {
    const orgId = req.user?.organizationId;
    const exists = await (this.prisma as any).centroCusto.findFirst({ where: { codigo: dto.codigo, ...(orgId ? { organizationId: orgId } as any : {}) } });
    if (exists) throw new BadRequestException(`Código ${dto.codigo} já existe`);
    const { responsavelId, ...rest } = dto;
    return (this.prisma as any).centroCusto.create({
      data: { id: uuid(), ...rest, responsavelId: responsavelId || null, ...(orgId ? { organizationId: orgId } : {}) } as any,
      include: { responsavel: { select: { id: true, nome: true } } },
    });
  }

  @Put("centros-custo/:id")
  @Permissions("orcamento:admin")
  async updateCentro(@Param("id") id: string, @Body() dto: UpdateCentroCustoDto) {
    const { responsavelId, ...rest } = dto;
    return (this.prisma as any).centroCusto.update({
      where: { id },
      data: { ...rest, ...(responsavelId !== undefined ? { responsavelId } : {}) },
      include: { responsavel: { select: { id: true, nome: true } } },
    });
  }

  // ── Fornecedores ───────────────────────────────────────────────────────────

  @Get("fornecedores")
  @Permissions("orcamento:ver")
  async listFornecedores(@Req() req: any, @Query("q") q?: string) {
    const orgId = req.user?.organizationId;
    const where: any = { status: "ativo", ...(orgId ? { organizationId: orgId } as any : {}) };
    if (q) {
      where.OR = [
        { razaoSocial: { contains: q, mode: "insensitive" } },
        { nomeFantasia: { contains: q, mode: "insensitive" } },
        { cnpj: { contains: q.replace(/\D/g,"") } },
      ];
    }
    const suppliers = await (this.prisma as any).supplier.findMany({
      where,
      select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true, categorias: true,
        contatoNome: true, contatoEmail: true, contatoTelefone: true, cidade: true, estado: true, condicaoPagamento: true },
      orderBy: { razaoSocial: "asc" },
      take: 50,
    });
    return suppliers.map((s: any) => ({
      id: s.id, nome: s.nomeFantasia || s.razaoSocial, razaoSocial: s.razaoSocial,
      nomeFantasia: s.nomeFantasia, cnpj: s.cnpj, segmento: s.categorias?.[0] || null,
      email: s.contatoEmail, telefone: s.contatoTelefone, cidade: s.cidade, estado: s.estado,
      condicaoPagamento: s.condicaoPagamento, ativo: true,
    }));
  }

  @Post("fornecedores")
  @Permissions("orcamento:admin")
  async createFornecedor(@Body() dto: CreateFornecedorDto) {
    return (this.prisma as any).fornecedorOrcamento.create({ data: { id: uuid(), ...dto } });
  }

  @Put("fornecedores/:id")
  @Permissions("orcamento:admin")
  async updateFornecedor(@Param("id") id: string, @Body() dto: UpdateFornecedorDto) {
    return (this.prisma as any).fornecedorOrcamento.update({ where: { id }, data: dto });
  }

  // ── Itens ──────────────────────────────────────────────────────────────────

  @Get("itens")
  @Permissions("orcamento:ver")
  async listItens(
    @Req() req: any,
    @Query("cicloId") cicloId?: string,
    @Query("tipo") tipo?: string,
    @Query("centroCustoId") centroCustoId?: string,
    @Query("categoriaId") categoriaId?: string,
    @Query("ano") anoQ?: string,
  ) {
    const orgId = req.user?.organizationId;
    const orgWhere = orgId ? { organizationId: orgId } as any : {};
    let resolvedCicloId = cicloId;
    if (!resolvedCicloId && anoQ) {
      const ciclo = await (this.prisma as any).orcamentoCiclo.findFirst({ where: { ano: parseInt(anoQ), ...orgWhere } });
      resolvedCicloId = ciclo?.id;
    }
    if (!resolvedCicloId) {
      const cicloAtivo = await (this.prisma as any).orcamentoCiclo.findFirst({ where: { status: "ativo", ...orgWhere }, orderBy: { ano: "desc" } });
      resolvedCicloId = cicloAtivo?.id;
    }
    if (!resolvedCicloId) return [];

    const itens = await (this.prisma as any).itemOrcamento.findMany({
      where: {
        cicloId: resolvedCicloId,
        ...(tipo ? { tipo } : {}),
        ...(centroCustoId ? { centroCustoId } : {}),
        ...(categoriaId ? { OR: [{ categoriaId }, { categoria: { paiId: categoriaId } }] } : {}),
        status: { not: "cancelado" },
      },
      include: {
        meses: { orderBy: { mes: "asc" } },
        categoria: true,
        centroCusto: true,
        fornecedor: true,
        criadoPor: { select: { id: true, nome: true } },
      },
      orderBy: [{ categoria: { nome: "asc" } }, { nome: "asc" }],
    });

    return itens.map((i: any) => mapItem(i));
  }

  @Get("itens/:id")
  @Permissions("orcamento:ver")
  async getItem(@Param("id") id: string) {
    const item = await (this.prisma as any).itemOrcamento.findUnique({
      where: { id },
      include: {
        meses: { orderBy: { mes: "asc" }, include: { lancadoPor: { select: { id: true, nome: true } } } },
        categoria: true, centroCusto: true, fornecedor: true,
        criadoPor: { select: { id: true, nome: true } },
        timeline: { orderBy: { criadoEm: "desc" }, include: { user: { select: { id: true, nome: true } } }, take: 20 },
        aprovacoes: { orderBy: { criadoEm: "desc" }, take: 5 },
      },
    });
    if (!item) throw new NotFoundException("Item não encontrado");
    return { ...mapItem(item), timeline: item.timeline, aprovacoes: item.aprovacoes };
  }

  @Post("itens")
  @Permissions("orcamento:planejar")
  async createItem(@Body() dto: CreateItemDto, @Req() req: any) {
    if (!dto.nome?.trim()) throw new BadRequestException("Nome obrigatório");
    const ciclo = await (this.prisma as any).orcamentoCiclo.findUnique({ where: { id: dto.cicloId } });
    if (!ciclo) throw new NotFoundException("Ciclo não encontrado");
    const categoria = await (this.prisma as any).categoriaOrcamento.findUnique({ where: { id: dto.categoriaId } });
    if (!categoria) throw new NotFoundException("Categoria não encontrada");

    const { valoresMensais, centroCustoId, fornecedorId, ...rest } = dto;

    const orgId2 = req.user?.organizationId;
    const item = await (this.prisma as any).itemOrcamento.create({
      data: {
        id: uuid(),
        ...rest,
        tipo: categoria.tipo,
        centroCustoId: centroCustoId || null,
        fornecedorId: fornecedorId || null,
        criadoPorId: req.user.id,
        ...(orgId2 ? { organizationId: orgId2 } : {}),
        meses: {
          create: MESES.map(mes => ({
            id: uuid(), mes,
            valorPrevisto: valoresMensais?.[mes] ?? 0,
          })),
        },
      },
      include: { meses: true, categoria: true, centroCusto: true, fornecedor: true, criadoPor: { select: { id: true, nome: true } } },
    });

    await addOrcTimeline(this.prisma, item.id, "criado", `Item "${item.nome}" criado`, undefined, req.user.id);
    return mapItem(item);
  }

  @Put("itens/:id")
  @Permissions("orcamento:planejar")
  async updateItem(@Param("id") id: string, @Body() dto: UpdateItemDto, @Req() req: any) {
    const exists = await (this.prisma as any).itemOrcamento.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException("Item não encontrado");
    const { centroCustoId, fornecedorId, ...rest } = dto;
    const updated = await (this.prisma as any).itemOrcamento.update({
      where: { id },
      data: {
        ...rest,
        ...(centroCustoId !== undefined ? { centroCustoId } : {}),
        ...(fornecedorId  !== undefined ? { fornecedorId  } : {}),
      },
      include: { meses: true, categoria: true, centroCusto: true, fornecedor: true, criadoPor: { select: { id: true, nome: true } } },
    });
    await addOrcTimeline(this.prisma, id, "editado", "Item atualizado", undefined, req.user.id);
    return mapItem(updated);
  }

  @Patch("itens/:id/previsto")
  @Permissions("orcamento:planejar")
  async updatePrevisto(@Param("id") id: string, @Body() dto: UpdatePrevistoDto, @Req() req: any) {
    const mes = await (this.prisma as any).itemOrcamentoMes.findFirst({ where: { itemId: id, mes: dto.mes } });
    if (!mes) throw new NotFoundException("Mês não encontrado");
    const updated = await (this.prisma as any).itemOrcamentoMes.update({
      where: { id: mes.id },
      data: { valorPrevisto: dto.valorPrevisto },
    });
    await addOrcTimeline(this.prisma, id, "editado", `Previsto de ${fmtMes(dto.mes)} atualizado para R$ ${dto.valorPrevisto.toLocaleString("pt-BR")}`, undefined, req.user.id);
    return updated;
  }

  @Patch("itens/:id/lancar")
  @Permissions("orcamento:lancar")
  async lancarRealizado(@Param("id") id: string, @Body() dto: LancarValorDto, @Req() req: any) {
    const mes = await (this.prisma as any).itemOrcamentoMes.findFirst({ where: { itemId: id, mes: dto.mes } });
    if (!mes) throw new NotFoundException("Mês não encontrado");

    const updated = await (this.prisma as any).itemOrcamentoMes.update({
      where: { id: mes.id },
      data: {
        valorRealizado: dto.valorRealizado,
        status: "lancado",
        observacoes: dto.observacoes || null,
        lancadoPorId: req.user.id,
        lancadoEm: new Date(),
      },
    });

    // Verifica estouro e cria aprovação se necessário
    if (mes.valorPrevisto > 0) {
      const exec = calcExecucao(mes.valorPrevisto, dto.valorRealizado);
      if (exec > 100) {
        await (this.prisma as any).aprovacaoOrcamento.create({
          data: {
            id: uuid(), itemId: id, tipo: "lancamento",
            status: "pendente", solicitadoPorId: req.user.id,
            observacoes: `Estouro de ${exec - 100}% em ${fmtMes(dto.mes)} — previsto R$${mes.valorPrevisto.toLocaleString("pt-BR")}, lançado R$${dto.valorRealizado.toLocaleString("pt-BR")}`,
          },
        });
      }
    }

    await addOrcTimeline(this.prisma, id, "lancamento", `Realizado de ${fmtMes(dto.mes)}: R$ ${dto.valorRealizado.toLocaleString("pt-BR")}`, dto.observacoes, req.user.id);
    return updated;
  }

  @Get("itens/:id/timeline")
  @Permissions("orcamento:ver")
  async getTimeline(@Param("id") id: string) {
    return (this.prisma as any).orcamentoTimeline.findMany({
      where: { itemId: id },
      include: { user: { select: { id: true, nome: true } } },
      orderBy: { criadoEm: "desc" },
      take: 30,
    });
  }

  // ── Aprovações ─────────────────────────────────────────────────────────────

  @Get("aprovacoes")
  @Permissions("orcamento:aprovar")
  async listAprovacoes(@Req() req: any, @Query("status") status = "pendente") {
    const orgId = req.user?.organizationId;
    return (this.prisma as any).aprovacaoOrcamento.findMany({
      where: { status, ...(orgId ? { organizationId: orgId } as any : {}) },
      include: {
        item: { select: { id: true, nome: true, tipo: true, categoria: { select: { nome: true } } } },
        solicitadoPor: { select: { id: true, nome: true } },
        aprovadoPor: { select: { id: true, nome: true } },
      },
      orderBy: { criadoEm: "desc" },
    });
  }

  @Patch("aprovacoes/:id")
  @Permissions("orcamento:aprovar")
  async resolverAprovacao(@Param("id") id: string, @Body() dto: ResolverAprovacaoDto, @Req() req: any) {
    const aprov = await (this.prisma as any).aprovacaoOrcamento.findUnique({ where: { id } });
    if (!aprov) throw new NotFoundException("Aprovação não encontrada");
    if (aprov.status !== "pendente") throw new BadRequestException("Aprovação já resolvida");

    const updated = await (this.prisma as any).aprovacaoOrcamento.update({
      where: { id },
      data: {
        status: dto.decisao,
        aprovadoPorId: req.user.id,
        observacoes: dto.observacoes || aprov.observacoes,
        resolvidoEm: new Date(),
      },
    });

    if (aprov.itemId) {
      await addOrcTimeline(
        this.prisma, aprov.itemId,
        dto.decisao === "aprovado" ? "aprovado" : "rejeitado",
        `Lançamento ${dto.decisao} por ${req.user.nome || "gestor"}`,
        dto.observacoes, req.user.id,
      );
    }
    return updated;
  }

  // ── Relatório previsto × realizado ────────────────────────────────────────

  @Get("relatorios/previsto-realizado")
  @Permissions("orcamento:ver")
  async relatorioPrevReal(@Req() req: any, @Query("ano") anoQ?: string, @Query("tipo") tipo?: string) {
    const ano = anoQ ? parseInt(anoQ) : new Date().getFullYear();
    const orgId = req.user?.organizationId;
    const ciclo = await (this.prisma as any).orcamentoCiclo.findFirst({ where: { ano, ...(orgId ? { organizationId: orgId } as any : {}) } });
    if (!ciclo) return { ciclo: null, itens: [] };

    const itens = await (this.prisma as any).itemOrcamento.findMany({
      where: { cicloId: ciclo.id, ...(tipo ? { tipo } : {}), status: { not: "cancelado" } },
      include: {
        meses: { orderBy: { mes: "asc" } },
        categoria: { include: { pai: true } },
        centroCusto: true,
        fornecedor: true,
      },
      orderBy: [{ categoria: { nome: "asc" } }, { nome: "asc" }],
    });

    return { ciclo: { id: ciclo.id, ano: ciclo.ano, status: ciclo.status }, itens: itens.map((i: any) => mapItem(i)) };
  }
}

// ── Module ────────────────────────────────────────────────────────────────────

@Module({
  controllers: [OrcamentoController],
  providers: [PrismaService],
})
export class OrcamentoModule {}
