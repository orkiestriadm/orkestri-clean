import { Module, Controller, Get, UseGuards, Req, Query } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../../prisma/prisma.service";
import { PermissionsGuard } from "../auth/permissions.guard";

@Controller("stats")
@UseGuards(AuthGuard("jwt"))
class StatsController {
  constructor(private prisma: PrismaService) {}
  private get db() { return this.prisma as any; }

  // GET /stats/executivo — aggregated KPIs for executive dashboard
  @Get("executivo")
  async executivo(@Req() req: any) {
    const now       = new Date();
    const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1);
    const em30dias  = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const orgId = req.user?.organizationId;
    const ow = orgId ? { organizationId: orgId } as any : {};

    const [
      // chamados
      chamAbertos, chamUrgentes, chamHoje, chamEmAtend,
      chamResolvidosMes, chamSlaViolados, chamCsat,
      // projetos
      projAtivos, projConclMes,
      // ativos
      ativoTotal, ativoManut,
      // contratos
      contratoRows,
      // horas
      horasMes,
      // conhecimento
      artigoTotal, artigoViews,
    ] = await Promise.all([
      this.prisma.chamado.count({ where: { status: { in: ["aberto","em_atendimento","aguardando"] }, ...ow } }),
      this.prisma.chamado.count({ where: { status: { in: ["aberto","em_atendimento"] }, prioridade: "urgente", ...ow } }),
      this.prisma.chamado.count({ where: { criadoEm: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) }, ...ow } }),
      this.prisma.chamado.count({ where: { status: "em_atendimento", ...ow } }),
      this.prisma.chamado.count({ where: { status: { in: ["resolvido","fechado"] }, resolvidoEm: { gte: mesInicio }, ...ow } }),
      this.db.chamado.count({ where: { slaResolucaoAt: { lt: now }, status: { notIn: ["resolvido","fechado","cancelado"] }, ...ow } }),
      this.db.chamado.aggregate({ _avg: { avaliacao: true }, _count: { avaliacao: true }, where: { avaliacao: { not: null }, atualizadoEm: { gte: mesInicio }, ...ow } }),
      this.prisma.project.count({ where: { status: { in: ["PLANEJAMENTO","EM_ANDAMENTO"] }, ...ow } }),
      this.prisma.project.count({ where: { status: "CONCLUIDO", atualizadoEm: { gte: mesInicio }, ...ow } }),
      this.db.ativo.count({ where: { status: "ativo", ...ow } }),
      this.db.ativo.count({ where: { status: "em_manutencao", ...ow } }),
      this.db.contrato.findMany({ where: { ativo: true, ...ow }, select: { status: true, vigenciaFim: true, valor: true } }),
      this.db.apontamentoHoras.aggregate({ _sum: { minutos: true }, _count: { id: true }, where: { data: { gte: mesInicio }, ...ow } }),
      this.db.artigoConhecimento.count({ where: { status: "publicado", ...ow } }),
      this.db.artigoConhecimento.aggregate({ _sum: { visualizacoes: true }, where: { ...ow } }),
    ]);

    // contratos computed
    const cVigentes   = contratoRows.filter((c: any) => { const d = c.vigenciaFim ? new Date(c.vigenciaFim) : null; return !d || d > em30dias; }).length;
    const cVencendo   = contratoRows.filter((c: any) => { const d = c.vigenciaFim ? new Date(c.vigenciaFim) : null; return d && d > now && d <= em30dias; }).length;
    const cVencidos   = contratoRows.filter((c: any) => { const d = c.vigenciaFim ? new Date(c.vigenciaFim) : null; return d && d <= now; }).length;
    const cValorTotal = contratoRows.reduce((s: number, c: any) => s + (c.valor || 0), 0);

    // ativos garantia
    const ativosGarantia = await this.db.ativo.findMany({ where: { dataGarantiaFim: { not: null }, status: { not: "descartado" }, ...ow }, select: { dataGarantiaFim: true } });
    const gaRisco   = ativosGarantia.filter((a: any) => { const d = new Date(a.dataGarantiaFim); return d > now && d <= em30dias; }).length;
    const gaVencida = ativosGarantia.filter((a: any) => new Date(a.dataGarantiaFim) <= now).length;

    // SLA compliance
    const chamFechados = await this.prisma.chamado.count({ where: { status: { in: ["resolvido","fechado"] }, criadoEm: { gte: mesInicio }, ...ow } });
    const slaCompliancePct = chamFechados > 0
      ? Math.round(((chamFechados - Math.min(chamSlaViolados, chamFechados)) / chamFechados) * 100)
      : 100;

    return {
      chamados: {
        abertos: chamAbertos, urgentes: chamUrgentes, hoje: chamHoje,
        emAtendimento: chamEmAtend, resolvidosMes: chamResolvidosMes,
        slaViolados: chamSlaViolados, slaCompliancePct,
        csatMedia:  Math.round(((chamCsat._avg.avaliacao || 0)) * 10) / 10,
        csatTotal:  chamCsat._count.avaliacao,
      },
      projetos:     { ativos: projAtivos, concluidosMes: projConclMes },
      ativos:       { total: ativoTotal, emManutencao: ativoManut, garantiaRisco: gaRisco, garantiaVencida: gaVencida },
      contratos:    { total: contratoRows.length, vigentes: cVigentes, vencendo: cVencendo, vencidos: cVencidos, valorTotal: cValorTotal },
      horas:        { totalMinutos: horasMes._sum.minutos || 0, totalRegistros: horasMes._count.id },
      conhecimento: { artigos: artigoTotal, visualizacoes: artigoViews._sum.visualizacoes || 0 },
    };
  }

  @Get("dashboard")
  async dashboard(@Req() req: any) {
    const userId = req.user.id;
    const orgId = req.user?.organizationId;
    const ow = orgId ? { organizationId: orgId } as any : {};
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    const em30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const em2h = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const ha14 = new Date(hoje.getTime() - 13 * 24 * 60 * 60 * 1000);
    const mesInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    const [
      totalUsuarios,
      usuariosAtivos,
      totalProjetos,
      projetosAtivos,
      totalTasks,
      tasksConcluidas,
      tasksHoje,
      totalEventos,
      eventosHoje,
      totalNotas,
      ultimosUsuarios,
      chamAbertos,
      chamUrgentes,
      chamSlaRisco,
      contratosVencendo,
      csatMedia,
      chamRecentes14d,
      ativRecentes,
    ] = await Promise.all([
      this.prisma.user.count({ where: { ...ow } }),
      this.prisma.user.count({ where: { ativo: true, ...ow } }),
      this.prisma.project.count({ where: { members: { some: { userId } }, ...ow } }),
      this.prisma.project.count({ where: { members: { some: { userId } }, status: { in: ["PLANEJAMENTO", "EM_ANDAMENTO"] }, ...ow } }),
      this.prisma.task.count({ where: { project: { members: { some: { userId } }, ...ow } } }),
      this.prisma.task.count({ where: { project: { members: { some: { userId } }, ...ow }, status: "CONCLUIDA" } }),
      this.prisma.dailyTask.count({ where: { userId, data: { gte: hoje, lt: amanha } } }),
      this.prisma.event.count({ where: { userId } }),
      this.prisma.event.count({ where: { userId, inicio: { gte: hoje, lt: amanha } } }),
      this.prisma.note.count({ where: { userId, arquivado: false, lixeira: false } }),
      this.prisma.user.findMany({
        where: { ativo: true, ...ow },
        orderBy: { criadoEm: "desc" },
        take: 5,
        select: { id: true, nome: true, email: true, criadoEm: true, ultimoLogin: true },
      }),
      this.db.chamado.count({ where: { status: { in: ["aberto","em_atendimento","aguardando"] }, ...ow } }),
      this.db.chamado.count({ where: { prioridade: "urgente", status: { in: ["aberto","em_atendimento"] }, ...ow } }),
      this.db.chamado.count({ where: { slaResolucaoAt: { not: null, lt: em2h }, status: { notIn: ["resolvido","fechado","cancelado"] }, ...ow } }),
      this.db.contrato.count({ where: { ativo: true, vigenciaFim: { gte: new Date(), lte: em30 }, ...ow } }),
      this.db.chamado.aggregate({ _avg: { avaliacao: true }, where: { avaliacao: { not: null }, criadoEm: { gte: mesInicio }, ...ow } }),
      this.db.chamado.findMany({ where: { criadoEm: { gte: ha14 }, ...ow }, select: { criadoEm: true } }),
      this.db.chamado.findMany({
        take: 6,
        where: { ...ow },
        orderBy: { atualizadoEm: "desc" },
        select: {
          id: true, numero: true, titulo: true, status: true, prioridade: true, atualizadoEm: true,
          cliente: { select: { nome: true, empresa: true } },
        },
      }),
    ]);

    // chamados por dia (14 dias)
    const days: Record<string, number> = {};
    for (let i = 0; i < 14; i++) {
      const d = new Date(ha14.getTime() + i * 24 * 60 * 60 * 1000);
      days[d.toISOString().slice(0, 10)] = 0;
    }
    for (const c of chamRecentes14d) {
      const d = new Date(c.criadoEm).toISOString().slice(0, 10);
      if (d in days) days[d]++;
    }
    const chamadosPorDia = Object.entries(days).map(([data, total]) => ({ data, total }));

    return {
      usuarios: { total: totalUsuarios, ativos: usuariosAtivos, ultimos: ultimosUsuarios },
      projetos: { total: totalProjetos, ativos: projetosAtivos },
      tasks: { total: totalTasks, concluidas: tasksConcluidas, hoje: tasksHoje, progresso: totalTasks > 0 ? Math.round((tasksConcluidas / totalTasks) * 100) : 0 },
      eventos: { total: totalEventos, hoje: eventosHoje },
      notas: { total: totalNotas },
      chamados: { abertos: chamAbertos, urgentes: chamUrgentes, slaRisco: chamSlaRisco },
      contratos: { vencendo30: contratosVencendo },
      csat: { media: Math.round(((csatMedia._avg.avaliacao || 0)) * 10) / 10 },
      chamadosPorDia,
      ativRecentes,
    };
  }

  // GET /stats/search?q=...
  @Get("search")
  async search(@Req() req: any, @Query("q") q: string) {
    if (!q || q.trim().length < 2) return { chamados: [], clientes: [], contratos: [], faturas: [], artigos: [], projetos: [], ativos: [], usuarios: [] };
    const s = q.trim();
    const orgId = req.user?.organizationId;
    const ow = orgId ? { organizationId: orgId } as any : {};
    const [chamados, clientes, contratos, faturas, artigos, projetos, ativos, usuarios] = await Promise.all([
      this.db.chamado.findMany({
        where: { OR: [{ titulo: { contains: s, mode: "insensitive" } }, { descricao: { contains: s, mode: "insensitive" } }], ...ow },
        take: 5, select: { id: true, numero: true, titulo: true, status: true, prioridade: true },
      }),
      this.db.cliente.findMany({
        where: { ativo: true, OR: [{ nome: { contains: s, mode: "insensitive" } }, { empresa: { contains: s, mode: "insensitive" } }], ...ow },
        take: 5, select: { id: true, nome: true, empresa: true },
      }),
      this.db.contrato.findMany({
        where: { ativo: true, OR: [{ titulo: { contains: s, mode: "insensitive" } }, { plano: { contains: s, mode: "insensitive" } }], ...ow },
        take: 5, select: { id: true, numero: true, titulo: true, status: true, cliente: { select: { nome: true } } },
      }),
      this.db.fatura.findMany({
        where: { OR: [{ descricao: { contains: s, mode: "insensitive" } }, { observacoes: { contains: s, mode: "insensitive" } }], ...ow },
        take: 5, select: { id: true, numero: true, descricao: true, valor: true, status: true, cliente: { select: { nome: true } } },
      }),
      this.db.artigoConhecimento.findMany({
        where: { status: "publicado", OR: [{ titulo: { contains: s, mode: "insensitive" } }, { resumo: { contains: s, mode: "insensitive" } }], ...ow },
        take: 5, select: { id: true, titulo: true, slug: true, resumo: true },
      }),
      this.db.project.findMany({
        where: { OR: [{ nome: { contains: s, mode: "insensitive" } }, { descricao: { contains: s, mode: "insensitive" } }], ...ow },
        take: 5, select: { id: true, nome: true, status: true, prioridade: true },
      }),
      this.db.ativo.findMany({
        where: { OR: [{ nome: { contains: s, mode: "insensitive" } }, { codigo: { contains: s, mode: "insensitive" } }], ...ow },
        take: 5, select: { id: true, nome: true, codigo: true, status: true, tipo: true },
      }),
      this.db.user.findMany({
        where: { ativo: true, OR: [{ nome: { contains: s, mode: "insensitive" } }, { email: { contains: s, mode: "insensitive" } }], ...ow },
        take: 5, select: { id: true, nome: true, email: true },
      }),
    ]);
    return { chamados, clientes, contratos, faturas, artigos, projetos, ativos, usuarios };
  }
}

@Module({ controllers: [StatsController], providers: [PrismaService] })
export class StatsModule {}