import {
  Module, Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, Req,
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../../prisma/prisma.service";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";

const STATUS_VALID = ["vigente", "vencendo", "vencido", "suspenso", "rescindido"];
const TIPOS_VALID  = ["servico", "manutencao", "suporte", "licenca", "consultoria", "outro"];

function computeStatus(vigenciaFim: Date | null, statusManual: string): string {
  if (statusManual === "suspenso" || statusManual === "rescindido") return statusManual;
  if (!vigenciaFim) return statusManual || "vigente";
  const now  = new Date();
  const diff = (vigenciaFim.getTime() - now.getTime()) / (1000 * 60 * 60 * 24); // days
  if (diff < 0)   return "vencido";
  if (diff <= 30) return "vencendo";
  return "vigente";
}

function mapContrato(c: any) {
  return {
    ...c,
    statusComputado: computeStatus(c.vigenciaFim, c.status),
  };
}

async function nextNumero(db: any): Promise<number> {
  const last = await db.contrato.findFirst({ orderBy: { numero: "desc" }, select: { numero: true } });
  return (last?.numero || 0) + 1;
}

// ── ContratosController ───────────────────────────────────────────────────────
@Controller("contratos")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class ContratosController {
  constructor(private prisma: PrismaService) {}
  private get db() { return this.prisma as any; }

  // GET /contratos/stats
  @Get("stats")
  @Permissions("crm:ver")
  async stats(@Req() req: any) {
    const orgId = req.user?.organizationId;
    const all = await this.db.contrato.findMany({ where: orgId ? { organizationId: orgId } as any : {}, select: { status: true, vigenciaFim: true, valor: true, ativo: true } });
    const ativos = all.filter((c: any) => c.ativo);
    const stats = { total: ativos.length, vigentes: 0, vencendo: 0, vencidos: 0, suspensos: 0, rescindidos: 0, valorTotal: 0 };
    for (const c of ativos) {
      const s = computeStatus(c.vigenciaFim, c.status);
      if (s === "vigente")    stats.vigentes++;
      if (s === "vencendo")   stats.vencendo++;
      if (s === "vencido")    stats.vencidos++;
      if (s === "suspenso")   stats.suspensos++;
      if (s === "rescindido") stats.rescindidos++;
      if (c.valor) stats.valorTotal += c.valor;
    }
    return stats;
  }

  // GET /contratos?clienteId=X&status=Y&tipo=Z
  @Get()
  @Permissions("crm:ver")
  async findAll(
    @Req() req: any,
    @Query("clienteId") clienteId?: string,
    @Query("status")    status?: string,
    @Query("tipo")      tipo?: string,
    @Query("search")    search?: string,
    @Query("ativo")     ativo?: string,
  ) {
    const orgId = req.user?.organizationId;
    const where: any = { ...(orgId ? { organizationId: orgId } as any : {}) };
    if (clienteId) where.clienteId = clienteId;
    if (tipo)      where.tipo      = tipo;
    if (ativo === "true")  where.ativo = true;
    if (ativo === "false") where.ativo = false;
    if (search) where.OR = [
      { titulo:     { contains: search, mode: "insensitive" } },
      { plano:      { contains: search, mode: "insensitive" } },
      { observacoes:{ contains: search, mode: "insensitive" } },
    ];

    const contratos = await this.db.contrato.findMany({
      where,
      orderBy: [{ vigenciaFim: "asc" }, { criadoEm: "desc" }],
      include: {
        cliente:     { select: { id: true, nome: true, empresa: true } },
        responsavel: { select: { id: true, nome: true } },
      },
    });

    let result = contratos.map(mapContrato);
    if (status) result = result.filter((c: any) => c.statusComputado === status);
    return result;
  }

  // GET /contratos/timeline — todos contratos com datas, para visualização cronológica
  @Get("timeline")
  @Permissions("crm:ver")
  async timeline(@Req() req: any) {
    const orgId = req.user?.organizationId;
    const rows = await this.db.contrato.findMany({
      where: { ativo: true, ...(orgId ? { organizationId: orgId } as any : {}) },
      select: { id: true, numero: true, titulo: true, valor: true, tipo: true, status: true,
        vigenciaInicio: true, vigenciaFim: true,
        cliente: { select: { id: true, nome: true, empresa: true } },
      },
      orderBy: { vigenciaFim: "asc" },
      take: 200,
    });
    return rows.map(mapContrato);
  }

  // GET /contratos/:id
  @Get(":id")
  @Permissions("crm:ver")
  async findOne(@Param("id") id: string) {
    const c = await this.db.contrato.findUnique({
      where: { id },
      include: {
        cliente:     { select: { id: true, nome: true, empresa: true, email: true, telefone: true } },
        responsavel: { select: { id: true, nome: true } },
      },
    });
    if (!c) throw new NotFoundException("Contrato nao encontrado");
    return mapContrato(c);
  }

  // POST /contratos
  @Post()
  @Permissions("crm:ver")
  async create(@Body() body: any, @Req() req: any) {
    if (!body.clienteId) throw new BadRequestException("clienteId obrigatorio");
    if (!body.titulo?.trim()) throw new BadRequestException("titulo obrigatorio");

    const cliente = await this.db.cliente.findUnique({ where: { id: body.clienteId } });
    if (!cliente) throw new NotFoundException("Cliente nao encontrado");

    const numero = await nextNumero(this.db);

    const orgId = req.user?.organizationId;
    const contrato = await this.db.contrato.create({
      data: {
        id:             require("crypto").randomUUID(),
        numero,
        titulo:         body.titulo.trim(),
        clienteId:      body.clienteId,
        tipo:           TIPOS_VALID.includes(body.tipo) ? body.tipo : "servico",
        plano:          body.plano || null,
        status:         STATUS_VALID.includes(body.status) ? body.status : "vigente",
        slaHoras:       body.slaHoras ? Number(body.slaHoras) : null,
        vigenciaInicio: body.vigenciaInicio ? new Date(body.vigenciaInicio) : null,
        vigenciaFim:    body.vigenciaFim    ? new Date(body.vigenciaFim)    : null,
        valor:          body.valor ? Number(body.valor) : null,
        responsavelId:  body.responsavelId || null,
        ativo:          true,
        observacoes:    body.observacoes || null,
        ...(orgId ? { organizationId: orgId } : {}),
      },
      include: {
        cliente:     { select: { id: true, nome: true, empresa: true } },
        responsavel: { select: { id: true, nome: true } },
      },
    });
    return mapContrato(contrato);
  }

  // PUT /contratos/:id
  @Put(":id")
  @Permissions("crm:ver")
  async update(@Param("id") id: string, @Body() body: any) {
    const existing = await this.db.contrato.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Contrato nao encontrado");

    const data: any = {};
    if (body.titulo       !== undefined) data.titulo         = body.titulo.trim();
    if (body.tipo         !== undefined) data.tipo           = TIPOS_VALID.includes(body.tipo) ? body.tipo : existing.tipo;
    if (body.plano        !== undefined) data.plano          = body.plano;
    if (body.status       !== undefined) data.status         = STATUS_VALID.includes(body.status) ? body.status : existing.status;
    if (body.slaHoras     !== undefined) data.slaHoras       = body.slaHoras ? Number(body.slaHoras) : null;
    if (body.vigenciaInicio !== undefined) data.vigenciaInicio = body.vigenciaInicio ? new Date(body.vigenciaInicio) : null;
    if (body.vigenciaFim  !== undefined) data.vigenciaFim    = body.vigenciaFim ? new Date(body.vigenciaFim) : null;
    if (body.valor        !== undefined) data.valor          = body.valor ? Number(body.valor) : null;
    if (body.responsavelId !== undefined) data.responsavelId = body.responsavelId || null;
    if (body.ativo        !== undefined) data.ativo          = Boolean(body.ativo);
    if (body.observacoes  !== undefined) data.observacoes    = body.observacoes;

    const updated = await this.db.contrato.update({
      where: { id },
      data,
      include: {
        cliente:     { select: { id: true, nome: true, empresa: true } },
        responsavel: { select: { id: true, nome: true } },
      },
    });
    return mapContrato(updated);
  }

  // POST /contratos/:id/renovar — cria nova vigência baseada no contrato existente
  @Post(":id/renovar")
  @Permissions("crm:ver")
  async renovar(
    @Param("id") id: string,
    @Body() body: { vigenciaInicio: string; vigenciaFim: string; valor?: number; titulo?: string },
  ) {
    if (!body.vigenciaInicio || !body.vigenciaFim) throw new BadRequestException("Datas de vigência obrigatórias");
    const existing = await this.db.contrato.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Contrato não encontrado");

    const numero = await nextNumero(this.db);
    const novo = await this.db.contrato.create({
      data: {
        id:             require("crypto").randomUUID(),
        numero,
        titulo:         body.titulo?.trim() || (existing.titulo + " (Renovação)"),
        clienteId:      existing.clienteId,
        tipo:           existing.tipo,
        plano:          existing.plano,
        status:         "vigente",
        slaHoras:       existing.slaHoras,
        vigenciaInicio: new Date(body.vigenciaInicio),
        vigenciaFim:    new Date(body.vigenciaFim),
        valor:          body.valor !== undefined ? Number(body.valor) : existing.valor,
        responsavelId:  existing.responsavelId,
        ativo:          true,
        observacoes:    existing.observacoes,
      },
      include: {
        cliente:     { select: { id: true, nome: true, empresa: true } },
        responsavel: { select: { id: true, nome: true } },
      },
    });
    return mapContrato(novo);
  }

  // DELETE /contratos/:id
  @Delete(":id")
  @Permissions("crm:ver")
  async remove(@Param("id") id: string, @Req() req: any) {
    if (!req.user.isMaster) throw new ForbiddenException("Apenas masters podem remover contratos");
    const existing = await this.db.contrato.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Contrato nao encontrado");
    await this.db.contrato.delete({ where: { id } });
    return { message: "Contrato removido" };
  }
}

// ── Module ────────────────────────────────────────────────────────────────────
@Module({
  controllers: [ContratosController],
  providers:   [PrismaService],
})
export class ContratosModule {}
