import { MARCA } from "../../common/marca";
import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { EmailService } from "../notifications/email.service";
import { janelaManutencao, janelaRevisao } from "./frota-datas";
import {
  farolDoVeiculo, osDeterminante, osEstaAberta, contarFarois,
  FAROL_LABELS, FarolOperacional, foraDaFrota,
} from "./frota-status";

/** Teto de linhas devolvidas por relatório. Acima disso a resposta vem marcada
 *  com `truncado: true` para a tela avisar o usuário em vez de mentir. */
const MAX_LINHAS = 5000;

type Col = { header: string; get: (l: any) => any };
type ReportDef = { titulo: string; cols: Col[] };

// ── Formatadores compartilhados por CSV / XLSX / PDF / HTML ────────────────────
const fmtData = (v: any) => (v ? new Date(v).toLocaleDateString("pt-BR") : "");
const num = (v: any) => Number(v || 0);

/** Escapa HTML para interpolação segura no corpo do e-mail. */
function escapeHtml(v: any): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Neutraliza fórmulas (CSV injection) e aplica aspas do CSV. */
function csvCell(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v).replace(".", ",");
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

@Injectable()
export class FrotaRelatoriosService {
  private readonly logger = new Logger(FrotaRelatoriosService.name);

  constructor(private prisma: PrismaService, private email: EmailService) {}
  private get db() { return this.prisma as any; }

