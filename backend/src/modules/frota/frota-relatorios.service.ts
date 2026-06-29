import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { EmailService } from "../notifications/email.service";

@Injectable()
export class FrotaRelatoriosService {
  constructor(private prisma: PrismaService, private email: EmailService) {}
  private get db() { return this.prisma as any; }

  private periodo(from?: string, to?: string) {
    const range: any = {};
    if (from) range.gte = new Date(from);
    if (to) { const t = new Date(to); t.setHours(23, 59, 59, 999); range.lte = t; }
    return Object.keys(range).length ? range : undefined;
  }

  async custos(orgId: string, from?: string, to?: string, veiculoId?: string) {
    const per = this.periodo(from, to);
    const baseV: any = { organizationId: orgId, deletedAt: null, ...(veiculoId ? { veiculoId } : {}) };

    const [manut, abast, veiculos] = await Promise.all([
      this.db.manutencaoVeiculo.groupBy({ by: ["veiculoId"], _sum: { custo: true }, _count: true, where: { ...baseV, ...(per ? { data: per } : {}) } }),
      this.db.abastecimento.groupBy({ by: ["veiculoId"], _sum: { valorTotal: true, litros: true }, _count: true, where: { ...baseV, ...(per ? { data: per } : {}) } }),
      this.db.veiculo.findMany({ where: { organizationId: orgId, deletedAt: null, ...(veiculoId ? { id: veiculoId } : {}) }, select: { id: true, placa: true, codigo: true, modelo: true } }),
    ]);

    const byId = (id: string) => veiculos.find((v: any) => v.id === id);
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

    return {
      linhas,
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
    if (q.centroCustoId) where.centroCustoId = q.centroCustoId;

    const rows = await this.db.veiculo.findMany({
      where,
      include: {
        motorista: { select: { nome: true } },
        centroCusto: { select: { nome: true, codigo: true } },
        categoria: { select: { nome: true } },
      },
      orderBy: { placa: "asc" },
    });

    const statusCounts = await this.db.veiculo.groupBy({
      by: ["status"],
      _count: true,
      where: { organizationId: orgId, deletedAt: null },
    });

    return {
      linhas: rows,
      totais: {
        total: rows.length,
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
    });

    return {
      linhas: rows,
      totais: {
        total: rows.length,
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
        cnh: true,
        categoriaCnh: true,
        validadeCnh: true,
        status: true,
      },
      orderBy: { validadeCnh: "asc" },
    });

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const em30 = new Date(hoje.getTime() + 30 * 86400000);

    const linhas = rows.map((r: any) => {
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

    if (q.statusCnh) {
      const filtered = linhas.filter((l: any) => l.statusCnh === q.statusCnh);
      return {
        linhas: filtered,
        totais: {
          total: linhas.length,
          vencidas: linhas.filter((l: any) => l.statusCnh === "vencida").length,
          vencendo30: linhas.filter((l: any) => l.statusCnh === "vencendo_30").length,
          vigentes: linhas.filter((l: any) => l.statusCnh === "vigente").length,
        }
      };
    }

    return {
      linhas,
      totais: {
        total: linhas.length,
        vencidas: linhas.filter((l: any) => l.statusCnh === "vencida").length,
        vencendo30: linhas.filter((l: any) => l.statusCnh === "vencendo_30").length,
        vigentes: linhas.filter((l: any) => l.statusCnh === "vigente").length,
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
    });

    return {
      linhas: rows,
      totais: {
        total: rows.length,
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

    const rows = await this.db.pneuEvento.findMany({
      where,
      include: {
        pneu: { select: { id: true, numeroFogo: true, codigo: true, marca: true, modelo: true } },
        veiculo: { select: { id: true, placa: true } },
      },
      orderBy: { data: "desc" },
    });

    return {
      linhas: rows,
      totais: {
        total: rows.length,
        custoTotal: rows.reduce((s: number, r: any) => s + (r.custo || 0), 0),
      }
    };
  }

  async revisoes(orgId: string, q: any) {
    const range = this.periodo(q.from, q.to);
    const where: any = { organizationId: orgId, deletedAt: null };
    if (q.status) where.status = q.status;
    if (q.veiculoId) where.veiculoId = q.veiculoId;
    if (range) {
      where.OR = [
        { dataRealizada: range },
        { dataPrevista: range }
      ];
    }

    const rows = await this.db.revisaoVeiculo.findMany({
      where,
      include: {
        veiculo: { select: { placa: true, modelo: true } },
      },
      orderBy: { dataPrevista: "asc" },
    });

    return {
      linhas: rows,
      totais: {
        total: rows.length,
        realizadas: rows.filter((r: any) => r.status === "realizada").length,
        agendadas: rows.filter((r: any) => r.status === "agendada").length,
        custoTotal: rows.reduce((s: number, r: any) => s + (r.custo || 0), 0),
      }
    };
  }

  async manutencoes(orgId: string, q: any) {
    const range = this.periodo(q.from, q.to);
    const where: any = { organizationId: orgId, deletedAt: null };
    if (q.status) where.status = q.status;
    if (q.tipo) where.tipo = q.tipo;
    if (q.veiculoId) where.veiculoId = q.veiculoId;
    if (range) {
      where.data = range;
    }

    const rows = await this.db.manutencaoVeiculo.findMany({
      where,
      include: {
        veiculo: { select: { placa: true, modelo: true } },
        solicitante: { select: { nome: true } },
      },
      orderBy: { data: "desc" },
    });

    return {
      linhas: rows,
      totais: {
        total: rows.length,
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
    });

    const cons = rows.filter((r: any) => r.consumoKmL != null).map((r: any) => r.consumoKmL);
    const cKm = rows.filter((r: any) => r.custoKm != null).map((r: any) => r.custoKm);
    const avg = (arr: number[]) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0;

    return {
      linhas: rows,
      totais: {
        total: rows.length,
        litros: rows.reduce((s: number, r: any) => s + (r.litros || 0), 0),
        custoTotal: rows.reduce((s: number, r: any) => s + (r.valorTotal || 0), 0),
        consumoMedio: Number(avg(cons).toFixed(2)),
        custoKmMedio: Number(avg(cKm).toFixed(3)),
      }
    };
  }

  async disponibilidade(orgId: string, q: any) {
    const fromStr = q.from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const toStr = q.to || new Date().toISOString().slice(0, 10);

    const fromDate = new Date(fromStr);
    const toDate = new Date(toStr);
    toDate.setHours(23, 59, 59, 999);

    const totalPeriodMs = toDate.getTime() - fromDate.getTime();
    const totalPeriodDays = Math.max(1, Math.round(totalPeriodMs / 86400000));

    const veiculos = await this.db.veiculo.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: { id: true, placa: true, modelo: true, status: true },
    });

    if (!veiculos.length) {
      return { linhas: [], totais: { total: 0, ativos: 0, indisponiveis: 0, dispMedia: 100 } };
    }

    const manutencoes = await this.db.manutencaoVeiculo.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        dataAbertura: { lte: toDate },
        OR: [
          { dataFechamento: null },
          { dataFechamento: { gte: fromDate } }
        ]
      },
      select: {
        veiculoId: true,
        dataAbertura: true,
        dataFechamento: true,
      }
    });

