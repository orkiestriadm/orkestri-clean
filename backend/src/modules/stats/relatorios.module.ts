import { Module, Controller, Get, Query, UseGuards, Req } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../../prisma/prisma.service";

// Returns an array of {semana, label} for the last N weeks (Mon–Sun)
function lastNWeeks(n: number): { inicio: Date; fim: Date; label: string }[] {
  const weeks: { inicio: Date; fim: Date; label: string }[] = [];
  const now = new Date();
  // Align to start of current week (Monday)
  const dow = now.getDay() === 0 ? 6 : now.getDay() - 1; // Mon=0..Sun=6
  const thisMonday = new Date(now);
  thisMonday.setHours(0, 0, 0, 0);
  thisMonday.setDate(thisMonday.getDate() - dow);

  for (let i = n - 1; i >= 0; i--) {
    const inicio = new Date(thisMonday);
    inicio.setDate(inicio.getDate() - i * 7);
    const fim = new Date(inicio);
    fim.setDate(fim.getDate() + 7);
    const label = `${String(inicio.getDate()).padStart(2,"0")}/${String(inicio.getMonth()+1).padStart(2,"0")}`;
    weeks.push({ inicio, fim, label });
  }
  return weeks;
}

@Controller("relatorios")
class RelatoriosController {
  constructor(private prisma: PrismaService) {}
  private get db() { return this.prisma as any; }

  @Get("visao-geral")
  @UseGuards(AuthGuard("jwt"))
  async visaoGeral(@Req() req: any, @Query("dias") dias?: string) {
    const period = Number(dias) || 30;
    const desde = new Date();
    desde.setDate(desde.getDate() - period);

    const [
      totalTasks, tasksConcluidas, tasksVencidas,
      totalEventos, totalProjetos, projetosAtivos,
      tasksPorDia, tasksPorStatus, tasksPorMembro,
    ] = await Promise.all([
      this.prisma.task.count(),
      this.prisma.task.count({ where: { status: "CONCLUIDA" } }),
      this.prisma.task.count({ where: { dataVencimento: { lt: new Date() }, status: { not: "CONCLUIDA" } } }),
      this.prisma.event.count({ where: { userId: req.user.id, inicio: { gte: desde } } }),
      this.prisma.project.count(),
      this.prisma.project.count({ where: { status: "EM_ANDAMENTO" } }),
      this.prisma.$queryRaw`
        SELECT DATE(atualizado_em) as dia, COUNT(*) as total
        FROM tasks
        WHERE status = 'CONCLUIDA' AND atualizado_em >= ${new Date(Date.now() - 14*24*60*60*1000)}
        GROUP BY DATE(atualizado_em)
        ORDER BY dia ASC
      `,
      this.prisma.task.groupBy({ by: ["status"], _count: { id: true } }),
      this.prisma.task.groupBy({
        by: ["assigneeId"],
        _count: { id: true },
        where: { assigneeId: { not: null } },
      }),
    ]);

    const assigneeIds = (tasksPorMembro as any[]).map(t => t.assigneeId).filter(Boolean);
    const membros = await this.prisma.user.findMany({
      where: { id: { in: assigneeIds } },
      select: { id: true, nome: true },
    });

    const membrosMap = Object.fromEntries(membros.map(m => [m.id, m.nome]));
    const progresso = totalTasks > 0 ? Math.round((tasksConcluidas / totalTasks) * 100) : 0;

    return {
      resumo: { totalTasks, tasksConcluidas, tasksVencidas, totalEventos, totalProjetos, projetosAtivos, progresso },
      tasksPorDia: (tasksPorDia as any[]).map(d => ({ dia: String(d.dia), total: Number(d.total) })),
      tasksPorStatus: (tasksPorStatus as any[]).map(t => ({ status: t.status, total: t._count.id })),
      tasksPorMembro: (tasksPorMembro as any[]).map(t => ({ nome: membrosMap[t.assigneeId] || "Sem nome", total: t._count.id })),
    };
  }

