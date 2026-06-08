import {
  Module, Controller, Get, Post, Put, Delete, Body, Param,
  UseGuards, Req, Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../../prisma/prisma.service";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";

// ── SlaService (exported for use in ChamadosModule) ───────────────────────────
@Injectable()
export class SlaService {
  constructor(private prisma: PrismaService) {}

  async findRegra(prioridade: string, categoria?: string | null, organizationId?: string): Promise<any | null> {
    const db = this.prisma as any;
    const ow = organizationId ? { organizationId } : {};
    if (categoria) {
      const exact = await db.slaRegra.findFirst({ where: { prioridade, categoria, ativo: true, ...ow } });
      if (exact) return exact;
    }
    return db.slaRegra.findFirst({ where: { prioridade, categoria: null, ativo: true, ...ow } });
  }

  computeDeadlines(criadoEm: Date, regra: any) {
    return {
      slaRespostaAt:  new Date(criadoEm.getTime() + regra.prazoRespostaH  * 3600000),
      slaResolucaoAt: new Date(criadoEm.getTime() + regra.prazoResolucaoH * 3600000),
    };
  }
}

// ── SlaController ─────────────────────────────────────────────────────────────
@Controller("sla")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class SlaController {
  constructor(private prisma: PrismaService) {}

  private get db() { return this.prisma as any; }

  // ── Rules CRUD ──────────────────────────────────────────────────────────────

  @Get("regras")
  @Permissions("sla:ver")
  async listRegras(@Req() req: any) {
    const orgId = req.user?.organizationId;
    const orgWhere = orgId ? { organizationId: orgId } as any : {};
    return this.db.slaRegra.findMany({ where: orgWhere, orderBy: [{ prioridade: "asc" }, { categoria: "asc" }] });
  }

  @Post("regras")
  @Permissions("sla:configurar")
  async createRegra(@Body() body: { nome: string; prioridade: string; categoria?: string; prazoRespostaH: number; prazoResolucaoH: number }, @Req() req: any) {
    if (!body.nome?.trim())          throw new BadRequestException("Nome obrigatorio");
    if (!body.prioridade)            throw new BadRequestException("Prioridade obrigatoria");
    if (!body.prazoRespostaH  || body.prazoRespostaH  < 1) throw new BadRequestException("Prazo de resposta invalido");
    if (!body.prazoResolucaoH || body.prazoResolucaoH < 1) throw new BadRequestException("Prazo de resolucao invalido");
    const orgId = req.user?.organizationId;
    try {
      return await this.db.slaRegra.create({
        data: {
          id:              require("crypto").randomUUID(),
          nome:            body.nome.trim(),
          prioridade:      body.prioridade,
          categoria:       body.categoria || null,
          prazoRespostaH:  Number(body.prazoRespostaH),
          prazoResolucaoH: Number(body.prazoResolucaoH),
          ...(orgId ? { organizationId: orgId } : {}),
        },
      });
    } catch (e: any) {
      if (e.code === "P2002") throw new BadRequestException("Ja existe uma regra para esta combinacao de prioridade/categoria");
      throw e;
    }
  }

  @Put("regras/:id")
  @Permissions("sla:configurar")
  async updateRegra(@Param("id") id: string, @Body() body: any) {
    const existing = await this.db.slaRegra.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Regra nao encontrada");
    return this.db.slaRegra.update({
      where: { id },
      data: {
        ...(body.nome            && { nome: body.nome.trim() }),
        ...(body.prazoRespostaH  && { prazoRespostaH:  Number(body.prazoRespostaH) }),
        ...(body.prazoResolucaoH && { prazoResolucaoH: Number(body.prazoResolucaoH) }),
        ...(body.ativo !== undefined && { ativo: Boolean(body.ativo) }),
      },
    });
  }

  @Delete("regras/:id")
  @Permissions("sla:configurar")
  async deleteRegra(@Param("id") id: string) {
    const existing = await this.db.slaRegra.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Regra nao encontrada");
    await this.db.slaRegra.delete({ where: { id } });
    return { message: "Regra removida" };
  }

  // ── Dashboard ───────────────────────────────────────────────────────────────

  @Get("dashboard")
  @Permissions("sla:ver")
  async getDashboard(@Req() req: any) {
    const since30d = new Date(Date.now() - 30 * 24 * 3600000);
    const now      = new Date();
    const orgId = req.user?.organizationId;
    const orgWhere = orgId ? { organizationId: orgId } as any : {};

    const [chamados30d, abertos, regras] = await Promise.all([
      this.db.chamado.findMany({
        where: { criadoEm: { gte: since30d }, ...orgWhere },
        select: {
          id: true, numero: true, prioridade: true, status: true,
          criadoEm: true, resolvidoEm: true,
          primeiraRespostaEm: true, slaRespostaAt: true, slaResolucaoAt: true,
        },
      }),
      this.db.chamado.findMany({
        where: { status: { notIn: ["resolvido", "fechado"] }, slaResolucaoAt: { not: null }, ...orgWhere },
        select: { id: true, numero: true, titulo: true, prioridade: true, slaRespostaAt: true, slaResolucaoAt: true, criadoEm: true },
      }),
      this.db.slaRegra.findMany({ where: { ativo: true, ...orgWhere }, orderBy: [{ prioridade: "asc" }] }),
    ]);

    let respostaCumprida = 0, respostaViolada = 0;
    let resolucaoCumprida = 0, resolucaoViolada = 0;
    const byPrioridade: Record<string, any> = {};

    for (const c of chamados30d) {
      if (!byPrioridade[c.prioridade]) {
        byPrioridade[c.prioridade] = { total: 0, resolucaoOk: 0, respostaOk: 0, msResposta: [] as number[], msResolucao: [] as number[] };
      }
      const p = byPrioridade[c.prioridade];
      p.total++;

      if (c.primeiraRespostaEm && c.slaRespostaAt) {
        const ok = new Date(c.primeiraRespostaEm) <= new Date(c.slaRespostaAt);
        ok ? respostaCumprida++ : respostaViolada++;
        if (ok) p.respostaOk++;
        p.msResposta.push(new Date(c.primeiraRespostaEm).getTime() - new Date(c.criadoEm).getTime());
      }

      if (["resolvido", "fechado"].includes(c.status) && c.resolvidoEm && c.slaResolucaoAt) {
        const ok = new Date(c.resolvidoEm) <= new Date(c.slaResolucaoAt);
        ok ? resolucaoCumprida++ : resolucaoViolada++;
        if (ok) p.resolucaoOk++;
        p.msResolucao.push(new Date(c.resolvidoEm).getTime() - new Date(c.criadoEm).getTime());
      }
    }

    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length / 60000) : null;

    const violacoesAbertas = abertos.filter((c: any) => now > new Date(c.slaResolucaoAt));
    const emRisco = abertos.filter((c: any) => {
      const d = new Date(c.slaResolucaoAt);
      return now < d && now > new Date(d.getTime() - 2 * 3600000);
    });

    return {
      total30d: chamados30d.length,
      respostaCumprida, respostaViolada,
      resolucaoCumprida, resolucaoViolada,
      violacoesAbertas: violacoesAbertas.length,
      emRisco: emRisco.length,
      violacoesDetalhes: violacoesAbertas.slice(0, 10),
      byPrioridade: Object.fromEntries(
        Object.entries(byPrioridade).map(([k, v]: any) => [k, {
          total: v.total,
          resolucaoOk: v.resolucaoOk,
          respostaOk: v.respostaOk,
          tempoMedioRespostaMin:   avg(v.msResposta),
          tempoMedioResolucaoMin:  avg(v.msResolucao),
        }])
      ),
      regras,
    };
  }

  // ── SLA por atendente (últimos 30 dias) ─────────────────────────────────────

  @Get("atendentes")
  @Permissions("sla:ver")
  async atendentes(@Req() req: any) {
    const since30d = new Date(Date.now() - 30 * 24 * 3600000);
    const now = new Date();
    const orgId = req.user?.organizationId;
    const orgWhere = orgId ? { organizationId: orgId } as any : {};

    const chamados = await this.db.chamado.findMany({
      where: { criadoEm: { gte: since30d }, atendenteId: { not: null }, ...orgWhere },
      select: {
        id: true, status: true, prioridade: true,
        criadoEm: true, resolvidoEm: true, primeiraRespostaEm: true,
        slaRespostaAt: true, slaResolucaoAt: true, atendenteId: true,
        atendente: { select: { id: true, nome: true } },
      },
    });

    const by: Record<string, any> = {};
    for (const c of chamados) {
      if (!c.atendenteId || !(c as any).atendente) continue;
      const id = c.atendenteId;
      if (!by[id]) by[id] = { id, nome: (c as any).atendente.nome, total: 0, resolvidos: 0, resolucaoOk: 0, resolucaoViolada: 0, respostaOk: 0, respostaViolada: 0, violacoesAbertas: 0, msResolucao: [] };
      const a = by[id];
      a.total++;
      const closed = ["resolvido","fechado"].includes(c.status);
      if (closed) a.resolvidos++;
      if (closed && c.resolvidoEm && c.slaResolucaoAt) {
        const ok = new Date(c.resolvidoEm) <= new Date(c.slaResolucaoAt);
        ok ? a.resolucaoOk++ : a.resolucaoViolada++;
        a.msResolucao.push(new Date(c.resolvidoEm).getTime() - new Date(c.criadoEm).getTime());
      }
      if (c.primeiraRespostaEm && c.slaRespostaAt) {
        const ok = new Date(c.primeiraRespostaEm) <= new Date(c.slaRespostaAt);
        ok ? a.respostaOk++ : a.respostaViolada++;
      }
      if (!closed && c.slaResolucaoAt && now > new Date(c.slaResolucaoAt)) a.violacoesAbertas++;
    }

    const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length / 60000) : null;
    return Object.values(by).map((a: any) => ({
      id: a.id, nome: a.nome, total: a.total, resolvidos: a.resolvidos,
      resolucaoPct: a.resolvidos > 0 ? Math.round((a.resolucaoOk / a.resolvidos) * 100) : null,
      respostaPct:  (a.respostaOk + a.respostaViolada) > 0 ? Math.round((a.respostaOk / (a.respostaOk + a.respostaViolada)) * 100) : null,
      violacoesAbertas: a.violacoesAbertas,
      tempoMedioResolucaoMin: avg(a.msResolucao),
    })).sort((a: any, b: any) => b.total - a.total);
  }

  // ── Recalcular SLA para chamados abertos ────────────────────────────────────

  @Post("recalcular")
  @Permissions("sla:configurar")
  async recalcular(@Req() req: any) {
    if (!req.user.isMaster) throw new ForbiddenException("Apenas masters podem recalcular SLA");

    const orgId = req.user?.organizationId;
    const orgWhere2 = orgId ? { organizationId: orgId } as any : {};
    const abertos = await this.db.chamado.findMany({
      where: { status: { notIn: ["resolvido", "fechado"] }, ...orgWhere2 },
      select: { id: true, prioridade: true, categoria: true, criadoEm: true },
    });

    let updated = 0;
    for (const c of abertos) {
      let regra = c.categoria
        ? await this.db.slaRegra.findFirst({ where: { prioridade: c.prioridade, categoria: c.categoria, ativo: true } })
        : null;
      if (!regra) {
        regra = await this.db.slaRegra.findFirst({ where: { prioridade: c.prioridade, categoria: null, ativo: true } });
      }
      if (regra) {
        await this.db.chamado.update({
          where: { id: c.id },
          data: {
            slaRegraId:    regra.id,
            slaRespostaAt:  new Date(c.criadoEm.getTime() + regra.prazoRespostaH  * 3600000),
            slaResolucaoAt: new Date(c.criadoEm.getTime() + regra.prazoResolucaoH * 3600000),
          },
        });
        updated++;
      }
    }
    return { message: `SLA recalculado para ${updated} chamados`, updated };
  }
}

// ── Module ────────────────────────────────────────────────────────────────────
@Module({
  controllers: [SlaController],
  providers:   [SlaService],
  exports:     [SlaService],
})
export class SlaModule {}