    const linhas = veiculos.map((v: any) => {
      let downtimeMs = 0;
      const vManuts = manutencoes.filter((m: any) => m.veiculoId === v.id);

      for (const m of vManuts) {
        const ab = new Date(m.dataAbertura).getTime();
        const fc = m.dataFechamento ? new Date(m.dataFechamento).getTime() : Date.now();

        const start = Math.max(ab, fromDate.getTime());
        const end = Math.min(fc, toDate.getTime());

        if (end > start) {
          downtimeMs += (end - start);
        }
      }

      const downtimeDays = Number((downtimeMs / 86400000).toFixed(2));
      const activeDays = Math.max(0, Number((totalPeriodDays - downtimeDays).toFixed(2)));
      const dispPct = totalPeriodDays ? Math.max(0, Math.min(100, Math.round((activeDays / totalPeriodDays) * 100))) : 100;

      return {
        veiculo: { id: v.id, placa: v.placa, modelo: v.modelo },
        diasTotais: totalPeriodDays,
        diasParado: downtimeDays,
        diasAtivo: activeDays,
        disponibilidade: dispPct,
        statusAtual: v.status,
      };
    });

    const totalDisp = linhas.reduce((s: number, l: any) => s + l.disponibilidade, 0);
    const dispMedia = Math.round(totalDisp / linhas.length);

