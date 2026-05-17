import {
  Module, Controller, Get, Post,
  Body, Param, Query, UseGuards, Req, Res,
  Injectable, NotFoundException, BadRequestException,
} from "@nestjs/common";
import type { Response } from "express";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../../prisma/prisma.service";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";

// ── CsatController ────────────────────────────────────────────────────────────
@Controller("csat")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class CsatController {
  constructor(private prisma: PrismaService) {}
  private get db() { return this.prisma as any; }

  // POST /csat/:chamadoId — submit rating
  @Post(":chamadoId")
  @Permissions("chamados:ver")
  async avaliar(
    @Param("chamadoId") chamadoId: string,
    @Body() body: { nota: number; comentario?: string },
  ) {
    const nota = Number(body.nota);
    if (!nota || nota < 1 || nota > 5) throw new BadRequestException("nota deve ser entre 1 e 5");

    const chamado = await this.db.chamado.findUnique({ where: { id: chamadoId } });
    if (!chamado) throw new NotFoundException("Chamado nao encontrado");

    const updated = await this.db.chamado.update({
      where: { id: chamadoId },
      data: {
        avaliacao:      nota,
        avaliacaoNota:  body.comentario?.trim() || null,
      },
      select: { id: true, numero: true, avaliacao: true, avaliacaoNota: true },
    });
    return updated;
  }

  // GET /csat — analytics
  // ?from=YYYY-MM-DD&to=YYYY-MM-DD&atendenteId=X
  @Get()
  @Permissions("chamados:ver")
  async analytics(
    @Req() req: any,
    @Query("from")         from?:        string,
    @Query("to")           to?:          string,
    @Query("atendenteId")  atendenteId?: string,
  ) {
    const orgId = req.user?.organizationId;
    const where: any = { avaliacao: { not: null }, ...(orgId ? { organizationId: orgId } as any : {}) };
    if (atendenteId) where.atendenteId = atendenteId;
    if (from || to) {
      where.atualizadoEm = {};
      if (from) where.atualizadoEm.gte = new Date(from);
      if (to)   where.atualizadoEm.lte = new Date(to + "T23:59:59Z");
    }

    const chamados = await this.db.chamado.findMany({
      where,
      select: {
        id: true, numero: true, titulo: true, avaliacao: true, avaliacaoNota: true,
        status: true, categoria: true, atualizadoEm: true,
        atendente:   { select: { id: true, nome: true } },
        solicitante: { select: { id: true, nome: true } },
      },
      orderBy: { atualizadoEm: "desc" },
    });

    const total = chamados.length;
    const soma  = chamados.reduce((s: number, c: any) => s + (c.avaliacao || 0), 0);
    const media = total > 0 ? Math.round((soma / total) * 10) / 10 : 0;

    const distribuicao: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const c of chamados) if (c.avaliacao) distribuicao[c.avaliacao]++;

    // Score de satisfação: (notas 4+5) / total * 100
    const satisfeitos = (distribuicao[4] + distribuicao[5]);
    const csat = total > 0 ? Math.round((satisfeitos / total) * 100) : 0;

    // Por atendente
    const porAtendente: Record<string, { nome: string; total: number; soma: number; media: number }> = {};
    for (const c of chamados) {
      if (!c.atendente) continue;
      const id = c.atendente.id;
      if (!porAtendente[id]) porAtendente[id] = { nome: c.atendente.nome, total: 0, soma: 0, media: 0 };
      porAtendente[id].total++;
      porAtendente[id].soma += c.avaliacao || 0;
    }
    for (const k of Object.keys(porAtendente)) {
      const a = porAtendente[k];
      a.media = a.total > 0 ? Math.round((a.soma / a.total) * 10) / 10 : 0;
    }

    return {
      total, media, csat,
      distribuicao,
      porAtendente: Object.values(porAtendente).sort((a, b) => b.media - a.media),
      avaliacoes: chamados,
    };
  }

  // GET /csat/pendentes — chamados resolvidos/fechados sem avaliação
  @Get("pendentes")
  @Permissions("chamados:ver")
  async pendentes(@Req() req: any, @Query("limit") limit?: string) {
    const take = Math.min(Number(limit) || 20, 100);
    const orgId = req.user?.organizationId;
    return this.db.chamado.findMany({
      where: { status: { in: ["resolvido", "fechado"] }, avaliacao: null, ...(orgId ? { organizationId: orgId } as any : {}) },
      select: {
        id: true, numero: true, titulo: true, status: true, criadoEm: true, resolvidoEm: true,
        solicitante: { select: { id: true, nome: true } },
        atendente:   { select: { id: true, nome: true } },
      },
      orderBy: { resolvidoEm: "desc" }, take,
    });
  }

  // GET /csat/trend — NPS + CSAT por semana (últimas N semanas)
  @Get("trend")
  @Permissions("chamados:ver")
  async trend(@Req() req: any, @Query("semanas") semanas?: string) {
    const n = Math.min(Number(semanas) || 8, 24);
    const now = new Date();
    const weeks: { label: string; inicio: Date; fim: Date }[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const fim = new Date(now.getTime() - i * 7 * 86400000);
      const inicio = new Date(fim.getTime() - 7 * 86400000);
      weeks.push({ label: `S${n - i}`, inicio, fim });
    }

    const orgId = req.user?.organizationId;
    const chamados = await this.db.chamado.findMany({
      where: { avaliacao: { not: null }, atualizadoEm: { gte: weeks[0].inicio }, ...(orgId ? { organizationId: orgId } as any : {}) },
      select: { avaliacao: true, atualizadoEm: true },
    });

    const result = weeks.map(w => {
      const items = chamados.filter((c: any) => new Date(c.atualizadoEm) >= w.inicio && new Date(c.atualizadoEm) < w.fim);
      const total = items.length;
      if (total === 0) return { label: w.label, csat: null, nps: null, total: 0 };
      const soma = items.reduce((s: number, c: any) => s + c.avaliacao, 0);
      const promotores   = items.filter((c: any) => c.avaliacao >= 4).length;
      const detratores   = items.filter((c: any) => c.avaliacao <= 2).length;
      return {
        label: w.label,
        csat:  Math.round((promotores / total) * 100),
        media: Math.round((soma / total) * 10) / 10,
        nps:   Math.round(((promotores - detratores) / total) * 100),
        total,
      };
    });
    return result;
  }

  // GET /csat/nps — NPS consolidado
  @Get("nps")
  @Permissions("chamados:ver")
  async nps(@Req() req: any, @Query("from") from?: string, @Query("to") to?: string) {
    const orgId = req.user?.organizationId;
    const where: any = { avaliacao: { not: null }, ...(orgId ? { organizationId: orgId } as any : {}) };
    if (from) where.atualizadoEm = { ...(where.atualizadoEm || {}), gte: new Date(from) };
    if (to)   where.atualizadoEm = { ...(where.atualizadoEm || {}), lte: new Date(to + "T23:59:59Z") };

    const chamados = await this.db.chamado.findMany({ where, select: { avaliacao: true } });
    const total = chamados.length;
    if (total === 0) return { total: 0, nps: 0, promotores: 0, neutros: 0, detratores: 0 };

    const promotores = chamados.filter((c: any) => c.avaliacao >= 4).length;
    const neutros    = chamados.filter((c: any) => c.avaliacao === 3).length;
    const detratores = chamados.filter((c: any) => c.avaliacao <= 2).length;
    const nps = Math.round(((promotores - detratores) / total) * 100);

    return { total, nps, promotores, neutros, detratores,
      promotoresPct: Math.round((promotores / total) * 100),
      neutrosPct:    Math.round((neutros    / total) * 100),
      detratorPct:   Math.round((detratores / total) * 100),
    };
  }

  // GET /csat/export — CSV
  @Get("export")
  @Permissions("chamados:ver")
  async export(@Req() req: any, @Query("from") from?: string, @Query("to") to?: string, @Res() res?: Response) {
    const orgId = req.user?.organizationId;
    const where: any = { avaliacao: { not: null }, ...(orgId ? { organizationId: orgId } as any : {}) };
    if (from) where.atualizadoEm = { gte: new Date(from) };
    if (to)   where.atualizadoEm = { ...(where.atualizadoEm || {}), lte: new Date(to + "T23:59:59Z") };

    const rows = await this.db.chamado.findMany({
      where,
      select: { numero: true, titulo: true, avaliacao: true, avaliacaoNota: true, atualizadoEm: true,
        atendente: { select: { nome: true } }, solicitante: { select: { nome: true } } },
      orderBy: { atualizadoEm: "desc" },
    });

    const lines = ["Nº,Título,Avaliação,Nota,Atendente,Solicitante,Data"];
    for (const r of rows) {
      const d = new Date(r.atualizadoEm).toLocaleDateString("pt-BR");
      const nota = (r.avaliacaoNota || "").replace(/,/g, " ").replace(/"/g, "'");
      lines.push(`${r.numero},"${r.titulo}",${r.avaliacao},"${nota}","${r.atendente?.nome || ""}","${r.solicitante?.nome || ""}",${d}`);
    }

    if (res) {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="csat-${Date.now()}.csv"`);
      res.send("﻿" + lines.join("\n"));
    }
    return lines.join("\n");
  }
}

// ── Module ────────────────────────────────────────────────────────────────────
@Module({
  controllers: [CsatController],
  providers:   [PrismaService],
})
export class CsatModule {}
