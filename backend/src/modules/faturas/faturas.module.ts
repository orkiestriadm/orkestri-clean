import {
  Module, Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, UseGuards, Req,
  NotFoundException, BadRequestException, ForbiddenException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../../prisma/prisma.service";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";

const STATUS_VALID = ["pendente", "pago", "vencido", "cancelado"];

function computeStatus(status: string, dataVencimento: Date | null): string {
  if (status === "pago" || status === "cancelado") return status;
  if (!dataVencimento) return status;
  return dataVencimento < new Date() ? "vencido" : "pendente";
}

function mapFatura(f: any) {
  return { ...f, statusComputado: computeStatus(f.status, f.dataVencimento) };
}

// ── FaturasController ─────────────────────────────────────────────────────────
@Controller("faturas")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class FaturasController {
  constructor(private prisma: PrismaService) {}
  private get db() { return this.prisma as any; }

  // GET /faturas/stats
  @Get("stats")
  @Permissions("crm:ver")
  async stats(@Req() req: any) {
    const orgId = req.user?.organizationId;
    const all = await this.db.fatura.findMany({
      where: orgId ? { organizationId: orgId } as any : {},
      select: { status: true, dataVencimento: true, valor: true },
    });
    const s = { total: all.length, pendentes: 0, pagas: 0, vencidas: 0, canceladas: 0, valorTotal: 0, valorPendente: 0, valorVencido: 0 };
    for (const f of all) {
      const st = computeStatus(f.status, f.dataVencimento);
      if (st === "pendente")  { s.pendentes++;  s.valorPendente += f.valor; }
      if (st === "pago")       s.pagas++;
      if (st === "vencido")   { s.vencidas++;   s.valorVencido  += f.valor; }
      if (st === "cancelado")  s.canceladas++;
      s.valorTotal += f.valor;
    }
    return s;
  }

  // GET /faturas/aging — inadimplência por bucket
  @Get("aging")
  @Permissions("crm:ver")
  async aging(@Req() req: any) {
    const now = new Date();
    const orgId = req.user?.organizationId;
    const faturas = await this.db.fatura.findMany({
      where: { status: { notIn: ["pago", "cancelado"] }, ...(orgId ? { organizationId: orgId } as any : {}) },
      select: { id: true, numero: true, valor: true, dataVencimento: true, status: true,
        cliente: { select: { id: true, nome: true, empresa: true } },
        contrato: { select: { id: true, titulo: true } },
      },
    });
    const buckets: Record<string, any[]> = { "em_dia": [], "1_30": [], "31_60": [], "61_90": [], "90_mais": [] };
    for (const f of faturas) {
      const dias = Math.floor((now.getTime() - new Date(f.dataVencimento).getTime()) / 86400000);
      const status = computeStatus(f.status, new Date(f.dataVencimento));
      if (status !== "vencido") { buckets.em_dia.push({ ...f, diasAtraso: 0, statusComputado: status }); continue; }
      if (dias <= 30)       buckets["1_30"].push({ ...f, diasAtraso: dias, statusComputado: "vencido" });
      else if (dias <= 60)  buckets["31_60"].push({ ...f, diasAtraso: dias, statusComputado: "vencido" });
      else if (dias <= 90)  buckets["61_90"].push({ ...f, diasAtraso: dias, statusComputado: "vencido" });
      else                  buckets["90_mais"].push({ ...f, diasAtraso: dias, statusComputado: "vencido" });
    }
    const total = (list: any[]) => list.reduce((s, f) => s + f.valor, 0);
    return [
      { bucket: "em_dia",  label: "Em dia",     count: buckets.em_dia.length,   valor: total(buckets.em_dia) },
      { bucket: "1_30",    label: "1–30 dias",  count: buckets["1_30"].length,  valor: total(buckets["1_30"]) },
      { bucket: "31_60",   label: "31–60 dias", count: buckets["31_60"].length, valor: total(buckets["31_60"]) },
      { bucket: "61_90",   label: "61–90 dias", count: buckets["61_90"].length, valor: total(buckets["61_90"]) },
      { bucket: "90_mais", label: "+90 dias",   count: buckets["90_mais"].length,valor: total(buckets["90_mais"]) },
    ];
  }

  // POST /faturas/gerar-lote — gera faturas mensais de contratos vigentes
  @Post("gerar-lote")
  @Permissions("crm:ver")
  async gerarLote(@Body() body: { mes?: number; ano?: number }, @Req() req: any) {
    const now2 = new Date();
    const mes = body.mes || (now2.getMonth() + 1);
    const ano = body.ano || now2.getFullYear();
    const inicio = new Date(ano, mes - 1, 1);
    const fim    = new Date(ano, mes, 0); // last day of month
    const venc   = new Date(ano, mes - 1, 20); // vencimento dia 20

    const orgId = req.user?.organizationId;
    const contratos = await this.db.contrato.findMany({
      where: {
        ativo: true,
        valor: { not: null, gt: 0 },
        OR: [
          { vigenciaFim: null },
          { vigenciaFim: { gte: inicio } },
        ],
        AND: [
          { OR: [{ vigenciaInicio: null }, { vigenciaInicio: { lte: fim } }] },
        ],
        ...(orgId ? { organizationId: orgId } as any : {}),
      },
      include: { cliente: { select: { id: true, nome: true } } },
    });

    const criadas: any[] = [];
    const ignoradas: any[] = [];
    const mesLabel = `${String(mes).padStart(2,"0")}/${ano}`;

    for (const c of contratos) {
      const jaExiste = await this.db.fatura.findFirst({
        where: { contratoId: c.id, descricao: { contains: mesLabel } },
      });
      if (jaExiste) { ignoradas.push({ contratoId: c.id, motivo: "já existe" }); continue; }

      const fatura = await this.db.fatura.create({
        data: {
          id:            require("crypto").randomUUID(),
          clienteId:     c.clienteId,
          contratoId:    c.id,
          criadoPorId:   req.user.id,
          descricao:     `Mensalidade ${mesLabel} — ${c.titulo}`,
          valor:         c.valor,
          dataEmissao:   inicio,
          dataVencimento: venc,
          status:        "pendente",
          atualizadoEm:  new Date(),
          ...(orgId ? { organizationId: orgId } : {}),
        },
        include: { cliente: { select: { id: true, nome: true } } },
      });
      criadas.push(mapFatura(fatura));
    }

    return { criadas: criadas.length, ignoradas: ignoradas.length, faturas: criadas };
  }

  // GET /faturas
  @Get()
  @Permissions("crm:ver")
  async findAll(
    @Req() req: any,
    @Query("clienteId")  clienteId?: string,
    @Query("contratoId") contratoId?: string,
    @Query("status")     status?: string,
    @Query("search")     search?: string,
  ) {
    const orgId = req.user?.organizationId;
    const where: any = { ...(orgId ? { organizationId: orgId } as any : {}) };
    if (clienteId)  where.clienteId  = clienteId;
    if (contratoId) where.contratoId = contratoId;
    if (search) where.OR = [
      { descricao: { contains: search, mode: "insensitive" } },
      { observacoes:{ contains: search, mode: "insensitive" } },
    ];

    const faturas = await this.db.fatura.findMany({
      where,
      orderBy: { dataVencimento: "desc" },
      include: {
        cliente:  { select: { id: true, nome: true, empresa: true } },
        contrato: { select: { id: true, titulo: true, numero: true } },
      },
    });
    let result = faturas.map(mapFatura);
    if (status) result = result.filter((f: any) => f.statusComputado === status);
    return result;
  }

  // GET /faturas/:id
  @Get(":id")
  @Permissions("crm:ver")
  async findOne(@Param("id") id: string) {
    const f = await this.db.fatura.findUnique({
      where: { id },
      include: {
        cliente:  { select: { id: true, nome: true, empresa: true, email: true } },
        contrato: { select: { id: true, titulo: true, numero: true } },
      },
    });
    if (!f) throw new NotFoundException("Fatura nao encontrada");
    return mapFatura(f);
  }

  // POST /faturas
  @Post()
  @Permissions("crm:ver")
  async create(@Body() body: any, @Req() req: any) {
    if (!body.clienteId) throw new BadRequestException("clienteId obrigatorio");
    if (!body.dataVencimento) throw new BadRequestException("dataVencimento obrigatorio");
    if (body.valor === undefined || body.valor === null) throw new BadRequestException("valor obrigatorio");

    const cliente = await this.db.cliente.findUnique({ where: { id: body.clienteId } });
    if (!cliente) throw new NotFoundException("Cliente nao encontrado");

    const orgId = req.user?.organizationId;
    const fatura = await this.db.fatura.create({
      data: {
        id:             require("crypto").randomUUID(),
        clienteId:      body.clienteId,
        contratoId:     body.contratoId || null,
        criadoPorId:    req.user.id,
        descricao:      body.descricao || null,
        valor:          Number(body.valor),
        dataEmissao:    body.dataEmissao ? new Date(body.dataEmissao) : new Date(),
        dataVencimento: new Date(body.dataVencimento),
        dataPagamento:  body.dataPagamento ? new Date(body.dataPagamento) : null,
        status:         STATUS_VALID.includes(body.status) ? body.status : "pendente",
        observacoes:    body.observacoes || null,
        atualizadoEm:   new Date(),
        ...(orgId ? { organizationId: orgId } : {}),
      },
      include: {
        cliente:  { select: { id: true, nome: true, empresa: true } },
        contrato: { select: { id: true, titulo: true, numero: true } },
      },
    });
    return mapFatura(fatura);
  }

  // PUT /faturas/:id
  @Put(":id")
  @Permissions("crm:ver")
  async update(@Param("id") id: string, @Body() body: any) {
    const existing = await this.db.fatura.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Fatura nao encontrada");

    const data: any = { atualizadoEm: new Date() };
    if (body.descricao      !== undefined) data.descricao      = body.descricao;
    if (body.valor          !== undefined) data.valor          = Number(body.valor);
    if (body.dataEmissao    !== undefined) data.dataEmissao    = body.dataEmissao ? new Date(body.dataEmissao) : null;
    if (body.dataVencimento !== undefined) data.dataVencimento = new Date(body.dataVencimento);
    if (body.dataPagamento  !== undefined) data.dataPagamento  = body.dataPagamento ? new Date(body.dataPagamento) : null;
    if (body.status         !== undefined) data.status         = STATUS_VALID.includes(body.status) ? body.status : existing.status;
    if (body.observacoes    !== undefined) data.observacoes    = body.observacoes;
    if (body.contratoId     !== undefined) data.contratoId     = body.contratoId || null;

    const updated = await this.db.fatura.update({
      where: { id },
      data,
      include: {
        cliente:  { select: { id: true, nome: true, empresa: true } },
        contrato: { select: { id: true, titulo: true, numero: true } },
      },
    });
    return mapFatura(updated);
  }

  // PATCH /faturas/:id/pagar — marcar como pago
  @Patch(":id/pagar")
  @Permissions("crm:ver")
  async pagar(@Param("id") id: string, @Body() body: { dataPagamento?: string }) {
    const existing = await this.db.fatura.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Fatura nao encontrada");
    const updated = await this.db.fatura.update({
      where: { id },
      data: {
        status: "pago",
        dataPagamento: body.dataPagamento ? new Date(body.dataPagamento) : new Date(),
        atualizadoEm: new Date(),
      },
      include: {
        cliente:  { select: { id: true, nome: true, empresa: true } },
        contrato: { select: { id: true, titulo: true, numero: true } },
      },
    });
    return mapFatura(updated);
  }

  // POST /faturas/importar — bulk import from CSV rows
  @Post("importar")
  @Permissions("crm:ver")
  async importar(@Body() body: { rows: any[] }, @Req() req: any) {
    const rows = body.rows || [];
    const criadas: any[] = [];
    const erros: { linha: number; erro: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        if (!r.clienteNome && !r.clienteId) throw new Error("clienteNome ou clienteId obrigatório");
        if (!r.dataVencimento) throw new Error("dataVencimento obrigatório");
        if (r.valor === undefined || r.valor === null || r.valor === "") throw new Error("valor obrigatório");

        let clienteId = r.clienteId;
        if (!clienteId && r.clienteNome) {
          const cliente = await this.db.cliente.findFirst({
            where: { nome: { equals: r.clienteNome.trim(), mode: "insensitive" } },
            select: { id: true },
          });
          if (!cliente) throw new Error(`Cliente "${r.clienteNome}" não encontrado`);
          clienteId = cliente.id;
        }

        const orgId3 = req.user?.organizationId;
        const fatura = await this.db.fatura.create({
          data: {
            id:             require("crypto").randomUUID(),
            clienteId,
            contratoId:     r.contratoId || null,
            criadoPorId:    req.user.id,
            descricao:      r.descricao || null,
            valor:          Number(r.valor),
            dataEmissao:    r.dataEmissao ? new Date(r.dataEmissao) : new Date(),
            dataVencimento: new Date(r.dataVencimento),
            dataPagamento:  r.dataPagamento ? new Date(r.dataPagamento) : null,
            status:         STATUS_VALID.includes(r.status) ? r.status : "pendente",
            observacoes:    r.observacoes || null,
            atualizadoEm:   new Date(),
            ...(orgId3 ? { organizationId: orgId3 } : {}),
          },
        });
        criadas.push(fatura);
      } catch (e: any) {
        erros.push({ linha: i + 1, erro: e.message });
      }
    }

    return { total: rows.length, criadas: criadas.length, erros };
  }

  // DELETE /faturas/:id
  @Delete(":id")
  @Permissions("crm:ver")
  async remove(@Param("id") id: string, @Req() req: any) {
    if (!req.user.isMaster) throw new ForbiddenException("Apenas masters podem remover faturas");
    const existing = await this.db.fatura.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Fatura nao encontrada");
    await this.db.fatura.delete({ where: { id } });
    return { message: "Fatura removida" };
  }
}

// ── Module ────────────────────────────────────────────────────────────────────
@Module({
  controllers: [FaturasController],
})
export class FaturasModule {}
