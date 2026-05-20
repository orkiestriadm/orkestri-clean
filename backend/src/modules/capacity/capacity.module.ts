import {
  Module, Controller, Get, Query, Param, UseGuards, Req, Injectable, BadRequestException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../../prisma/prisma.service";
import { AusenciasModule, AusenciasService } from "../ausencias/ausencias.module";

// Defaults para casos sem estimativa
const DEFAULT_CHAMADO_HORAS = 2;
const DEFAULT_TASK_HORAS = 1;

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date)   { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }

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

function parsePeriod(from?: string, to?: string): { from: Date; to: Date } {
  if (from && to) {
    const f = new Date(from); const t = new Date(to);
    if (isNaN(+f) || isNaN(+t)) throw new BadRequestException("Datas inválidas");
    return { from: startOfDay(f), to: endOfDay(t) };
  }
  const now = new Date();
  return {
    from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
    to:   endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

@Injectable()
export class CapacityService {
  constructor(private prisma: PrismaService, private ausencias: AusenciasService) {}

  /**
   * Calcula nominal descontando dias de ausência aprovada.
   * @returns { nominal, diasAusentes, horasAusentes }
   */
  private async computeNominal(user: any, from: Date, to: Date, userId: string, jornadaDia: number, businessDays: number) {
    const absentMap = await this.ausencias.getAbsentDaysByUser(user, from, to, [userId]);
    const entry = absentMap.get(userId);
    const diasAusentes = entry?.days.size || 0;
    let horasParciaisAusentes = 0;
    if (entry?.horasDeduzidas) {
      for (const [, h] of entry.horasDeduzidas) horasParciaisAusentes += h;
    }
    const bizDiasEfetivos = Math.max(0, businessDays - diasAusentes);
    const nominal = Math.max(0, bizDiasEfetivos * jornadaDia - horasParciaisAusentes);
    return { nominal, diasAusentes, horasAusentes: diasAusentes * jornadaDia + horasParciaisAusentes };
  }

  private orgScope(user: any) {
    return user?.organizationId ? { organizationId: user.organizationId } : {};
  }

  /** Realizado: minutos apontados por colaborador no período */
  async getRealized(user: any, from: Date, to: Date, userIds?: string[]) {
    const where: any = {
      ...this.orgScope(user),
      data: { gte: from, lte: to },
    };
    if (userIds?.length) where.userId = { in: userIds };
    const rows = await (this.prisma as any).apontamentoHoras.groupBy({
      by: ["userId"],
      where,
      _sum: { minutos: true },
    });
    return new Map<string, number>(rows.map((r: any) => [r.userId, (r._sum.minutos || 0) / 60]));
  }

  /** Realizado por dia (para heatmap) */
  async getRealizedByDay(user: any, from: Date, to: Date, userIds?: string[]) {
    const where: any = {
      ...this.orgScope(user),
      data: { gte: from, lte: to },
    };
    if (userIds?.length) where.userId = { in: userIds };
    const rows = await (this.prisma as any).apontamentoHoras.findMany({
      where, select: { userId: true, data: true, minutos: true },
    });
    const map = new Map<string, Map<string, number>>(); // userId -> dateISO -> hours
    rows.forEach((r: any) => {
      const dateKey = r.data.toISOString().slice(0, 10);
      if (!map.has(r.userId)) map.set(r.userId, new Map());
      const inner = map.get(r.userId)!;
      inner.set(dateKey, (inner.get(dateKey) || 0) + (r.minutos / 60));
    });
    return map;
  }

  /** Planejado: chamados abertos + tasks ativas atribuídas no período */
  async getPlanned(user: any, from: Date, to: Date, userIds?: string[]) {
    const result = new Map<string, number>();

    // Chamados: status != fechado/cancelado, criados antes do fim do período, atendente definido
    const chamadosWhere: any = {
      ...this.orgScope(user),
      status: { notIn: ["fechado", "cancelado"] },
      atendenteId: userIds?.length ? { in: userIds } : { not: null },
      criadoEm: { lte: to },
    };
    const chamados = await (this.prisma as any).chamado.findMany({
      where: chamadosWhere,
      select: { atendenteId: true, horasEstimadas: true, slaHoras: true },
    });
    chamados.forEach((c: any) => {
      if (!c.atendenteId) return;
      const h = c.horasEstimadas ?? c.slaHoras ?? DEFAULT_CHAMADO_HORAS;
      result.set(c.atendenteId, (result.get(c.atendenteId) || 0) + h);
    });

    // Tasks: status != concluída, dataVencimento entre from..to ou null
    const tasksWhere: any = {
      assigneeId: userIds?.length ? { in: userIds } : { not: null },
      status: { not: "CONCLUIDA" },
      OR: [
        { dataVencimento: { gte: from, lte: to } },
        { dataVencimento: null },
      ],
      project: this.orgScope(user) as any,
    };
    const tasks = await (this.prisma as any).task.findMany({
      where: tasksWhere,
      select: { assigneeId: true, horasEstimadas: true },
    });
    tasks.forEach((t: any) => {
      if (!t.assigneeId) return;
      const h = t.horasEstimadas ?? DEFAULT_TASK_HORAS;
      result.set(t.assigneeId, (result.get(t.assigneeId) || 0) + h);
    });

    return result;
  }

  async getCollaboratorCapacity(user: any, collabId: string, from?: string, to?: string) {
    const { from: f, to: t } = parsePeriod(from, to);
    const collab = await (this.prisma as any).collaborator.findFirst({
      where: { id: collabId, ...this.orgScope(user) },
      include: { user: { select: { id: true, nome: true, email: true } } },
    });
    if (!collab) throw new BadRequestException("Colaborador não encontrado");

    const realized = await this.getRealized(user, f, t, [collab.userId]);
    const planned  = await this.getPlanned(user, f, t, [collab.userId]);
    const realizedByDay = await this.getRealizedByDay(user, f, t, [collab.userId]);

    const businessDays = businessDaysBetween(f, t);
    const jornadaDia = collab.jornadaHorasDia || 8;
    const { nominal: capacidadeTotal, diasAusentes, horasAusentes } = await this.computeNominal(user, f, t, collab.userId, jornadaDia, businessDays);
    const realizedHoras = realized.get(collab.userId) || 0;
    const plannedHoras  = planned.get(collab.userId) || 0;

    const days: any[] = [];
    const cur = new Date(f);
    while (cur <= t) {
      const dateKey = cur.toISOString().slice(0, 10);
      const horas = realizedByDay.get(collab.userId)?.get(dateKey) || 0;
      const isBiz = cur.getDay() !== 0 && cur.getDay() !== 6;
      days.push({
        date: dateKey,
        horas: Number(horas.toFixed(2)),
        capacidadeDia: isBiz ? jornadaDia : 0,
        util: isBiz && jornadaDia > 0 ? Number((horas / jornadaDia * 100).toFixed(1)) : 0,
      });
      cur.setDate(cur.getDate() + 1);
    }

    return {
      collaborator: {
        id: collab.id, userId: collab.userId, nome: collab.user.nome,
        cargo: collab.cargo, jornadaHorasDia: jornadaDia,
      },
      period: { from: f.toISOString(), to: t.toISOString(), businessDays },
      capacity: {
        nominal: Number(capacidadeTotal.toFixed(2)),
        realizado: Number(realizedHoras.toFixed(2)),
        planejado: Number(plannedHoras.toFixed(2)),
        utilizacaoRealizado: capacidadeTotal > 0 ? Number((realizedHoras / capacidadeTotal * 100).toFixed(1)) : 0,
        utilizacaoPlanejado: capacidadeTotal > 0 ? Number((plannedHoras / capacidadeTotal * 100).toFixed(1)) : 0,
        diasAusentes,
        horasAusentes: Number(horasAusentes.toFixed(2)),
      },
      days,
    };
  }

  async getHeatmap(user: any, from?: string, to?: string, setorId?: string) {
    const { from: f, to: t } = parsePeriod(from, to);
    const collabsWhere: any = { ...this.orgScope(user), ativo: true };
    if (setorId) collabsWhere.setorId = setorId;
    const collabs = await (this.prisma as any).collaborator.findMany({
      where: collabsWhere,
      include: {
        user:  { select: { id: true, nome: true } },
        setor: { select: { id: true, nome: true, cor: true } },
      },
      orderBy: { criadoEm: "asc" },
    });
    const userIds = collabs.map((c: any) => c.userId);

    const realized        = await this.getRealized(user, f, t, userIds);
    const realizedByDay   = await this.getRealizedByDay(user, f, t, userIds);
    const planned         = await this.getPlanned(user, f, t, userIds);
    const absentMap       = await this.ausencias.getAbsentDaysByUser(user, f, t, userIds);
    const businessDays    = businessDaysBetween(f, t);

    const days: string[] = [];
    const cur = new Date(f);
    while (cur <= t) { days.push(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1); }

    const rows = collabs.map((c: any) => {
      const jornadaDia = c.jornadaHorasDia || 8;
      const ausenteData = absentMap.get(c.userId);
      const diasAusentes = ausenteData?.days.size || 0;
      const nominal = Math.max(0, (businessDays - diasAusentes) * jornadaDia);
      const r = realized.get(c.userId) || 0;
      const p = planned.get(c.userId)  || 0;
      const inner = realizedByDay.get(c.userId);
      const cells = days.map(d => {
        const h = inner?.get(d) || 0;
        const dt = new Date(d + "T00:00:00");
        const isBiz = dt.getDay() !== 0 && dt.getDay() !== 6;
        const isAusente = ausenteData?.days.has(d) || false;
        return {
          date: d,
          horas: Number(h.toFixed(2)),
          util: isBiz && jornadaDia > 0 ? Number((h / jornadaDia * 100).toFixed(1)) : 0,
          biz: isBiz,
          ausente: isAusente,
        };
      });
      return {
        collaborator: { id: c.id, userId: c.userId, nome: c.user.nome, cargo: c.cargo, setor: c.setor },
        nominal: Number(nominal.toFixed(2)),
        realizado: Number(r.toFixed(2)),
        planejado: Number(p.toFixed(2)),
        diasAusentes,
        utilRealizado: nominal > 0 ? Number((r / nominal * 100).toFixed(1)) : 0,
        utilPlanejado: nominal > 0 ? Number((p / nominal * 100).toFixed(1)) : 0,
        cells,
      };
    });

    return {
      period: { from: f.toISOString(), to: t.toISOString(), businessDays, days },
      rows,
    };
  }

  async getSummary(user: any, period?: string) {
    const now = new Date();
    let from: Date, to: Date;
    if (period === "semana") {
      const d = now.getDay();
      const diff = d === 0 ? -6 : 1 - d; // segunda como início
      from = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff));
      to   = endOfDay(new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6));
    } else {
      from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      to   = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    }
    const collabs = await (this.prisma as any).collaborator.findMany({
      where: { ...this.orgScope(user), ativo: true },
      include: { user: { select: { id: true, nome: true } }, setor: { select: { id: true, nome: true } } },
    });
    const userIds = collabs.map((c: any) => c.userId);
    const realized = await this.getRealized(user, from, to, userIds);
    const planned  = await this.getPlanned(user, from, to, userIds);
    const absentMap = await this.ausencias.getAbsentDaysByUser(user, from, to, userIds);
    const bd = businessDaysBetween(from, to);

    let totalNominal = 0, totalRealizado = 0, totalPlanejado = 0;
    const detalhes: any[] = [];
    let sobrecarregados = 0, subutilizados = 0, ausentesHoje = 0;
    const hojeISO = new Date().toISOString().slice(0, 10);
    for (const c of collabs) {
      const jornadaDia = c.jornadaHorasDia || 8;
      const absent = absentMap.get(c.userId);
      const diasAusentes = absent?.days.size || 0;
      const nominal = Math.max(0, (bd - diasAusentes) * jornadaDia);
      const r = realized.get(c.userId) || 0;
      const p = planned.get(c.userId)  || 0;
      totalNominal += nominal; totalRealizado += r; totalPlanejado += p;
      const utilR = nominal > 0 ? (r / nominal * 100) : 0;
      const utilP = nominal > 0 ? (p / nominal * 100) : 0;
      if (utilP > 90) sobrecarregados++;
      if (utilR < 50) subutilizados++;
      if (absent?.days.has(hojeISO)) ausentesHoje++;
      detalhes.push({
        id: c.id, nome: c.user.nome, setor: c.setor?.nome,
        nominal, realizado: r, planejado: p, diasAusentes,
        utilR: Number(utilR.toFixed(1)), utilP: Number(utilP.toFixed(1)),
      });
    }
    detalhes.sort((a, b) => b.utilP - a.utilP);
    return {
      period: { from: from.toISOString(), to: to.toISOString(), businessDays: bd, label: period === "semana" ? "Semana atual" : "Mês corrente" },
      org: {
        colaboradoresAtivos: collabs.length,
        nominal: Number(totalNominal.toFixed(2)),
        realizado: Number(totalRealizado.toFixed(2)),
        planejado: Number(totalPlanejado.toFixed(2)),
        utilRealizado: totalNominal > 0 ? Number((totalRealizado / totalNominal * 100).toFixed(1)) : 0,
        utilPlanejado: totalNominal > 0 ? Number((totalPlanejado / totalNominal * 100).toFixed(1)) : 0,
        sobrecarregados, subutilizados, ausentesHoje,
      },
      top5Carregados: detalhes.slice(0, 5),
      top5Disponiveis: [...detalhes].sort((a, b) => a.utilP - b.utilP).slice(0, 5),
    };
  }
}

@Controller("capacity")
@UseGuards(AuthGuard("jwt"))
export class CapacityController {
  constructor(private svc: CapacityService) {}

  @Get("summary")
  summary(@Req() req: any, @Query("period") period?: string) {
    return this.svc.getSummary(req.user, period);
  }

  @Get("heatmap")
  heatmap(@Req() req: any, @Query("from") from?: string, @Query("to") to?: string, @Query("setorId") setorId?: string) {
    return this.svc.getHeatmap(req.user, from, to, setorId);
  }

  @Get("collaborator/:id")
  one(@Req() req: any, @Param("id") id: string, @Query("from") from?: string, @Query("to") to?: string) {
    return this.svc.getCollaboratorCapacity(req.user, id, from, to);
  }
}

@Module({
  imports: [AusenciasModule],
  controllers: [CapacityController],
  providers: [CapacityService],
  exports: [CapacityService],
})
export class CapacityModule {}