  @Get("produtividade")
  @UseGuards(AuthGuard("jwt"))
  async produtividade(@Req() req: any) {
    const desde = new Date();
    desde.setDate(desde.getDate() - 30);

    const [dailyTasks, dailyConcluidas] = await Promise.all([
      this.prisma.dailyTask.count({ where: { userId: req.user.id, criadoEm: { gte: desde } } }),
      this.prisma.dailyTask.count({ where: { userId: req.user.id, concluido: true, criadoEm: { gte: desde } } }),
    ]);

    const tasksAssignee = await this.prisma.task.count({ where: { assigneeId: req.user.id } });
    const tasksDone     = await this.prisma.task.count({ where: { assigneeId: req.user.id, status: "CONCLUIDA" } });

    return {
      dailyTasks, dailyConcluidas,
      dailyProgresso: dailyTasks > 0 ? Math.round((dailyConcluidas / dailyTasks) * 100) : 0,
      tasksAssignee, tasksDone,
      taxaConclusao: tasksAssignee > 0 ? Math.round((tasksDone / tasksAssignee) * 100) : 0,
    };
  }

  // GET /relatorios/chamados-trend?semanas=8
  @Get("chamados-trend")
  @UseGuards(AuthGuard("jwt"))
  async chamadosTrend(@Req() req: any, @Query("semanas") semanas?: string) {
    const n = Math.min(Number(semanas) || 8, 24);
    const weeks = lastNWeeks(n);
    const orgId = req.user?.organizationId;
    const ow = orgId ? { organizationId: orgId } as any : {};

    const result = await Promise.all(weeks.map(async ({ inicio, fim, label }) => {
      const [abertos, fechados, urgentes] = await Promise.all([
        this.prisma.chamado.count({ where: { criadoEm: { gte: inicio, lt: fim }, ...ow } }),
        this.prisma.chamado.count({ where: { status: { in: ["resolvido","fechado"] }, resolvidoEm: { gte: inicio, lt: fim }, ...ow } }),
        this.prisma.chamado.count({ where: { criadoEm: { gte: inicio, lt: fim }, prioridade: "urgente", ...ow } }),
      ]);
      return { label, abertos, fechados, urgentes };
    }));

    return result;
  }

  // GET /relatorios/sla-trend?semanas=8
  @Get("sla-trend")
  @UseGuards(AuthGuard("jwt"))
  async slaTrend(@Req() req: any, @Query("semanas") semanas?: string) {
    const n = Math.min(Number(semanas) || 8, 24);
    const weeks = lastNWeeks(n);
    const orgId = req.user?.organizationId;
    const ow = orgId ? { organizationId: orgId } as any : {};

    const result = await Promise.all(weeks.map(async ({ inicio, fim, label }) => {
      const [total, violados] = await Promise.all([
        this.prisma.chamado.count({
          where: { status: { in: ["resolvido","fechado"] }, resolvidoEm: { gte: inicio, lt: fim }, ...ow },
        }),
        this.db.chamado.count({
          where: {
            resolvidoEm: { gte: inicio, lt: fim },
            status: { in: ["resolvido","fechado"] },
            slaResolucaoAt: { not: null },
            AND: [{ resolvidoEm: { not: null } }],
            ...ow,
          },
        }),
      ]);
      // Simplified: SLA violados = chamados fechados com slaResolucaoAt < resolvidoEm
      // Using raw query for accuracy
      const violadosReal: any[] = await this.prisma.$queryRaw`
        SELECT COUNT(*) as count FROM chamados
        WHERE resolvido_em >= ${inicio} AND resolvido_em < ${fim}
          AND status IN ('resolvido','fechado')
          AND sla_resolucao_at IS NOT NULL
          AND resolvido_em > sla_resolucao_at
      `;
      const v = Number(violadosReal[0]?.count || 0);
      const compliance = total > 0 ? Math.round(((total - Math.min(v, total)) / total) * 100) : null;
      return { label, total, violados: v, compliance };
    }));

    return result;
  }

