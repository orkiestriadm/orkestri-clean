import { Module, Controller, Get, UseGuards, Req, Query } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Números da Visão Geral e da busca global.
 *
 * Na redução de escopo de 18/10/2026 este controller perdeu `GET
 * /stats/executivo` — o painel Executivo que o consumia saiu junto com os
 * módulos de onde ele lia (chamados, ativos, contratos, horas e
 * conhecimento). `/stats/dashboard` e `/stats/search` ficaram, e foram
 * reescritos para ler só de Projects, Space e Finance.
 */
@Controller("stats")
@UseGuards(AuthGuard("jwt"))
class StatsController {
  constructor(private prisma: PrismaService) {}
  private get db() { return this.prisma as any; }

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
    const ha14 = new Date(hoje.getTime() - 13 * 24 * 60 * 60 * 1000);
    const mesInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    const [
      totalUsuarios,
      usuariosAtivos,
      totalProjetos,
      projetosAtivos,
      projetosConcluidosMes,
      totalTasks,
      tasksConcluidas,
      tasksAtrasadas,
      tasksHoje,
      totalEventos,
      eventosHoje,
      totalNotas,
      ultimosUsuarios,
      contasVencendo,
      contasVencidas,
      tasksConcluidas14d,
      tarefasRecentes,
    ] = await Promise.all([
      this.prisma.user.count({ where: { ...ow } }),
      this.prisma.user.count({ where: { ativo: true, ...ow } }),
      this.prisma.project.count({ where: { members: { some: { userId } }, ...ow } }),
      this.prisma.project.count({ where: { members: { some: { userId } }, status: { in: ["PLANEJAMENTO", "EM_ANDAMENTO"] }, ...ow } }),
      this.prisma.project.count({ where: { members: { some: { userId } }, status: "CONCLUIDO", atualizadoEm: { gte: mesInicio }, ...ow } }),
      this.prisma.task.count({ where: { project: { members: { some: { userId } }, ...ow } } }),
      this.prisma.task.count({ where: { project: { members: { some: { userId } }, ...ow }, status: "CONCLUIDA" } }),
      this.prisma.task.count({
        where: {
          project: { members: { some: { userId } }, ...ow },
          status: { not: "CONCLUIDA" },
          dataVencimento: { not: null, lt: hoje },
        },
      }),
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
      // Contas a pagar em aberto: `dataPagamento` nulo é o que define "aberto".
      this.db.contaPagar.count({
        where: { ...ow, dataPagamento: null, dataVenctoReal: { not: null, gte: hoje, lte: em30 } },
      }).catch(() => 0),
      this.db.contaPagar.count({
        where: { ...ow, dataPagamento: null, dataVenctoReal: { not: null, lt: hoje } },
      }).catch(() => 0),
      // Série do gráfico: tarefas CONCLUÍDAS por dia nos últimos 14 dias.
      // `atualizadoEm` é o que temos — a tarefa não guarda data de conclusão.
      this.prisma.task.findMany({
        where: {
          project: { members: { some: { userId } }, ...ow },
          status: "CONCLUIDA",
          atualizadoEm: { gte: ha14 },
        },
        select: { atualizadoEm: true },
      }),
      this.prisma.task.findMany({
        take: 6,
        where: { project: { members: { some: { userId } }, ...ow } },
        orderBy: { atualizadoEm: "desc" },
        select: {
          id: true, titulo: true, status: true, prioridade: true, atualizadoEm: true,
          projectId: true,
          project: { select: { titulo: true } },
        },
      }),
    ]);

    // Tarefas concluídas por dia (14 dias)
    const days: Record<string, number> = {};
    for (let i = 0; i < 14; i++) {
      const d = new Date(ha14.getTime() + i * 24 * 60 * 60 * 1000);
      days[d.toISOString().slice(0, 10)] = 0;
    }
    for (const t of tasksConcluidas14d) {
      const d = new Date(t.atualizadoEm).toISOString().slice(0, 10);
      if (d in days) days[d]++;
    }
    const tarefasPorDia = Object.entries(days).map(([data, total]) => ({ data, total }));

    // Itens de orçamento estourados no mês corrente. Vai separado do
    // Promise.all porque depende dos ciclos da organização.
    let orcamentoEstourados = 0;
    try {
      const ciclos = await this.db.orcamentoCiclo.findMany({
        where: { ...ow, ano: hoje.getFullYear() }, select: { id: true },
      });
      if (ciclos.length) {
        const meses = await this.db.itemOrcamentoMes.findMany({
          where: {
            mes: hoje.getMonth() + 1,
            valorPrevisto: { gt: 0 },
            item: { cicloId: { in: ciclos.map((c: any) => c.id) }, status: { not: "cancelado" } },
          },
          select: { valorPrevisto: true, valorRealizado: true },
        });
        orcamentoEstourados = meses.filter(
          (m: any) => m.valorRealizado != null && Number(m.valorRealizado) > Number(m.valorPrevisto),
        ).length;
      }
    } catch {}

    return {
      usuarios: { total: totalUsuarios, ativos: usuariosAtivos, ultimos: ultimosUsuarios },
      projetos: { total: totalProjetos, ativos: projetosAtivos, concluidosMes: projetosConcluidosMes },
      tasks: {
        total: totalTasks, concluidas: tasksConcluidas, atrasadas: tasksAtrasadas, hoje: tasksHoje,
        progresso: totalTasks > 0 ? Math.round((tasksConcluidas / totalTasks) * 100) : 0,
      },
      eventos: { total: totalEventos, hoje: eventosHoje },
      notas: { total: totalNotas },
      financeiro: { contasVencendo30: contasVencendo, contasVencidas },
      orcamento: { itensEstourados: orcamentoEstourados },
      tarefasPorDia,
      tarefasRecentes,
    };
  }

  // GET /stats/search?q=...
  @Get("search")
  async search(@Req() req: any, @Query("q") q: string) {
    if (!q || q.trim().length < 2) return { projetos: [], tarefas: [], usuarios: [] };
    const s = q.trim();
    const orgId = req.user?.organizationId;
    const ow = orgId ? { organizationId: orgId } as any : {};
    const [projetos, tarefas, usuarios] = await Promise.all([
      this.db.project.findMany({
        where: { OR: [{ titulo: { contains: s, mode: "insensitive" } }, { descricao: { contains: s, mode: "insensitive" } }], ...ow },
        take: 5, select: { id: true, titulo: true, status: true, prioridade: true },
      }),
      this.db.task.findMany({
        where: {
          project: { ...ow },
          OR: [{ titulo: { contains: s, mode: "insensitive" } }, { descricao: { contains: s, mode: "insensitive" } }],
        },
        take: 5,
        select: { id: true, titulo: true, status: true, prioridade: true, projectId: true, project: { select: { titulo: true } } },
      }),
      this.db.user.findMany({
        where: { ativo: true, OR: [{ nome: { contains: s, mode: "insensitive" } }, { email: { contains: s, mode: "insensitive" } }], ...ow },
        take: 5, select: { id: true, nome: true, email: true },
      }),
    ]);
    return { projetos, tarefas, usuarios };
  }
}

@Module({ controllers: [StatsController] })
export class StatsModule {}