    return {
      linhas,
      totais: {
        total: veiculos.length,
        ativos: veiculos.filter((v: any) => v.status === "ativo").length,
        indisponiveis: veiculos.filter((v: any) => v.status === "manutencao").length,
        dispMedia,
      }
    };
  }

  async enviarEmail(orgId: string, body: any) {
    const { tipoRelatorio, filtros, destinatarios, formato } = body;
    if (!tipoRelatorio || !destinatarios || !formato) {
      throw new BadRequestException("tipoRelatorio, destinatarios e formato são obrigatórios");
    }

    let resData: any = null;
    let title = "Relatório de Frota";
    let headers: string[] = [];
    let rows: any[][] = [];

    if (tipoRelatorio === "veiculos") {
      resData = await this.veiculos(orgId, filtros);
      title = "Relatório de Veículos - Gestão de Frota";
      headers = ["Placa", "Código", "Marca", "Modelo", "Tipo", "Combustível", "Status", "KM Atual"];
      rows = resData.linhas.map((l: any) => [l.placa, l.codigo, l.marca || "", l.modelo || "", l.tipo, l.combustivel, l.status, l.kmAtual]);
    } else if (tipoRelatorio === "motoristas") {
      resData = await this.motoristas(orgId, filtros);
      title = "Relatório de Motoristas - Gestão de Frota";
      headers = ["Nome", "CPF", "Matrícula", "Departamento", "Cargo", "Status"];
      rows = resData.linhas.map((l: any) => [l.nome, l.cpf || "", l.matricula || "", l.departamento || "", l.cargo || "", l.status]);
    } else if (tipoRelatorio === "cnhs") {
      resData = await this.cnhs(orgId, filtros);
      title = "Relatório de CNHs - Gestão de Frota";
      headers = ["Nome", "CNH", "Categoria", "Validade", "Status CNH"];
      rows = resData.linhas.map((l: any) => [l.nome, l.cnh || "", l.categoriaCnh || "", l.validadeCnh ? new Date(l.validadeCnh).toLocaleDateString("pt-BR") : "", l.statusCnh]);
    } else if (tipoRelatorio === "pneus") {
      resData = await this.pneus(orgId, filtros);
      title = "Relatório de Pneus - Gestão de Frota";
      headers = ["Nº Fogo", "Código", "Marca", "Modelo", "Medida", "Posição", "Veículo", "Status"];
      rows = resData.linhas.map((l: any) => [l.numeroFogo || "", l.codigo || "", l.marca || "", l.modelo || "", l.medida || "", l.posicao || "", l.veiculo?.placa || "", l.status]);
    } else if (tipoRelatorio === "historico-pneus") {
      resData = await this.historicoPneus(orgId, filtros);
      title = "Relatório de Histórico de Pneus - Gestão de Frota";
      headers = ["Nº Fogo", "Pneu", "Veículo", "Tipo Evento", "Data", "KM", "Custo"];
      rows = resData.linhas.map((l: any) => [l.pneu?.numeroFogo || "", l.pneu?.codigo || "", l.veiculo?.placa || "", l.tipo, new Date(l.data).toLocaleDateString("pt-BR"), l.km || 0, l.custo || 0]);
    } else if (tipoRelatorio === "revisoes") {
      resData = await this.revisoes(orgId, filtros);
      title = "Relatório de Revisões - Gestão de Frota";
      headers = ["Veículo", "Tipo", "Descrição", "Data Prevista", "KM Previsto", "Data Realizada", "KM Realizado", "Status", "Custo"];
      rows = resData.linhas.map((l: any) => [l.veiculo?.placa || "", l.tipo || "", l.descricao || "", l.dataPrevista ? new Date(l.dataPrevista).toLocaleDateString("pt-BR") : "", l.kmPrevisto || 0, l.dataRealizada ? new Date(l.dataRealizada).toLocaleDateString("pt-BR") : "", l.kmRealizado || 0, l.status, l.custo || 0]);
    } else if (tipoRelatorio === "manutencoes") {
      resData = await this.manutencoes(orgId, filtros);
      title = "Relatório de Manutenções - Gestão de Frota";
      headers = ["OS", "Veículo", "Tipo OS", "Descrição", "Data", "KM", "Status", "Custo Total"];
      rows = resData.linhas.map((l: any) => [l.numeroOs || "", l.veiculo?.placa || "", l.tipo, l.descricao || "", l.data ? new Date(l.data).toLocaleDateString("pt-BR") : "", l.km || 0, l.status, l.custo || 0]);
    } else if (tipoRelatorio === "abastecimentos") {
      resData = await this.abastecimentos(orgId, filtros);
      title = "Relatório de Abastecimentos - Gestão de Frota";
      headers = ["Veículo", "Motorista", "Data", "Posto", "Combustível", "Litros", "KM Atual", "Custo Total", "Consumo (km/L)", "Custo/KM"];
      rows = resData.linhas.map((l: any) => [l.veiculo?.placa || "", l.motorista?.nome || "", new Date(l.data).toLocaleDateString("pt-BR"), l.posto || "", l.tipoCombustivel || "", l.litros || 0, l.kmAtual || 0, l.valorTotal || 0, l.consumoKmL || 0, l.custoKm || 0]);
    } else if (tipoRelatorio === "custos") {
      resData = await this.custos(orgId, filtros?.from, filtros?.to, filtros?.veiculoId);
      title = "Relatório de Custos - Gestão de Frota";
      headers = ["Veículo", "Qtd OS", "Qtd Abast.", "Litros", "Custo OS", "Custo Abast.", "Custo Total"];
      rows = resData.linhas.map((l: any) => [l.veiculo?.placa || "", l.totalManutencoes, l.totalAbastecimentos, l.litros, l.custoManutencao, l.custoAbastecimento, l.custoTotal]);
    } else if (tipoRelatorio === "disponibilidade") {
      resData = await this.disponibilidade(orgId, filtros);
      title = "Relatório de Disponibilidade de Frota";
      headers = ["Veículo", "Dias Totais", "Dias Parado (Manut.)", "Dias Ativo", "Disponibilidade (%)", "Status Atual"];
      rows = resData.linhas.map((l: any) => [l.veiculo?.placa || "", l.diasTotais, l.diasParado, l.diasAtivo, `${l.disponibilidade}%`, l.statusAtual]);
    } else {
      throw new BadRequestException("tipoRelatorio inválido");
    }

    const csvContent = [
      headers.join(";"),
      ...rows.map(r => r.map(v => typeof v === "string" ? `"${v.replace(/"/g, '""')}"` : v).join(";"))
    ].join("\n");

    const contentBase64 = Buffer.from(csvContent, "utf-8").toString("base64");
    const filename = `relatorio-${tipoRelatorio}-${new Date().toISOString().slice(0, 10)}.csv`;

    const htmlTableRows = rows.map(r => `<tr>${r.map(v => `<td style="padding: 8px; border: 1px solid #ede9fe; font-size: 13px;">${v}</td>`).join("")}</tr>`).join("");
    const htmlTableHeader = headers.map(h => `<th style="padding: 8px; background-color: #1e1b4b; color: white; border: 1px solid #ede9fe; text-align: left; font-size: 11px; text-transform: uppercase;">${h}</th>`).join("");
    const html = `
      <h3>${title}</h3>
      <p>Gerado em: ${new Date().toLocaleString("pt-BR")}</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        <thead>
          <tr>${htmlTableHeader}</tr>
        </thead>
        <tbody>
          ${htmlTableRows}
        </tbody>
      </table>
      <p style="margin-top: 20px; font-size: 12px; color: #6b7280;">O arquivo CSV completo foi anexado a este e-mail e pode ser aberto no Microsoft Excel.</p>
    `;

    const destList = String(destinatarios).split(",").map(e => e.trim());
    let success = true;
    for (const email of destList) {
      if (email) {
        const sent = await this.email.sendWithAttachment(email, title, html, filename, contentBase64);
        if (!sent) success = false;
      }
    }

    return { ok: success, filename };
  }
}