  // GET /relatorios/csat-trend?semanas=8
  @Get("csat-trend")
  @UseGuards(AuthGuard("jwt"))
  async csatTrend(@Req() req: any, @Query("semanas") semanas?: string) {
    const n = Math.min(Number(semanas) || 8, 24);
    const weeks = lastNWeeks(n);
    const orgId = req.user?.organizationId;
    const ow = orgId ? { organizationId: orgId } as any : {};

    const result = await Promise.all(weeks.map(async ({ inicio, fim, label }) => {
      const agg = await this.db.chamado.aggregate({
        _avg: { avaliacao: true },
        _count: { avaliacao: true },
        where: { avaliacao: { not: null }, atualizadoEm: { gte: inicio, lt: fim }, ...ow },
      });

      // CSAT score = (notas 4+5) / total * 100
      const chamados = await this.db.chamado.findMany({
        where: { avaliacao: { not: null }, atualizadoEm: { gte: inicio, lt: fim }, ...ow },
        select: { avaliacao: true },
      });
      const total = chamados.length;
      const satisfeitos = chamados.filter((c: any) => c.avaliacao >= 4).length;
      const csat = total > 0 ? Math.round((satisfeitos / total) * 100) : null;
      const media = agg._avg.avaliacao ? Math.round(agg._avg.avaliacao * 10) / 10 : null;

      return { label, total, media, csat };
    }));

    return result;
  }

  // GET /relatorios/horas-trend?semanas=8
  @Get("horas-trend")
  @UseGuards(AuthGuard("jwt"))
  async horasTrend(@Req() req: any, @Query("semanas") semanas?: string) {
    const n = Math.min(Number(semanas) || 8, 24);
    const weeks = lastNWeeks(n);
    const orgId = req.user?.organizationId;
    const ow = orgId ? { organizationId: orgId } as any : {};

    const result = await Promise.all(weeks.map(async ({ inicio, fim, label }) => {
      const agg = await this.db.apontamentoHoras.aggregate({
        _sum: { minutos: true },
        _count: { id: true },
        where: { data: { gte: inicio, lt: fim }, ...ow },
      });
      const minutos = agg._sum.minutos || 0;
      return {
        label,
        minutos,
        horas: Math.round(minutos / 60 * 10) / 10,
        registros: agg._count.id,
      };
    }));

    return result;
  }

  // GET /relatorios/chamados-categoria — chamados by category (all time / current month)
  @Get("chamados-categoria")
  @UseGuards(AuthGuard("jwt"))
  async chamadosCategoria(@Req() req: any) {
    const mesInicio = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const orgId = req.user?.organizationId;
    const ow = orgId ? { organizationId: orgId } as any : {};
    const [porCategoria, porAtendente] = await Promise.all([
      this.prisma.chamado.groupBy({
        by: ["categoria" as any],
        _count: { id: true },
        where: { criadoEm: { gte: mesInicio }, ...ow },
      }),
      this.prisma.chamado.groupBy({
        by: ["atendenteId" as any],
        _count: { id: true },
        where: { criadoEm: { gte: mesInicio }, atendenteId: { not: null }, ...ow } as any,
      }),
    ]);

    const atendenteIds = (porAtendente as any[]).map((x: any) => x.atendenteId).filter(Boolean);
    const atendentes = await this.prisma.user.findMany({
      where: { id: { in: atendenteIds } },
      select: { id: true, nome: true },
    });
    const atMap = Object.fromEntries(atendentes.map(a => [a.id, a.nome]));

    return {
      porCategoria: (porCategoria as any[])
        .map((x: any) => ({ categoria: x.categoria || "Sem categoria", total: x._count.id }))
        .sort((a: any, b: any) => b.total - a.total),
      porAtendente: (porAtendente as any[])
        .map((x: any) => ({ nome: atMap[x.atendenteId] || "Sem atendente", total: x._count.id }))
        .sort((a: any, b: any) => b.total - a.total),
    };
  }

