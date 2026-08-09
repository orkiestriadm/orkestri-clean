import {
  Module, Controller, Get, UseGuards, Req, Injectable,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../../prisma/prisma.service";

function businessDaysBetween(from: Date, to: Date): number {
  let count = 0;
  const cur = new Date(from); cur.setHours(0, 0, 0, 0);
  const end = new Date(to);   end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

@Injectable()
export class WorkforceService {
  constructor(private prisma: PrismaService) {}

  private orgScope(user: any) {
    return user?.organizationId ? { organizationId: user.organizationId } : {};
  }

  async overview(user: any) {
    const orgScope = this.orgScope(user);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const hojeISO    = now.toISOString().slice(0, 10);
    const bd = businessDaysBetween(monthStart, monthEnd);

    // ── Colaboradores ─────────────────────────────────────────────────────
    const collabs = await (this.prisma as any).collaborator.findMany({
      where: { ...orgScope },
      include: {
        user:  { select: { id: true, nome: true } },
        setor: { select: { id: true, nome: true, cor: true } },
        collabSkills: { select: { id: true } },
      },
    });
    const ativos = collabs.filter((c: any) => c.ativo);

    // ── Capacity (realizado + planejado) ──────────────────────────────────
    const userIds = ativos.map((c: any) => c.userId);
    const apontRows = userIds.length ? await (this.prisma as any).apontamentoHoras.groupBy({
      by: ["userId"],
      where: { ...orgScope, data: { gte: monthStart, lte: monthEnd }, userId: { in: userIds } },
      _sum: { minutos: true },
    }) : [];
    const realizadoPorUser = new Map<string, number>(apontRows.map((r: any) => [r.userId, (r._sum.minutos || 0) / 60]));

    const chamadosAtivos = userIds.length ? await (this.prisma as any).chamado.groupBy({
      by: ["atendenteId"],
      where: { ...orgScope, status: { notIn: ["fechado", "cancelado"] }, atendenteId: { in: userIds } },
      _sum: { horasEstimadas: true, slaHoras: true },
      _count: { id: true },
    }) : [];
    const planejadoPorUser = new Map<string, number>();
    chamadosAtivos.forEach((c: any) => {
      if (c.atendenteId) planejadoPorUser.set(c.atendenteId, (c._sum.horasEstimadas || 0) + (c._sum.slaHoras || 0));
    });

    // Ausências aprovadas do mês
    const ausenciasAprovadas = await (this.prisma as any).ausencia.findMany({
      where: { ...orgScope, status: "APROVADA", dataInicio: { lte: monthEnd }, dataFim: { gte: monthStart } },
      include: { collaborator: { select: { userId: true } } },
    });
    const diasAusentesPorUser = new Map<string, number>();
    ausenciasAprovadas.forEach((a: any) => {
      const uid = a.collaborator.userId;
      const start = new Date(Math.max(+monthStart, +new Date(a.dataInicio)));
      const end   = new Date(Math.min(+monthEnd, +new Date(a.dataFim)));
      let dias = 0;
      const cur = new Date(start); cur.setHours(0,0,0,0);
      const endD = new Date(end);  endD.setHours(0,0,0,0);
      while (cur <= endD) { const d = cur.getDay(); if (d!==0&&d!==6) dias++; cur.setDate(cur.getDate()+1); }
      diasAusentesPorUser.set(uid, (diasAusentesPorUser.get(uid) || 0) + dias);
    });

    let totalNominal = 0, totalRealizado = 0, totalPlanejado = 0, sobrecarregados = 0;
    const porSetor = new Map<string, { nome: string; cor: string|null; colaboradores: number; nominal: number; planejado: number }>();
    for (const c of ativos) {
      const jornadaDia = c.jornadaHorasDia || 8;
      const diasAus = diasAusentesPorUser.get(c.userId) || 0;
      const nominal = Math.max(0, (bd - diasAus) * jornadaDia);
      const r = realizadoPorUser.get(c.userId) || 0;
      const p = planejadoPorUser.get(c.userId) || 0;
      totalNominal += nominal; totalRealizado += r; totalPlanejado += p;
      if (nominal > 0 && p / nominal > 0.9) sobrecarregados++;
      const setorKey = c.setor?.id || "sem_setor";
      if (!porSetor.has(setorKey)) porSetor.set(setorKey, { nome: c.setor?.nome || "Sem setor", cor: c.setor?.cor || null, colaboradores: 0, nominal: 0, planejado: 0 });
      const s = porSetor.get(setorKey)!;
      s.colaboradores++; s.nominal += nominal; s.planejado += p;
    }

    // ── Ausências (resumo) ────────────────────────────────────────────────
    const [ausPendentes, ausAprovadasMes, ausentesHojeRows] = await Promise.all([
      (this.prisma as any).ausencia.count({ where: { ...orgScope, status: "PENDENTE" } }),
      (this.prisma as any).ausencia.count({ where: { ...orgScope, status: "APROVADA", dataInicio: { gte: monthStart, lte: monthEnd } } }),
      (this.prisma as any).ausencia.findMany({
        where: { ...orgScope, status: "APROVADA", dataInicio: { lte: now }, dataFim: { gte: now } },
        select: { id: true },
      }),
    ]);

    // ── Workflows ─────────────────────────────────────────────────────────
    const [wfPendentes, wfAprovadasMes, wfRejeitadasMes] = await Promise.all([
      (this.prisma as any).workflowRequest.count({ where: { ...orgScope, status: "PENDENTE" } }),
      (this.prisma as any).workflowRequest.count({ where: { ...orgScope, status: "APROVADA", aprovadoEm: { gte: monthStart, lte: monthEnd } } }),
      (this.prisma as any).workflowRequest.count({ where: { ...orgScope, status: "REJEITADA", rejeitadoEm: { gte: monthStart, lte: monthEnd } } }),
    ]);

    // ── Skills ────────────────────────────────────────────────────────────
    const skills = await (this.prisma as any).skill.findMany({
      where: { ...orgScope, ativo: true },
      include: { _count: { select: { collaborators: true } } },
    });
    const topSkills = [...skills]
      .sort((a: any, b: any) => b._count.collaborators - a._count.collaborators)
      .slice(0, 5)
      .map((s: any) => ({ id: s.id, nome: s.nome, categoria: s.categoria, cor: s.cor, colaboradores: s._count.collaborators }));
    const semSkill = ativos.filter((c: any) => c.collabSkills.length === 0).length;

    return {
      periodo: { mes: now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }), diasUteis: bd },
      colaboradores: {
        total: collabs.length,
        ativos: ativos.length,
        inativos: collabs.length - ativos.length,
        semSkill,
      },
      capacity: {
        nominal: Number(totalNominal.toFixed(0)),
        realizado: Number(totalRealizado.toFixed(0)),
        planejado: Number(totalPlanejado.toFixed(0)),
        utilRealizado: totalNominal > 0 ? Number((totalRealizado / totalNominal * 100).toFixed(1)) : 0,
        utilPlanejado: totalNominal > 0 ? Number((totalPlanejado / totalNominal * 100).toFixed(1)) : 0,
        sobrecarregados,
      },
      ausencias: {
        pendentes: ausPendentes,
        aprovadasMes: ausAprovadasMes,
        ausentesHoje: ausentesHojeRows.length,
      },
      workflows: {
        pendentes: wfPendentes,
        aprovadasMes: wfAprovadasMes,
        rejeitadasMes: wfRejeitadasMes,
      },
      skills: {
        total: skills.length,
        top: topSkills,
      },
      porSetor: Array.from(porSetor.values())
        .map(s => ({
          ...s,
          nominal: Number(s.nominal.toFixed(0)),
          planejado: Number(s.planejado.toFixed(0)),
          util: s.nominal > 0 ? Number((s.planejado / s.nominal * 100).toFixed(1)) : 0,
        }))
        .sort((a, b) => b.colaboradores - a.colaboradores),
    };
  }
}

@Controller("workforce")
@UseGuards(AuthGuard("jwt"))
export class WorkforceController {
  constructor(private svc: WorkforceService) {}

  @Get("overview")
  overview(@Req() req: any) {
    return this.svc.overview(req.user);
  }
}

@Module({
  controllers: [WorkforceController],
  providers: [WorkforceService],
})
export class WorkforceModule {}