  /** Converte "YYYY-MM-DD" em meia-noite LOCAL (não UTC). `new Date("2026-07-01")`
   *  seria 30/06 21:00 em America/Sao_Paulo e puxaria o dia anterior para dentro
   *  do filtro. */
  private diaLocal(s: string, fimDoDia = false): Date {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s).trim());
    const d = m
      ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
      : new Date(s);
    if (fimDoDia) d.setHours(23, 59, 59, 999);
    else d.setHours(0, 0, 0, 0);
    return d;
  }

  private periodo(from?: string, to?: string) {
    const range: any = {};
    if (from) range.gte = this.diaLocal(from);
    if (to) range.lte = this.diaLocal(to, true);
    return Object.keys(range).length ? range : undefined;
  }

  /** Corta a lista no teto e sinaliza truncamento.
   *  As consultas usam `take: MAX_LINHAS + 1`, então o tamanho da lista é só um
   *  piso quando estoura — `contar` refaz a contagem exata nesse caso (raro). */
  private async limitar(linhas: any[], contar?: () => Promise<number>) {
    if (linhas.length <= MAX_LINHAS) {
      return { linhas, truncado: false, totalLinhas: linhas.length };
    }
    const total = contar ? await contar() : linhas.length;
    return { linhas: linhas.slice(0, MAX_LINHAS), truncado: true, totalLinhas: total };
  }

  async custos(orgId: string, from?: string, to?: string, veiculoId?: string) {
    const per = this.periodo(from, to);
    const baseV: any = { organizationId: orgId, deletedAt: null, ...(veiculoId ? { veiculoId } : {}) };

    const [manut, abast, veiculos] = await Promise.all([
      this.db.manutencaoVeiculo.groupBy({ by: ["veiculoId"], _sum: { custo: true }, _count: true, where: { ...baseV, ...janelaManutencao(per) } }),
      this.db.abastecimento.groupBy({ by: ["veiculoId"], _sum: { valorTotal: true, litros: true }, _count: true, where: { ...baseV, ...(per ? { data: per } : {}) } }),
      this.db.veiculo.findMany({ where: { organizationId: orgId, deletedAt: null, ...(veiculoId ? { id: veiculoId } : {}) }, select: { id: true, placa: true, codigo: true, modelo: true } }),
    ]);

    const linhas = veiculos.map((v: any) => {
      const m = (manut as any[]).find(x => x.veiculoId === v.id);
      const a = (abast as any[]).find(x => x.veiculoId === v.id);
      const custoManut = m?._sum.custo || 0;
      const custoAbast = a?._sum.valorTotal || 0;
      return {
        veiculo: v,
        custoManutencao: custoManut,
        custoAbastecimento: custoAbast,
        litros: a?._sum.litros || 0,
        totalManutencoes: m?._count || 0,
        totalAbastecimentos: a?._count || 0,
        custoTotal: custoManut + custoAbast,
      };
    }).sort((x: any, y: any) => y.custoTotal - x.custoTotal);

    const cut = await this.limitar(linhas);
    return {
      ...cut,
      totais: {
        custoManutencao: linhas.reduce((s: number, l: any) => s + l.custoManutencao, 0),
        custoAbastecimento: linhas.reduce((s: number, l: any) => s + l.custoAbastecimento, 0),
        custoTotal: linhas.reduce((s: number, l: any) => s + l.custoTotal, 0),
      },
    };
  }

  async veiculos(orgId: string, q: any) {
    const where: any = { organizationId: orgId, deletedAt: null };
    if (q.status) where.status = q.status;
    if (q.tipo) where.tipo = q.tipo;
    if (q.centroCusto) where.centroCusto = q.centroCusto;

    const rows = await this.db.veiculo.findMany({
      where,
      include: {
        motorista: { select: { nome: true } },
        categoria: { select: { nome: true } },
      },
      orderBy: { placa: "asc" },
      take: MAX_LINHAS + 1,
    });

    const statusCounts = await this.db.veiculo.groupBy({
      by: ["status"],
      _count: true,
      where: { organizationId: orgId, deletedAt: null },
    });

    const cut = await this.limitar(rows, () => this.db.veiculo.count({ where }));
    return {
      ...cut,
      totais: {
        total: cut.totalLinhas,
        status: Object.fromEntries(statusCounts.map((s: any) => [s.status, s._count])),
        kmTotal: rows.reduce((s: number, r: any) => s + (r.kmAtual || 0), 0),
      }
    };
  }

  async motoristas(orgId: string, q: any) {
    const where: any = { organizationId: orgId, deletedAt: null };
    if (q.status) where.status = q.status;

    const rows = await this.db.motorista.findMany({
      where,
      include: {
        veiculos: { select: { placa: true, modelo: true } },
      },
      orderBy: { nome: "asc" },
      take: MAX_LINHAS + 1,
    });

    const cut = await this.limitar(rows, () => this.db.motorista.count({ where }));
    return {
      ...cut,
      totais: {
        total: cut.totalLinhas,
        ativos: rows.filter((r: any) => r.status === "ativo").length,
      }
    };
  }

  async cnhs(orgId: string, q: any) {
    const where: any = { organizationId: orgId, deletedAt: null };

    const rows = await this.db.motorista.findMany({
      where,
      select: {
        id: true,
        nome: true,
        cpf: true,
        matricula: true,
        cnh: true,
        categoriaCnh: true,
        validadeCnh: true,
        status: true,
      },
      orderBy: { validadeCnh: "asc" },
      take: MAX_LINHAS + 1,
    });

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const em30 = new Date(hoje.getTime() + 30 * 86400000);

    const todas = rows.map((r: any) => {
      let farol = "verde";
      let statusCnh = "vigente";
      if (r.validadeCnh) {
        const val = new Date(r.validadeCnh);
        if (val < hoje) {
          farol = "vermelho";
          statusCnh = "vencida";
        } else if (val <= em30) {
          farol = "laranja";
          statusCnh = "vencendo_30";
        }
      } else {
        farol = "cinza";
        statusCnh = "sem_cnh";
      }
      return { ...r, farol, statusCnh };
    });

    // Os totais acompanham o filtro — antes a tabela filtrava mas os KPIs e o
    // gráfico continuavam somando o universo inteiro, e os números não batiam.
    const linhas = q.statusCnh ? todas.filter((l: any) => l.statusCnh === q.statusCnh) : todas;
    const contar = (s: string) => linhas.filter((l: any) => l.statusCnh === s).length;

    const cut = await this.limitar(linhas);
    return {
      ...cut,
      totais: {
        total: linhas.length,
        vencidas: contar("vencida"),
        vencendo30: contar("vencendo_30"),
        vigentes: contar("vigente"),
        semCnh: contar("sem_cnh"),
        universo: todas.length,
      }
    };
  }

  async pneus(orgId: string, q: any) {
    const where: any = { organizationId: orgId, deletedAt: null };
    if (q.status) where.status = q.status;
    if (q.veiculoId) where.veiculoId = q.veiculoId;

    const rows = await this.db.pneu.findMany({
      where,
      include: {
        veiculo: { select: { placa: true } },
      },
      orderBy: { numeroFogo: "asc" },
      take: MAX_LINHAS + 1,
    });

    const cut = await this.limitar(rows, () => this.db.pneu.count({ where }));
    return {
      ...cut,
      totais: {
        total: cut.totalLinhas,
        emUso: rows.filter((r: any) => r.status === "em_uso").length,
        estoque: rows.filter((r: any) => r.status === "estoque").length,
      }
    };
  }

  async historicoPneus(orgId: string, q: any) {
    const range = this.periodo(q.from, q.to);
    const where: any = { organizationId: orgId, ...(range ? { data: range } : {}) };
    if (q.tipo) where.tipo = q.tipo;
    if (q.pneuId) where.pneuId = q.pneuId;

    // `PneuEvento` guarda `veiculoId` como coluna solta — NÃO existe relação
    // `veiculo` no schema. O `include: { veiculo }` que estava aqui era inválido
    // e derrubava o relatório com erro do Prisma (500) em 100% das chamadas:
    // este relatório nunca funcionou.
    //
    // A correção é feita na consulta, e não no schema, de propósito: declarar a
    // relação criaria uma FOREIGN KEY nova, e a base de produção tem histórico
    // de linhas com FK quebrada. Um relatório não justifica esse risco.
    const rows = await this.db.pneuEvento.findMany({
      where,
      include: {
        pneu: { select: { id: true, numeroFogo: true, codigo: true, marca: true, modelo: true } },
      },
      orderBy: { data: "desc" },
      take: MAX_LINHAS + 1,
    });

    // Uma consulta só para todos os veículos citados, anexada em memória.
    const veiculoIds = [...new Set(rows.map((r: any) => r.veiculoId).filter(Boolean))];
    if (veiculoIds.length) {
      const veics = await this.db.veiculo.findMany({
        where: { id: { in: veiculoIds } },
        select: { id: true, placa: true },
      });
      const porId = new Map(veics.map((v: any) => [v.id, v]));
      for (const r of rows) r.veiculo = r.veiculoId ? porId.get(r.veiculoId) || null : null;
    } else {
      for (const r of rows) r.veiculo = null;
    }

    const cut = await this.limitar(rows, () => this.db.pneuEvento.count({ where }));
    return {
      ...cut,
      totais: {
        total: cut.totalLinhas,
        custoTotal: rows.reduce((s: number, r: any) => s + (r.custo || 0), 0),
      }
    };
  }

  async revisoes(orgId: string, q: any) {
    const range = this.periodo(q.from, q.to);
    const where: any = { organizationId: orgId, deletedAt: null, ...janelaRevisao(range) };
    if (q.status) where.status = q.status;
    if (q.veiculoId) where.veiculoId = q.veiculoId;

    const rows = await this.db.revisaoVeiculo.findMany({
      where,
      include: {
        veiculo: { select: { placa: true, modelo: true } },
      },
      orderBy: { dataPrevista: "asc" },
      take: MAX_LINHAS + 1,
    });

    const cut = await this.limitar(rows, () => this.db.revisaoVeiculo.count({ where }));
    return {
      ...cut,
      totais: {
        total: cut.totalLinhas,
        realizadas: rows.filter((r: any) => r.status === "realizada").length,
        agendadas: rows.filter((r: any) => r.status === "agendada").length,
        custoTotal: rows.reduce((s: number, r: any) => s + (r.custo || 0), 0),
      }
    };
  }

  async manutencoes(orgId: string, q: any) {
    const range = this.periodo(q.from, q.to);
    const where: any = { organizationId: orgId, deletedAt: null, ...janelaManutencao(range) };
    if (q.status) where.status = q.status;
    if (q.tipo) where.tipo = q.tipo;
    if (q.veiculoId) where.veiculoId = q.veiculoId;

    const rows = await this.db.manutencaoVeiculo.findMany({
      where,
      include: {
        veiculo: { select: { placa: true, modelo: true } },
        solicitante: { select: { nome: true } },
      },
      orderBy: [{ data: "desc" }, { dataAbertura: "desc" }],
      take: MAX_LINHAS + 1,
    });

    // `data` é opcional; a tela e os exports usam `dataEfetiva` para nunca exibir
    // linha sem data quando a OS tem apenas dataAbertura preenchida.
    const linhas = rows.map((r: any) => ({ ...r, dataEfetiva: r.data || r.dataAbertura || null }));

    const cut = await this.limitar(linhas, () => this.db.manutencaoVeiculo.count({ where }));
    return {
      ...cut,
      totais: {
        total: cut.totalLinhas,
        custoTotal: rows.reduce((s: number, r: any) => s + (r.custo || 0), 0),
        pecas: rows.reduce((s: number, r: any) => s + (r.custoPecas || 0), 0),
        servicos: rows.reduce((s: number, r: any) => s + (r.custoServicos || 0), 0),
      }
    };
  }

  async abastecimentos(orgId: string, q: any) {
    const range = this.periodo(q.from, q.to);
    const where: any = { organizationId: orgId, deletedAt: null };
    if (q.veiculoId) where.veiculoId = q.veiculoId;
    if (q.motoristaId) where.motoristaId = q.motoristaId;
    if (range) {
      where.data = range;
    }

    const rows = await this.db.abastecimento.findMany({
      where,
      include: {
        veiculo: { select: { placa: true, modelo: true } },
        motorista: { select: { nome: true } },
      },
      orderBy: { data: "desc" },
      take: MAX_LINHAS + 1,
    });

    const cons = rows.filter((r: any) => r.consumoKmL != null).map((r: any) => r.consumoKmL);
    const cKm = rows.filter((r: any) => r.custoKm != null).map((r: any) => r.custoKm);
    const avg = (arr: number[]) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0;

    const cut = await this.limitar(rows, () => this.db.abastecimento.count({ where }));
    return {
      ...cut,
      totais: {
        total: cut.totalLinhas,
        litros: rows.reduce((s: number, r: any) => s + (r.litros || 0), 0),
        custoTotal: rows.reduce((s: number, r: any) => s + (r.valorTotal || 0), 0),
        consumoMedio: Number(avg(cons).toFixed(2)),
        custoKmMedio: Number(avg(cKm).toFixed(3)),
      }
    };
  }

  async disponibilidade(orgId: string, q: any) {
    const fromDate = q.from ? this.diaLocal(q.from) : this.diaLocal(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
    const toDate = q.to ? this.diaLocal(q.to, true) : this.diaLocal(new Date().toISOString().slice(0, 10), true);

    const totalPeriodMs = Math.max(0, toDate.getTime() - fromDate.getTime());
    const totalPeriodDays = Math.max(1, Math.round(totalPeriodMs / 86400000));

    const veiculos = await this.db.veiculo.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: { id: true, placa: true, modelo: true, identificacao: true, status: true },
      orderBy: { placa: "asc" },
    });

    if (!veiculos.length) {
      return {
        linhas: [], truncado: false, totalLinhas: 0,
        totais: { total: 0, ativos: 0, indisponiveis: 0, dispMedia: 100, ...contarFarois([]) },
      };
    }

    // Filtro largo no banco; o recorte fino é feito em memória porque a data de
    // início efetiva depende de coalesce (dataAbertura → data → criadoEm), que o
    // Prisma não expressa no where. Sem isso, OS com dataAbertura NULL sumiam.
    const manutencoes = await this.db.manutencaoVeiculo.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        OR: [
          { dataFechamento: null },
          { dataFechamento: { gte: fromDate } }
        ]
      },
      select: {
        veiculoId: true,
        data: true,
        dataAbertura: true,
        dataFechamento: true,
        criadoEm: true,
        imobiliza: true,
        status: true,
      }
    });

    const agora = Date.now();
    const fimJanela = Math.min(toDate.getTime(), agora);

    // Intervalos de parada por veículo, já recortados na janela do relatório.
    const porVeiculo = new Map<string, Array<[number, number]>>();
    for (const m of manutencoes) {
      // Só OS imobilizante conta como indisponibilidade. Antes, qualquer OS
      // aberta derrubava a disponibilidade — inclusive a que registra um banco
      // rasgado num caminhão que segue rodando todo dia.
      if (m.imobiliza === false) continue;
      const inicioRaw = m.dataAbertura || m.data || m.criadoEm;
      if (!inicioRaw) continue;
      const ab = new Date(inicioRaw).getTime();
      const fc = m.dataFechamento ? new Date(m.dataFechamento).getTime() : agora;
      const start = Math.max(ab, fromDate.getTime());
      const end = Math.min(fc, fimJanela);
      if (end <= start) continue;
      if (!porVeiculo.has(m.veiculoId)) porVeiculo.set(m.veiculoId, []);
      porVeiculo.get(m.veiculoId)!.push([start, end]);
    }

    // Une intervalos sobrepostos: duas OS abertas ao mesmo tempo no mesmo veículo
    // contavam a parada em dobro e podiam levar a disponibilidade a 0%.
    const unir = (ivs: Array<[number, number]>) => {
      if (!ivs.length) return 0;
      ivs.sort((a, b) => a[0] - b[0]);
      let total = 0;
      let [ini, fim] = ivs[0];
      for (let i = 1; i < ivs.length; i++) {
        const [s, e] = ivs[i];
        if (s <= fim) {
          if (e > fim) fim = e;
        } else {
          total += fim - ini;
          ini = s; fim = e;
        }
      }
      return total + (fim - ini);
    };

    const linhas = veiculos.map((v: any) => {
      const downtimeMs = unir(porVeiculo.get(v.id) || []);
      const downtimeDays = Number((downtimeMs / 86400000).toFixed(2));
      const activeDays = Math.max(0, Number((totalPeriodDays - downtimeDays).toFixed(2)));
      const dispPct = totalPeriodDays ? Math.max(0, Math.min(100, Math.round((activeDays / totalPeriodDays) * 100))) : 100;

      return {
        veiculo: { id: v.id, placa: v.placa, modelo: v.modelo, identificacao: v.identificacao },
        diasTotais: totalPeriodDays,
        diasParado: downtimeDays,
        diasAtivo: activeDays,
        disponibilidade: dispPct,
        statusAtual: v.status,
      };
    });

    const dispMedia = Math.round(linhas.reduce((s: number, l: any) => s + l.disponibilidade, 0) / linhas.length);

    // Farol de AGORA junto do acumulado do período: a mesma tela responde
    // "como foi o mês" e "como está a frota neste momento".
    const abertasAgora = await this.db.manutencaoVeiculo.findMany({
      where: { organizationId: orgId, deletedAt: null, dataFechamento: null },
      select: { veiculoId: true, status: true, imobiliza: true },
    });
    const porVeiculoAgora = new Map<string, any[]>();
    for (const os of abertasAgora) {
      if (!osEstaAberta(os)) continue;
      if (!porVeiculoAgora.has(os.veiculoId)) porVeiculoAgora.set(os.veiculoId, []);
      porVeiculoAgora.get(os.veiculoId)!.push(os);
    }
    // Mesma escada de precedência do Farol da Frota, incluindo revisão vencida —
    // as duas telas não podem discordar sobre quantos veículos estão em atenção.
    const revisaoAtrasada = await this.veiculosComRevisaoAtrasada(orgId, veiculos.map((v: any) => v.id));
    const farois = veiculos.map((v: any) =>
      farolDoVeiculo(v, porVeiculoAgora.get(v.id) || [], { revisaoAtrasada: revisaoAtrasada.has(v.id) }).farol);

    const cut = await this.limitar(linhas);
    return {
      ...cut,
      totais: {
        total: veiculos.length,
        // `operando_com_avaria` é um veículo em operação: ele roda. Contá-lo
        // fora de "ativos" faria o KPI cair assim que alguém registrasse a
        // primeira avaria, dando a impressão de frota encolhendo.
        ativos: veiculos.filter((v: any) => v.status === "ativo" || v.status === "operando_com_avaria").length,
        indisponiveis: veiculos.filter((v: any) => v.status === "manutencao").length,
        dispMedia,
        ...contarFarois(farois),
      }
    };
  }

  /**
   * Veículos com revisão vencida — o sinal que já existe no banco e acende o
   * farol sem depender de ninguém digitar nada.
   *
   * Duas fontes, porque o status do registro não é confiável sozinho: existe
   * quem tenha sido marcado `atrasada` na mão, e existe `agendada` cuja data
   * simplesmente passou sem ninguém reclassificar. Medido em homologação
   * (04/08/2026): 9 do primeiro caso, 12 do segundo, 21 veículos distintos.
   */
  private async veiculosComRevisaoAtrasada(orgId: string, veiculoIds: string[]): Promise<Set<string>> {
    if (!veiculoIds.length) return new Set();
    const hoje = this.diaLocal(new Date().toISOString().slice(0, 10));
    const rows = await this.db.revisaoVeiculo.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        veiculoId: { in: veiculoIds },
        OR: [
          { status: "atrasada" },
          { status: "agendada", dataPrevista: { lt: hoje } },
        ],
      },
      select: { veiculoId: true },
      distinct: ["veiculoId"],
    });
    return new Set(rows.map((r: any) => r.veiculoId));
  }

  /**
   * Status operacional da frota — o equivalente da aba "Controle" da planilha
   * FORFT_0005, com uma linha por veículo e o farol derivado das OS abertas.
   *
   * Diferente dos demais relatórios, este é uma FOTO do agora: não recebe
   * período. Quem quiser a evolução no tempo usa `historicoDisponibilidade`.
   */
  async statusFrota(orgId: string, q: any) {
    const where: any = { organizationId: orgId, deletedAt: null };
    if (q.tipo) where.tipo = q.tipo;
    if (q.setorId) where.setorId = q.setorId;
    if (q.unidade) where.unidade = q.unidade;
    if (q.veiculoId) where.id = q.veiculoId;

    const veiculos = await this.db.veiculo.findMany({
      where,
      select: {
        id: true, placa: true, codigo: true, identificacao: true,
        marca: true, modelo: true, status: true, unidade: true, tipo: true,
        setor: { select: { id: true, nome: true, cor: true } },
      },
      orderBy: { placa: "asc" },
    });

    if (!veiculos.length) {
      return {
        linhas: [], truncado: false, totalLinhas: 0,
        totais: contarFarois([]),
      };
    }

    // Uma consulta só para todas as OS abertas da org — evita N+1 numa tela que
    // carrega a frota inteira. O filtro de status fica em memória porque a lista
    // de "encerradas" é definida em frota-status.ts (fonte única).
    const osAbertas = await this.db.manutencaoVeiculo.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        veiculoId: { in: veiculos.map((v: any) => v.id) },
      },
      select: {
        id: true, veiculoId: true, numeroOs: true, tipo: true, status: true,
        descricao: true, imobiliza: true, localizacao: true, oficina: true,
        fornecedor: true, observacoes: true, dataAbertura: true, data: true,
        previsaoLiberacao: true, dataFechamento: true, criadoEm: true,
      },
    });

    const porVeiculo = new Map<string, any[]>();
    for (const os of osAbertas) {
      if (!osEstaAberta(os)) continue;
      if (!porVeiculo.has(os.veiculoId)) porVeiculo.set(os.veiculoId, []);
      porVeiculo.get(os.veiculoId)!.push(os);
    }

    const comRevisaoAtrasada = await this.veiculosComRevisaoAtrasada(orgId, veiculos.map((v: any) => v.id));

    const agora = Date.now();
    const linhas = veiculos.map((v: any) => {
      const abertas = porVeiculo.get(v.id) || [];
      const { farol, motivo, origem } = farolDoVeiculo(v, abertas, {
        revisaoAtrasada: comRevisaoAtrasada.has(v.id),
      });
      const os = osDeterminante(abertas);
      const inicio = os ? (os.dataAbertura || os.data || os.criadoEm) : null;

      return {
        veiculo: {
          id: v.id, placa: v.placa, codigo: v.codigo,
          identificacao: v.identificacao, marca: v.marca, modelo: v.modelo,
          unidade: v.unidade, tipo: v.tipo, statusCadastro: v.status,
        },
        setor: v.setor?.nome || "",
        farol,
        // O amarelo tem três origens (OS, cadastro, revisão) — sem dizer qual
        // acendeu, a tela não diz ao usuário o que fazer.
        motivoFarol: motivo,
        origemFarol: origem,
        statusOperacional: FAROL_LABELS[farol as FarolOperacional],
        // Quantas frentes abertas o veículo tem — um caminhão com 6 avarias
        // acumuladas não é o mesmo caso de um com 1, e a planilha empilhava
        // tudo numa célula de texto.
        osAbertas: abertas.length,
        osImobilizantes: abertas.filter((o: any) => o.imobiliza !== false).length,
        // O id (nao o numero) e o que permite abrir a OS direto da grade.
        manutencaoId: os?.id || null,
        numeroOs: os?.numeroOs || "",
        tipoManutencao: os?.tipo || "",
        dataBaixa: inicio || null,
        // Dias parado só faz sentido para quem está parado; para o veículo com
        // avaria isso seria "dias convivendo com o defeito" e confundiria a
        // leitura da coluna.
        diasParado: farol === "parado" && inicio
          ? Math.max(0, Math.floor((agora - new Date(inicio).getTime()) / 86400000))
          : null,
        previsaoLiberacao: os?.previsaoLiberacao || null,
        dataLiberacao: os?.dataFechamento || null,
        // Previsão estourada é o alerta que a planilha não dava: a data ficava
        // lá, vencida, sem ninguém notar.
        previsaoAtrasada: !!(os?.previsaoLiberacao && !os?.dataFechamento
          && new Date(os.previsaoLiberacao).getTime() < agora),
        localizacao: os?.localizacao || "",
        problema: os?.descricao || "",
        prestador: os?.oficina || os?.fornecedor || "",
        observacao: os?.observacoes || "",
      };
    });

    // Parados primeiro, depois avarias, depois o resto: quem abre a tela quer
    // ver o problema, não a ordem alfabética.
    const peso: Record<string, number> = { parado: 0, operando_com_avaria: 1, operando: 2, fora_de_operacao: 3 };
    linhas.sort((a: any, b: any) => {
      const d = peso[a.farol] - peso[b.farol];
      if (d !== 0) return d;
      if (a.farol === "parado") return (b.diasParado || 0) - (a.diasParado || 0);
      return String(a.veiculo.placa).localeCompare(String(b.veiculo.placa));
    });

    const cut = await this.limitar(linhas);
    return { ...cut, totais: contarFarois(linhas.map((l: any) => l.farol)) };
  }

  /**
   * Série diária de disponibilidade — o que a planilha só conseguia empilhando
   * um snapshot da frota inteira por dia (12.374 linhas para 130 dias).
   *
   * Reconstrói, para cada dia do período, quantos veículos estavam parados /
   * com avaria / operando, a partir das janelas [início, fim] das OS. Veículo
   * fora da frota (vendido/inativo) não entra no denominador.
   *
   * Limitação assumida e explícita: usa o cadastro ATUAL do veículo. Um veículo
   * vendido mês passado não aparece na série de três meses atrás, quando ainda
   * rodava. Guardar isso exigiria versionar o cadastro; para a pergunta que a
   * tela responde ("como a frota de hoje vem se comportando") o efeito é
   * pequeno e o custo seria alto.
   */
  async historicoDisponibilidade(orgId: string, q: any) {
    const to = q.to ? this.diaLocal(q.to, true) : this.diaLocal(new Date().toISOString().slice(0, 10), true);
    const from = q.from
      ? this.diaLocal(q.from)
      : this.diaLocal(new Date(Date.now() - 89 * 86400000).toISOString().slice(0, 10));

    if (from.getTime() > to.getTime()) throw new BadRequestException("Período inválido");

    // Teto de 366 pontos: a série vira gráfico, e acima disso ela deixa de ser
    // legível antes de ficar cara.
    const dias = Math.min(366, Math.floor((to.getTime() - from.getTime()) / 86400000) + 1);

    const vehWhere: any = { organizationId: orgId, deletedAt: null };
    if (q.tipo) vehWhere.tipo = q.tipo;
    if (q.setorId) vehWhere.setorId = q.setorId;
    if (q.unidade) vehWhere.unidade = q.unidade;

    const veiculos = await this.db.veiculo.findMany({
      where: vehWhere,
      select: { id: true, status: true },
    });
    const naFrota = veiculos.filter((v: any) => !foraDaFrota(v));
    if (!naFrota.length) return { pontos: [], totalVeiculos: 0 };

    const ids = new Set(naFrota.map((v: any) => v.id));

    // Só OS que tocam a janela: fechadas depois do início, ou ainda abertas.
    const os = await this.db.manutencaoVeiculo.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        veiculoId: { in: naFrota.map((v: any) => v.id) },
        OR: [{ dataFechamento: null }, { dataFechamento: { gte: from } }],
      },
      select: {
        veiculoId: true, status: true, imobiliza: true,
        dataAbertura: true, data: true, dataFechamento: true, criadoEm: true,
      },
    });

    const agora = Date.now();
    // Pré-computa as janelas uma vez; o laço por dia só compara números.
    const janelas = os
      .filter((o: any) => ids.has(o.veiculoId))
      .map((o: any) => {
        const iniRaw = o.dataAbertura || o.data || o.criadoEm;
        if (!iniRaw) return null;
        const fim = o.dataFechamento
          ? new Date(o.dataFechamento).getTime()
          : (osEstaAberta(o) ? Number.MAX_SAFE_INTEGER : new Date(o.criadoEm).getTime());
        return {
          veiculoId: o.veiculoId,
          ini: new Date(iniRaw).getTime(),
          fim,
          imobiliza: o.imobiliza !== false,
        };
      })
      .filter(Boolean) as Array<{ veiculoId: string; ini: number; fim: number; imobiliza: boolean }>;

    const pontos: any[] = [];
    for (let i = 0; i < dias; i++) {
      const dia = new Date(from.getTime() + i * 86400000);
      dia.setHours(23, 59, 59, 999);
      const t = Math.min(dia.getTime(), agora);
      if (t < from.getTime()) continue;

      const parados = new Set<string>();
      const comAvaria = new Set<string>();
      for (const j of janelas) {
        if (j.ini > t || j.fim < t) continue;
        if (j.imobiliza) parados.add(j.veiculoId);
        else comAvaria.add(j.veiculoId);
      }
      // Um veículo imobilizado e com avaria ao mesmo tempo conta uma vez só,
      // como parado — senão o total do dia estoura o tamanho da frota.
      for (const id of parados) comAvaria.delete(id);

      const total = naFrota.length;
      const parado = parados.size;
      const avaria = comAvaria.size;
      const operando = total - parado - avaria;

      pontos.push({
        data: new Date(from.getTime() + i * 86400000).toISOString().slice(0, 10),
        operando,
        operandoComAvaria: avaria,
        parado,
        total,
        percRodando: total ? Math.round(((operando + avaria) / total) * 1000) / 10 : 0,
        percParados: total ? Math.round((parado / total) * 1000) / 10 : 0,
      });
    }

    return { pontos, totalVeiculos: naFrota.length };
  }

  // ── Definição única das colunas de cada relatório ────────────────────────────
  // Antes cada formato (CSV, Excel, PDF, e-mail) repetia seu próprio mapeamento e
  // eles já haviam divergido: o PDF de CNHs perdera "Matrícula", o de Manutenções
  // perdera "Peças/Serviços" e Disponibilidade saía número no Excel e texto no CSV.
  private readonly REPORTS: Record<string, ReportDef> = {
    veiculos: {
      titulo: "Relatório de Veículos - Gestão de Frota",
      cols: [
        { header: "Placa", get: l => l.placa },
        { header: "Código", get: l => l.codigo },
        { header: "Marca", get: l => l.marca || "" },
        { header: "Modelo", get: l => l.modelo || "" },
        { header: "Tipo", get: l => l.tipo },
        { header: "Combustível", get: l => l.combustivel },
        { header: "Status", get: l => l.status },
        { header: "KM Atual", get: l => num(l.kmAtual) },
      ],
    },
    motoristas: {
      titulo: "Relatório de Motoristas - Gestão de Frota",
      cols: [
        { header: "Nome", get: l => l.nome },
        { header: "CPF", get: l => l.cpf || "" },
        { header: "Matrícula", get: l => l.matricula || "" },
        { header: "Departamento", get: l => l.departamento || "" },
        { header: "Cargo", get: l => l.cargo || "" },
        { header: "Status", get: l => l.status },
      ],
    },
    cnhs: {
      titulo: "Relatório de CNHs - Gestão de Frota",
      cols: [
        { header: "Nome", get: l => l.nome },
        { header: "CPF", get: l => l.cpf || "" },
        { header: "Matrícula", get: l => l.matricula || "" },
        { header: "CNH", get: l => l.cnh || "" },
        { header: "Categoria", get: l => l.categoriaCnh || "" },
        { header: "Validade", get: l => fmtData(l.validadeCnh) },
        { header: "Status CNH", get: l => l.statusCnh },
      ],
    },
    pneus: {
      titulo: "Relatório de Pneus - Gestão de Frota",
      cols: [
        { header: "Nº Fogo", get: l => l.numeroFogo || "" },
        { header: "Código", get: l => l.codigo || "" },
        { header: "Marca", get: l => l.marca || "" },
        { header: "Modelo", get: l => l.modelo || "" },
        { header: "Medida", get: l => l.medida || "" },
        { header: "Posição", get: l => l.posicao || "" },
        { header: "Veículo", get: l => l.veiculo?.placa || "" },
        { header: "Status", get: l => l.status },
      ],
    },
    "historico-pneus": {
      titulo: "Relatório de Histórico de Pneus - Gestão de Frota",
      cols: [
        { header: "Nº Fogo", get: l => l.pneu?.numeroFogo || "" },
        { header: "Código Pneu", get: l => l.pneu?.codigo || "" },
        { header: "Veículo", get: l => l.veiculo?.placa || "" },
        { header: "Tipo Evento", get: l => l.tipo },
        { header: "Data", get: l => fmtData(l.data) },
        { header: "KM", get: l => num(l.km) },
        { header: "Custo", get: l => num(l.custo) },
        { header: "Observação", get: l => l.observacao || "" },
      ],
    },
    revisoes: {
      titulo: "Relatório de Revisões - Gestão de Frota",
      cols: [
        { header: "Veículo", get: l => l.veiculo?.placa || "" },
        { header: "Tipo", get: l => l.tipo || "" },
        { header: "Descrição", get: l => l.descricao || "" },
        { header: "Data Prevista", get: l => fmtData(l.dataPrevista) },
        { header: "KM Previsto", get: l => num(l.kmPrevisto) },
        { header: "Data Realizada", get: l => fmtData(l.dataRealizada) },
        { header: "KM Realizado", get: l => num(l.kmRealizado) },
        { header: "Status", get: l => l.status },
        { header: "Custo", get: l => num(l.custo) },
      ],
    },
    manutencoes: {
      titulo: "Relatório de Manutenções - Gestão de Frota",
      cols: [
        { header: "OS", get: l => l.numeroOs || "" },
        { header: "Veículo", get: l => l.veiculo?.placa || "" },
        { header: "Tipo OS", get: l => l.tipo },
        { header: "Descrição", get: l => l.descricao || "" },
        { header: "Data", get: l => fmtData(l.dataEfetiva || l.data || l.dataAbertura) },
        { header: "KM", get: l => num(l.km) },
        { header: "Status", get: l => l.status },
        { header: "Custo Total", get: l => num(l.custo) },
        { header: "Custo Peças", get: l => num(l.custoPecas) },
        { header: "Custo Serviços", get: l => num(l.custoServicos) },
      ],
    },
    abastecimentos: {
      titulo: "Relatório de Abastecimentos - Gestão de Frota",
      cols: [
        { header: "Veículo", get: l => l.veiculo?.placa || "" },
        { header: "Motorista", get: l => l.motorista?.nome || "" },
        { header: "Data", get: l => fmtData(l.data) },
        { header: "Posto", get: l => l.posto || "" },
        { header: "Combustível", get: l => l.tipoCombustivel || "" },
        { header: "Litros", get: l => num(l.litros) },
        { header: "KM Atual", get: l => num(l.kmAtual) },
        { header: "Custo Total", get: l => num(l.valorTotal) },
        { header: "Consumo (km/L)", get: l => num(l.consumoKmL) },
        { header: "Custo/KM", get: l => num(l.custoKm) },
      ],
    },
    custos: {
      titulo: "Relatório de Custos - Gestão de Frota",
      cols: [
        { header: "Veículo", get: l => l.veiculo?.placa || "" },
        { header: "Qtd OS", get: l => num(l.totalManutencoes) },
        { header: "Qtd Abast.", get: l => num(l.totalAbastecimentos) },
        { header: "Litros", get: l => num(l.litros) },
        { header: "Custo OS", get: l => num(l.custoManutencao) },
        { header: "Custo Abast.", get: l => num(l.custoAbastecimento) },
        { header: "Custo Total", get: l => num(l.custoTotal) },
      ],
    },
    "status-frota": {
      titulo: "Controle de Manutenções Corretivas - Status da Frota",
      // Ordem espelhando a planilha FORFT_0005 para que quem usa as duas
      // consiga conferir uma contra a outra linha a linha.
      cols: [
        { header: "Status", get: l => l.statusOperacional },
        { header: "Motivo", get: l => (l.origemFarol && l.origemFarol !== "nenhuma" ? l.motivoFarol : "") },
        { header: "Placa", get: l => l.veiculo?.placa || "" },
        { header: "Modelo", get: l => [l.veiculo?.marca, l.veiculo?.modelo].filter(Boolean).join(" ") },
        { header: "Identificação", get: l => l.veiculo?.identificacao || "" },
        { header: "Setor", get: l => l.setor || "" },
        { header: "OS", get: l => l.numeroOs || "" },
        { header: "Dt baixa", get: l => fmtData(l.dataBaixa) },
        { header: "Dias parado", get: l => (l.diasParado == null ? "" : num(l.diasParado)) },
        { header: "Prev liberação", get: l => fmtData(l.previsaoLiberacao) },
        { header: "Dt liberação", get: l => fmtData(l.dataLiberacao) },
        { header: "Localização", get: l => l.localizacao || "" },
        { header: "Tipo Manut", get: l => l.tipoManutencao || "" },
        { header: "Problema", get: l => l.problema || "" },
        { header: "Prestador de serviço", get: l => l.prestador || "" },
        { header: "Observação", get: l => l.observacao || "" },
      ],
    },
    disponibilidade: {
      titulo: "Relatório de Disponibilidade de Frota",
      cols: [
        { header: "Veículo", get: l => l.veiculo?.placa || "" },
        { header: "Dias Totais", get: l => num(l.diasTotais) },
        { header: "Dias Parado (Manut.)", get: l => num(l.diasParado) },
        { header: "Dias Ativo", get: l => num(l.diasAtivo) },
        { header: "Disponibilidade (%)", get: l => num(l.disponibilidade) },
        { header: "Status Atual", get: l => l.statusAtual },
      ],
    },
  };

  private async carregar(orgId: string, tipo: string, filtros: any) {
    const f = filtros || {};
    switch (tipo) {
      case "veiculos": return this.veiculos(orgId, f);
      case "motoristas": return this.motoristas(orgId, f);
      case "cnhs": return this.cnhs(orgId, f);
      case "pneus": return this.pneus(orgId, f);
      case "historico-pneus": return this.historicoPneus(orgId, f);
      case "revisoes": return this.revisoes(orgId, f);
      case "manutencoes": return this.manutencoes(orgId, f);
      case "abastecimentos": return this.abastecimentos(orgId, f);
      case "custos": return this.custos(orgId, f.from, f.to, f.veiculoId);
      case "disponibilidade": return this.disponibilidade(orgId, f);
      case "status-frota": return this.statusFrota(orgId, f);
      default: throw new BadRequestException("tipoRelatorio inválido");
    }
  }

  // ── Geração de anexos ───────────────────────────────────────────────────────
  private buildCsv(headers: string[], rows: any[][]): string {
    return [
      headers.map(csvCell).join(";"),
      ...rows.map(r => r.map(csvCell).join(";"))
    ].join("\r\n");
  }

  private buildXlsx(headers: string[], rows: any[][]): Buffer {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const XLSX = require("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = headers.map(h => ({ wch: Math.max(h.length + 4, 12) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  }

  private buildPdf(titulo: string, headers: string[], rows: any[][]): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PDFDocument = require("pdfkit");
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 28 });
    const chunks: Buffer[] = [];

    return new Promise<Buffer>((resolve, reject) => {
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const left = doc.page.margins.left;
      const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const colW = usable / headers.length;
      const rowH = 16;

      doc.font("Helvetica-Bold").fontSize(14).fillColor("#1e1b4b").text(titulo, left, 30);
      doc.font("Helvetica").fontSize(8).fillColor("#6b7280")
        .text(`Gerado em: ${new Date().toLocaleString("pt-BR")} | ${MARCA} Gestão de Frota`, left, 48);

      let y = 68;
      const cabecalho = () => {
        doc.rect(left, y, usable, rowH).fill("#1e1b4b");
        doc.font("Helvetica-Bold").fontSize(7).fillColor("#ffffff");
        headers.forEach((h, i) => {
          doc.text(String(h), left + i * colW + 3, y + 5, { width: colW - 6, ellipsis: true, lineBreak: false });
        });
        y += rowH;
      };
      cabecalho();

      doc.font("Helvetica").fontSize(7);
      rows.forEach((r, idx) => {
        if (y + rowH > doc.page.height - doc.page.margins.bottom) {
          doc.addPage({ size: "A4", layout: "landscape", margin: 28 });
          y = 40;
          cabecalho();
          doc.font("Helvetica").fontSize(7);
        }
        if (idx % 2 === 0) {
          doc.rect(left, y, usable, rowH).fill("#f5f3ff");
        }
        doc.fillColor("#111827");
        r.forEach((v, i) => {
          const txt = typeof v === "number" ? v.toLocaleString("pt-BR") : String(v ?? "");
          doc.text(txt, left + i * colW + 3, y + 5, { width: colW - 6, ellipsis: true, lineBreak: false });
        });
        y += rowH;
      });

      doc.end();
    });
  }

  private async gerarAnexo(formato: string, def: ReportDef, headers: string[], rows: any[][], tipo: string) {
    const stamp = new Date().toISOString().slice(0, 10);
    if (formato === "excel" || formato === "xlsx") {
      return { filename: `relatorio-${tipo}-${stamp}.xlsx`, contentBase64: this.buildXlsx(headers, rows).toString("base64") };
    }
    if (formato === "pdf") {
      const buf = await this.buildPdf(def.titulo, headers, rows);
      return { filename: `relatorio-${tipo}-${stamp}.pdf`, contentBase64: buf.toString("base64") };
    }
    // BOM para o Excel reconhecer UTF-8 — sem ele a acentuação chega quebrada.
    const csv = "﻿" + this.buildCsv(headers, rows);
    return { filename: `relatorio-${tipo}-${stamp}.csv`, contentBase64: Buffer.from(csv, "utf-8").toString("base64") };
  }

  private validarDestinatarios(destinatarios: string): string[] {
    const lista = String(destinatarios).split(",").map(e => e.trim()).filter(Boolean);
    if (!lista.length) throw new BadRequestException("Informe pelo menos um destinatário");

    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidos = lista.filter(e => !re.test(e));
    if (invalidos.length) throw new BadRequestException(`E-mail inválido: ${invalidos.join(", ")}`);

    // Allowlist opcional de domínios. Vazia = qualquer domínio (comportamento atual).
    const permitidos = String(process.env.FROTA_REPORT_EMAIL_DOMAINS || "")
      .split(",").map(d => d.trim().toLowerCase()).filter(Boolean);
    if (permitidos.length) {
      const fora = lista.filter(e => !permitidos.includes(e.split("@")[1].toLowerCase()));
      if (fora.length) {
        throw new BadRequestException(`Domínio não autorizado para envio de relatórios: ${fora.join(", ")}`);
      }
    }
    return lista;
  }

  async enviarEmail(orgId: string, body: any, usuarioId?: string) {
    const { tipoRelatorio, filtros, destinatarios, formato } = body;
    if (!tipoRelatorio || !destinatarios || !formato) {
      throw new BadRequestException("tipoRelatorio, destinatarios e formato são obrigatórios");
    }

    const def = this.REPORTS[tipoRelatorio];
    if (!def) throw new BadRequestException("tipoRelatorio inválido");

    if (!this.email.isEnabled()) {
      throw new BadRequestException(
        "Serviço de e-mail não configurado (RESEND_API_KEY ausente). O relatório não foi enviado."
      );
    }

    const destList = this.validarDestinatarios(destinatarios);

    const resData: any = await this.carregar(orgId, tipoRelatorio, filtros);
    const headers = def.cols.map(c => c.header);
    const rows = (resData.linhas || []).map((l: any) => def.cols.map(c => c.get(l)));

    const { filename, contentBase64 } = await this.gerarAnexo(formato, def, headers, rows, tipoRelatorio);

    // Prévia no corpo do e-mail; o anexo carrega o conjunto completo.
    const PREVIA = 50;
    const previa = rows.slice(0, PREVIA);
    const htmlTableRows = previa.map(r =>
      `<tr>${r.map(v => `<td style="padding: 8px; border: 1px solid #ede9fe; font-size: 13px;">${escapeHtml(typeof v === "number" ? v.toLocaleString("pt-BR") : v)}</td>`).join("")}</tr>`
    ).join("");
    const htmlTableHeader = headers.map(h =>
      `<th style="padding: 8px; background-color: #1e1b4b; color: white; border: 1px solid #ede9fe; text-align: left; font-size: 11px; text-transform: uppercase;">${escapeHtml(h)}</th>`
    ).join("");

    const nota = rows.length > PREVIA
      ? `<p style="margin-top: 12px; font-size: 12px; color: #6b7280;">Exibindo as primeiras ${PREVIA} de ${rows.length.toLocaleString("pt-BR")} linhas. O arquivo em anexo contém o relatório completo.</p>`
      : "";
    const avisoCorte = resData.truncado
      ? `<p style="margin-top: 12px; font-size: 12px; color: #b45309;">Atenção: o relatório atingiu o limite de ${MAX_LINHAS.toLocaleString("pt-BR")} linhas (de ${Number(resData.totalLinhas).toLocaleString("pt-BR")} disponíveis). Refine o período ou os filtros.</p>`
      : "";

    const html = `
      <h3>${escapeHtml(def.titulo)}</h3>
      <p>Gerado em: ${new Date().toLocaleString("pt-BR")}</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        <thead>
          <tr>${htmlTableHeader}</tr>
        </thead>
        <tbody>
          ${htmlTableRows}
        </tbody>
      </table>
      ${nota}
      ${avisoCorte}
      <p style="margin-top: 20px; font-size: 12px; color: #6b7280;">O arquivo <strong>${escapeHtml(filename)}</strong> foi anexado a este e-mail.</p>
    `;

    const enviados: string[] = [];
    const falhas: string[] = [];
    for (const email of destList) {
      const sent = await this.email.sendWithAttachment(email, def.titulo, html, filename, contentBase64);
      if (sent) enviados.push(email); else falhas.push(email);
    }

    this.logger.log(
      `Relatório "${tipoRelatorio}" (${formato}) org=${orgId} usuario=${usuarioId || "-"} ` +
      `enviados=[${enviados.join(", ")}] falhas=[${falhas.join(", ")}] linhas=${rows.length}`
    );

    return {
      ok: falhas.length === 0 && enviados.length > 0,
      filename,
      enviados,
      falhas,
      linhas: rows.length,
      truncado: !!resData.truncado,
      mensagem: falhas.length
        ? `Falha ao enviar para: ${falhas.join(", ")}`
        : `Relatório enviado para ${enviados.length} destinatário(s).`,
    };
  }
}