  // GET /relatorios/chamados-categorias?semanas=N
  @Get("chamados-categorias")
  @UseGuards(AuthGuard("jwt"))
  async chamadosCategorias(@Req() req: any, @Query("semanas") semanas?: string) {
    const n = Math.min(Number(semanas) || 12, 52);
    const desde = new Date();
    desde.setDate(desde.getDate() - n * 7);
    const orgId = req.user?.organizationId;
    const ow = orgId ? { organizationId: orgId } as any : {};

    const rows = await this.db.chamado.groupBy({
      by: ["categoria"],
      where: { criadoEm: { gte: desde }, ...ow },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    const resolvidosPorCat = await this.db.chamado.groupBy({
      by: ["categoria"],
      where: { criadoEm: { gte: desde }, status: { in: ["resolvido","fechado"] }, ...ow },
      _count: { id: true },
    });
    const resolvidosMap: Record<string, number> = {};
    for (const r of resolvidosPorCat) resolvidosMap[r.categoria || "Sem categoria"] = r._count.id;

    return rows.map((r: any) => {
      const cat = r.categoria || "Sem categoria";
      const total = r._count.id;
      const resolvidos = resolvidosMap[cat] || 0;
      return { categoria: cat, total, resolvidos, pctResolvidos: total > 0 ? Math.round(resolvidos / total * 100) : 0 };
    });
  }

  // GET /relatorios/chamados-comparativo?p1Start=&p1End=&p2Start=&p2End=
  @Get("chamados-comparativo")
  @UseGuards(AuthGuard("jwt"))
  async comparativo(
    @Query("p1Start") p1Start?: string,
    @Query("p1End")   p1End?: string,
    @Query("p2Start") p2Start?: string,
    @Query("p2End")   p2End?: string,
    @Req() req?: any,
  ) {
    const now = new Date();
    const d30  = new Date(now.getTime() - 30 * 86400000);
    const d60  = new Date(now.getTime() - 60 * 86400000);
    const s1 = p1Start ? new Date(p1Start) : d30;
    const e1 = p1End   ? new Date(p1End)   : now;
    const s2 = p2Start ? new Date(p2Start) : d60;
    const e2 = p2End   ? new Date(p2End)   : d30;

    const orgId = req.user?.organizationId;
    const ow = orgId ? { organizationId: orgId } as any : {};
    const stats = async (start: Date, end: Date) => {
      const [total, resolvidos, urgentes, slaViolados, csatAgg] = await Promise.all([
        this.db.chamado.count({ where: { criadoEm: { gte: start, lte: end }, ...ow } }),
        this.db.chamado.count({ where: { criadoEm: { gte: start, lte: end }, status: { in: ["resolvido","fechado"] }, ...ow } }),
        this.db.chamado.count({ where: { criadoEm: { gte: start, lte: end }, prioridade: "urgente", ...ow } }),
        this.db.chamado.count({ where: { criadoEm: { gte: start, lte: end }, slaResolucaoAt: { lt: end }, status: { notIn: ["resolvido","fechado","cancelado"] }, ...ow } }),
        this.db.chamado.aggregate({ _avg: { avaliacao: true }, _count: { avaliacao: true }, where: { criadoEm: { gte: start, lte: end }, avaliacao: { not: null }, ...ow } }),
      ]);
      return {
        total, resolvidos, urgentes, slaViolados,
        resolucaoPct: total > 0 ? Math.round(resolvidos / total * 100) : 0,
        csatMedia: Math.round(((csatAgg._avg.avaliacao || 0)) * 10) / 10,
        csatTotal: csatAgg._count.avaliacao,
      };
    };

    const [periodo1, periodo2] = await Promise.all([stats(s1, e1), stats(s2, e2)]);
    return {
      periodo1: { inicio: s1, fim: e1, ...periodo1 },
      periodo2: { inicio: s2, fim: e2, ...periodo2 },
    };
  }
}

@Module({ controllers: [RelatoriosController], providers: [PrismaService] })
export class RelatoriosModule {}
