import {
  Module, Controller, Get, Post, Delete,
  Body, Param, Query, UseGuards, Req,
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../../prisma/prisma.service";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";

// ── ApontamentosController ────────────────────────────────────────────────────
@Controller("apontamentos")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class ApontamentosController {
  constructor(private prisma: PrismaService) {}
  private get db() { return this.prisma as any; }

  // POST /apontamentos
  // Body: { chamadoId, minutos, descricao?, data? }
  @Post()
  @Permissions("chamados:ver")
  async create(@Body() body: any, @Req() req: any) {
    if (!body.chamadoId)       throw new BadRequestException("chamadoId obrigatorio");
    if (!body.minutos || body.minutos <= 0)
      throw new BadRequestException("minutos deve ser maior que 0");

    const chamado = await this.db.chamado.findUnique({ where: { id: body.chamadoId } });
    if (!chamado) throw new NotFoundException("Chamado nao encontrado");

    const orgId = req.user?.organizationId;
    return this.db.apontamentoHoras.create({
      data: {
        id:        require("crypto").randomUUID(),
        chamadoId: body.chamadoId,
        userId:    req.user.id,
        minutos:   Number(body.minutos),
        descricao: body.descricao || null,
        data:      body.data ? new Date(body.data) : new Date(),
        ...(orgId ? { organizationId: orgId } : {}),
      } as any,
      include: { user: { select: { id: true, nome: true, avatar: true } } },
    });
  }

  // GET /apontamentos?chamadoId=X
  @Get()
  @Permissions("chamados:ver")
  async findAll(@Req() req: any, @Query("chamadoId") chamadoId?: string, @Query("userId") userId?: string) {
    const orgId = req.user?.organizationId;
    const where: any = { ...(orgId ? { organizationId: orgId } as any : {}) };
    if (chamadoId) where.chamadoId = chamadoId;
    if (userId)    where.userId    = userId;
    return this.db.apontamentoHoras.findMany({
      where,
      orderBy: { data: "desc" },
      include: {
        user:    { select: { id: true, nome: true, avatar: true } },
        chamado: { select: { id: true, numero: true, titulo: true } },
      },
    });
  }

  // GET /apontamentos/relatorio?from=YYYY-MM-DD&to=YYYY-MM-DD&userId=X
  @Get("relatorio")
  @Permissions("chamados:ver")
  async relatorio(
    @Query("from")    from?:    string,
    @Query("to")      to?:      string,
    @Query("userId")  userId?:  string,
    @Req() req?: any,
  ) {
    const orgId = req.user?.organizationId;
    const where: any = { ...(orgId ? { organizationId: orgId } as any : {}) };
    if (userId) where.userId = userId;
    if (from || to) {
      where.data = {};
      if (from) where.data.gte = new Date(from);
      if (to)   where.data.lte = new Date(to + "T23:59:59Z");
    }

    const rows = await this.db.apontamentoHoras.findMany({
      where,
      include: {
        user:    { select: { id: true, nome: true } },
        chamado: { select: { id: true, numero: true, titulo: true, status: true } },
      },
      orderBy: { data: "desc" },
    });

    // Aggregate by user
    const byUser: Record<string, { userId: string; nome: string; totalMinutos: number; qtd: number }> = {};
    for (const r of rows) {
      const uid = r.user.id;
      if (!byUser[uid]) byUser[uid] = { userId: uid, nome: r.user.nome, totalMinutos: 0, qtd: 0 };
      byUser[uid].totalMinutos += r.minutos;
      byUser[uid].qtd++;
    }

    // Aggregate by chamado
    const byChamado: Record<string, { chamadoId: string; numero: number; titulo: string; totalMinutos: number; qtd: number }> = {};
    for (const r of rows) {
      const cid = r.chamado.id;
      if (!byChamado[cid]) byChamado[cid] = { chamadoId: cid, numero: r.chamado.numero, titulo: r.chamado.titulo, totalMinutos: 0, qtd: 0 };
      byChamado[cid].totalMinutos += r.minutos;
      byChamado[cid].qtd++;
    }

    const totalMinutos = rows.reduce((s: number, r: any) => s + r.minutos, 0);

    return {
      totalMinutos,
      totalHoras: Math.floor(totalMinutos / 60),
      totalRegistros: rows.length,
      porUsuario: Object.values(byUser).sort((a, b) => b.totalMinutos - a.totalMinutos),
      porChamado: Object.values(byChamado).sort((a, b) => b.totalMinutos - a.totalMinutos),
      registros: rows,
    };
  }

  // DELETE /apontamentos/:id
  @Delete(":id")
  @Permissions("chamados:ver")
  async remove(@Param("id") id: string, @Req() req: any) {
    const ap = await this.db.apontamentoHoras.findUnique({ where: { id } });
    if (!ap) throw new NotFoundException("Apontamento nao encontrado");
    if (ap.userId !== req.user.id && !req.user.isMaster)
      throw new ForbiddenException("Apenas o dono ou um master pode remover este apontamento");
    await this.db.apontamentoHoras.delete({ where: { id } });
    return { message: "Apontamento removido" };
  }
}

// ── Module ────────────────────────────────────────────────────────────────────
@Module({
  controllers: [ApontamentosController],
})
export class ApontamentosModule {}
