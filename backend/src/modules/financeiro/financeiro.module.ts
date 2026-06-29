import {
  Module, Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, Req, NotFoundException, BadRequestException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../../prisma/prisma.service";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";

// ── Helpers ───────────────────────────────────────────────────────────────────

function uuid() { return require("crypto").randomUUID(); }

function toNum(v: any): number | null {
  if (v == null || v === "" || v === "nan") return null;
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
}

function toDate(v: any): Date | null {
  if (!v || v === "nan") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function statusDe(c: any): string {
  if (c.dataPagamento) return "pago";
  const venc = c.dataVenctoReal || c.dataVencto;
  if (venc && new Date(venc) < new Date()) return "vencido";
  return "a_vencer";
}

function mapConta(c: any) {
  return {
    ...c,
    status: statusDe(c),
    valorOriginal:         c.valorOriginal         ? Number(c.valorOriginal)         : null,
    valorVencidoNominal:   c.valorVencidoNominal   ? Number(c.valorVencidoNominal)   : null,
    valorVencidoCorrigido: c.valorVencidoCorrigido ? Number(c.valorVencidoCorrigido) : null,
    valorAVencerNominal:   c.valorAVencerNominal   ? Number(c.valorAVencerNominal)   : null,
    valorJuros:            c.valorJuros            ? Number(c.valorJuros)            : null,
    valorPago:             c.valorPago             ? Number(c.valorPago)             : null,
  };
}

function parseRow(row: any, orgId: string, importadoEm: Date) {
  // Fornecedor: "Z01160-01-PG - ENGENHARIA..." → codigo="Z01160-01", nome="PG - ENGENHARIA..."
  const rawForn = String(row.fornecedorCodNome || "").trim();
  let fornecedorCodigo: string | null = null;
  let fornecedorNome = rawForn;
  const mForn = rawForn.match(/^([A-Z0-9]+-\d+)-(.+)$/);
  if (mForn) { fornecedorCodigo = mForn[1]; fornecedorNome = mForn[2].trim(); }

  // Prefixo-Numero-Parcela: "-000000011-" ou "-000000022-1C"
  const rawPnp = String(row.prfNumeroParcela || "").trim().replace(/^-/, "");
  let numero = rawPnp;
  let parcela: string | null = null;
  const mPnp = rawPnp.match(/^(\d+)-?(.*)$/);
  if (mPnp) { numero = mPnp[1]; parcela = mPnp[2] || null; }

  return {
    id: uuid(),
    organizationId: orgId,
    fornecedorCodigo,
    fornecedorNome: fornecedorNome || "—",
    prefixo: null,
    numero: numero || rawPnp || "0",
    parcela,
    tipo: String(row.tipo || "NF").trim(),
    natureza: row.natureza || null,
    dataEmissao:    toDate(row.dataEmissao),
    dataVencto:     toDate(row.dataVencto),
    dataVenctoReal: toDate(row.dataVenctoReal),
    dataPagamento:  null,
    valorOriginal:         toNum(row.valorOriginal),
    valorVencidoNominal:   toNum(row.valorVencidoNominal),
    valorVencidoCorrigido: toNum(row.valorVencidoCorrigido),
    valorAVencerNominal:   toNum(row.valorAVencerNominal),
    valorJuros:            toNum(row.valorJuros),
    valorPago:             null,
    portador:    row.portador    || null,
    diasAtraso:  row.diasAtraso  ? (parseInt(String(row.diasAtraso)) || null) : null,
    historico:   row.historico   || null,
    classeValor: row.classeValor || null,
    observacao:  row.observacao  || null,
    pedido:      row.pedido      || null,
    ctaContab:   row.ctaContab   || null,
    centroCusto: row.centroCusto || null,
    importadoEm,
  };
}

// ── Controller ────────────────────────────────────────────────────────────────

@Controller("financeiro")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class FinanceiroController {
  constructor(private prisma: PrismaService) {}

  // ── Dashboard ─────────────────────────────────────────────────────────────

  @Get("dashboard")
  @Permissions("financeiro:ver")
  async dashboard(
    @Req() req: any,
    @Query("inicio")      inicio?: string,
    @Query("fim")         fim?: string,
    @Query("fornecedor")  fornecedor?: string,
    @Query("centroCusto") centroCusto?: string,
    @Query("tipo")        tipo?: string,
  ) {
    const orgId = req.user?.organizationId;
    const where: any = { ...(orgId ? { organizationId: orgId } : {}) };
    if (fornecedor)  where.fornecedorNome = { contains: fornecedor, mode: "insensitive" };
    if (centroCusto) where.centroCusto = { contains: centroCusto, mode: "insensitive" };
    if (tipo)        where.tipo = tipo;
    if (inicio || fim) {
      where.dataVenctoReal = {};
      if (inicio) where.dataVenctoReal.gte = new Date(inicio);
      if (fim)    where.dataVenctoReal.lte = new Date(fim);
    }

    const contas = await (this.prisma as any).contaPagar.findMany({ where });
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

    let valorTotal = 0, valorPago = 0, valorPendente = 0, qVencidas = 0, qAVencer = 0;
    let valorVencido = 0, valorAVencer = 0;
    let prox7q = 0, prox7v = 0, prox30q = 0, prox30v = 0;
    const aging = {
      d1a30:  { qty: 0, valor: 0 }, d31a60: { qty: 0, valor: 0 },
      d61a90: { qty: 0, valor: 0 }, mais90: { qty: 0, valor: 0 },
    };
    const porStatus: Record<string, number>  = { pago: 0, vencido: 0, a_vencer: 0 };
    const porFornecedor: Record<string, number> = {};
    const porTipo: Record<string, number> = {};
    const porNatureza: Record<string, number> = {};
    const porMes: Map<string, { label: string; pendente: number; pago: number }> = new Map();
    const fornecedoresSet = new Set<string>();
    const DIA = 86400000;

    for (const c of contas) {
      const vOrig = Number(c.valorOriginal || 0);
      valorTotal += vOrig;
      if (c.dataPagamento) {
        valorPago += Number(c.valorPago || vOrig);
        porStatus.pago++;
      } else {
        valorPendente += vOrig;
        const venc = c.dataVenctoReal || c.dataVencto;
        if (venc) {
          const vd = new Date(venc); vd.setHours(0, 0, 0, 0);
          if (vd < hoje) {
            qVencidas++; porStatus.vencido++; valorVencido += vOrig;
            const dias = Math.round((hoje.getTime() - vd.getTime()) / DIA);
            if      (dias <= 30) { aging.d1a30.qty++;  aging.d1a30.valor  += vOrig; }
            else if (dias <= 60) { aging.d31a60.qty++; aging.d31a60.valor += vOrig; }
            else if (dias <= 90) { aging.d61a90.qty++; aging.d61a90.valor += vOrig; }
            else                 { aging.mais90.qty++; aging.mais90.valor += vOrig; }
          } else {
            qAVencer++; porStatus.a_vencer++; valorAVencer += vOrig;
            const ate = Math.round((vd.getTime() - hoje.getTime()) / DIA);
            if (ate <= 7)  { prox7q++;  prox7v  += vOrig; }
            if (ate <= 30) { prox30q++; prox30v += vOrig; }
          }
        } else {
          qAVencer++; porStatus.a_vencer++; valorAVencer += vOrig;
        }
      }

      fornecedoresSet.add(c.fornecedorNome);
      const nomeForn = (c.fornecedorNome || "").slice(0, 40);
      porFornecedor[nomeForn] = (porFornecedor[nomeForn] || 0) + vOrig;

      const tipoKey = c.tipo || "—";
      porTipo[tipoKey] = (porTipo[tipoKey] || 0) + 1;

      const natKey = (c.natureza || "—");
      porNatureza[natKey] = (porNatureza[natKey] || 0) + vOrig;

      const refDate = c.dataVenctoReal || c.dataVencto || c.dataEmissao;
      if (refDate) {
        const d = new Date(refDate);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleString("pt-BR", { month: "short", year: "2-digit" });
        if (!porMes.has(key)) porMes.set(key, { label, pendente: 0, pago: 0 });
        const m = porMes.get(key)!;
        if (c.dataPagamento) m.pago += vOrig; else m.pendente += vOrig;
      }
    }

    const topFornecedores = Object.entries(porFornecedor)
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([nome, valor]) => ({ nome, valor }));

    const evolucaoMensal = [...porMes.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([, v]) => v);

    const distribuicaoStatus = Object.entries(porStatus)
      .map(([status, qty]) => ({ status, qty }));

    const distribuicaoTipo = Object.entries(porTipo)
      .sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([tipo, qty]) => ({ tipo, qty }));

    const topNatureza = Object.entries(porNatureza)
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([natureza, valor]) => ({ natureza, valor }));

    const agingArr = [
      { faixa: "1-30 dias",  qty: aging.d1a30.qty,  valor: aging.d1a30.valor },
      { faixa: "31-60 dias", qty: aging.d31a60.qty, valor: aging.d31a60.valor },
      { faixa: "61-90 dias", qty: aging.d61a90.qty, valor: aging.d61a90.valor },
      { faixa: "90+ dias",   qty: aging.mais90.qty, valor: aging.mais90.valor },
    ];

    return {
      kpis: {
        total: contas.length,
        valorTotal, valorPago, valorPendente,
        valorVencido, valorAVencer,
        ticketMedio: contas.length ? valorTotal / contas.length : 0,
        qVencidas, qAVencer,
        qFornecedores: fornecedoresSet.size,
      },
      proximos: {
        d7:  { qty: prox7q,  valor: prox7v },
        d30: { qty: prox30q, valor: prox30v },
      },
      aging: agingArr,
      distribuicaoStatus,
      distribuicaoTipo,
      topFornecedores,
      topNatureza,
      evolucaoMensal,
    };
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  @Get("contas-a-pagar/exportar")
  @Permissions("financeiro:ver")
  async exportar(
    @Req() req: any,
    @Query("q")           q?: string,
    @Query("status")      statusQ?: string,
    @Query("tipo")        tipo?: string,
    @Query("fornecedor")  fornecedor?: string,
    @Query("centroCusto") centroCusto?: string,
    @Query("inicio")      inicio?: string,
    @Query("fim")         fim?: string,
  ) {
    const where = this.buildWhere(req, { q, statusQ, tipo, fornecedor, centroCusto, inicio, fim });
    const rows = await (this.prisma as any).contaPagar.findMany({
      where, orderBy: { dataVenctoReal: "asc" }, take: 5000,
    });

    const fmtD = (d: any) => d ? new Date(d).toLocaleDateString("pt-BR") : "";
    const fmtV = (v: any) => v != null ? Number(v).toFixed(2).replace(".", ",") : "";
    const fmtSt = (c: any) => c.dataPagamento ? "Pago" : (c.dataVenctoReal && new Date(c.dataVenctoReal) < new Date() ? "Vencido" : "A Vencer");

    const header = "Fornecedor;Código;Número;Parcela;Tipo;Natureza;Emissão;Vencimento;Venc.Real;Valor Original;Venc.Nominal;Venc.Corrigido;A Vencer;Juros;Dias Atraso;Status;Portador;Histórico;C.Custo;CtA Contab;Pedido;Observação";
    const lines = rows.map((c: any) => [
      c.fornecedorNome, c.fornecedorCodigo || "", c.numero, c.parcela || "", c.tipo, c.natureza || "",
      fmtD(c.dataEmissao), fmtD(c.dataVencto), fmtD(c.dataVenctoReal),
      fmtV(c.valorOriginal), fmtV(c.valorVencidoNominal), fmtV(c.valorVencidoCorrigido), fmtV(c.valorAVencerNominal), fmtV(c.valorJuros),
      c.diasAtraso ?? "", fmtSt(c), c.portador || "", c.historico || "",
      c.centroCusto || "", c.ctaContab || "", c.pedido || "", c.observacao || "",
    ].join(";"));

    return { csv: [header, ...lines].join("\n"), total: rows.length };
  }

  @Get("contas-a-pagar")
  @Permissions("financeiro:ver")
  async list(
    @Req() req: any,
    @Query("page")        pageQ = "1",
    @Query("limit")       limitQ = "50",
    @Query("q")           q?: string,
    @Query("status")      statusQ?: string,
    @Query("tipo")        tipo?: string,
    @Query("fornecedor")  fornecedor?: string,
    @Query("centroCusto") centroCusto?: string,
    @Query("natureza")    natureza?: string,
    @Query("inicio")      inicio?: string,
    @Query("fim")         fim?: string,
    @Query("ordenar")     ordenar = "dataVenctoReal",
    @Query("dir")         dir = "asc",
  ) {
    const page  = Math.max(1, parseInt(pageQ) || 1);
    const limit = Math.min(200, parseInt(limitQ) || 50);
    const where = this.buildWhere(req, { q, statusQ, tipo, fornecedor, centroCusto, natureza, inicio, fim });

    const allowed = ["dataVenctoReal","dataVencto","fornecedorNome","valorOriginal","tipo","criadoEm","numero","diasAtraso"];
    const orderBy: any = {};
    orderBy[allowed.includes(ordenar) ? ordenar : "dataVenctoReal"] = dir === "desc" ? "desc" : "asc";

    const [total, rows] = await Promise.all([
      (this.prisma as any).contaPagar.count({ where }),
      (this.prisma as any).contaPagar.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit }),
    ]);

    return { total, page, limit, totalPages: Math.ceil(total / limit), rows: rows.map(mapConta) };
  }

  @Get("contas-a-pagar/:id")
  @Permissions("financeiro:ver")
  async findOne(@Param("id") id: string, @Req() req: any) {
    const orgId = req.user?.organizationId;
    const c = await (this.prisma as any).contaPagar.findFirst({
      where: { id, ...(orgId ? { organizationId: orgId } : {}) },
    });
    if (!c) throw new NotFoundException("Conta não encontrada");
    return mapConta(c);
  }

  @Post("contas-a-pagar/importar")
  @Permissions("financeiro:gerenciar")
  async importar(@Body() body: { rows: any[] }, @Req() req: any) {
    const orgId = req.user?.organizationId;
    if (!Array.isArray(body.rows) || body.rows.length === 0)
      throw new BadRequestException("Sem linhas para importar");

    const importadoEm = new Date();
    let inseridos = 0, atualizados = 0, erros = 0;
    const errosDetalhe: string[] = [];

    for (const row of body.rows) {
      try {
        const data = parseRow(row, orgId, importadoEm);
        if (!data.fornecedorNome || data.numero === "0") {
          erros++; errosDetalhe.push("Linha sem fornecedor ou número válido"); continue;
        }

        const exists = await (this.prisma as any).contaPagar.findFirst({
          where: {
            organizationId: orgId,
            numero: data.numero,
            parcela: data.parcela ?? null,
            tipo: data.tipo,
            fornecedorNome: data.fornecedorNome,
          },
        });

        if (exists) {
          const { id: _id, organizationId: _org, importadoEm: _imp, dataPagamento: _dp, valorPago: _vp, ...upd } = data;
          await (this.prisma as any).contaPagar.update({ where: { id: exists.id }, data: { ...upd, importadoEm } });
          atualizados++;
        } else {
          await (this.prisma as any).contaPagar.create({ data });
          inseridos++;
        }
      } catch (e: any) {
        erros++;
        if (errosDetalhe.length < 20) errosDetalhe.push(e.message || "Erro desconhecido");
      }
    }

    return { inseridos, atualizados, erros, errosDetalhe };
  }

  @Post("contas-a-pagar")
  @Permissions("financeiro:gerenciar")
  async create(@Body() dto: any, @Req() req: any) {
    const orgId = req.user?.organizationId;
    if (!dto.fornecedorNome?.trim()) throw new BadRequestException("Fornecedor obrigatório");
    if (!dto.numero?.trim())         throw new BadRequestException("Número obrigatório");
    return mapConta(await (this.prisma as any).contaPagar.create({
      data: {
        id: uuid(), organizationId: orgId,
        fornecedorCodigo:      dto.fornecedorCodigo || null,
        fornecedorNome:        dto.fornecedorNome,
        prefixo:               dto.prefixo || null,
        numero:                dto.numero,
        parcela:               dto.parcela || null,
        tipo:                  dto.tipo || "NF",
        natureza:              dto.natureza || null,
        dataEmissao:           toDate(dto.dataEmissao),
        dataVencto:            toDate(dto.dataVencto),
        dataVenctoReal:        toDate(dto.dataVenctoReal),
        dataPagamento:         toDate(dto.dataPagamento),
        valorOriginal:         toNum(dto.valorOriginal),
        valorVencidoNominal:   toNum(dto.valorVencidoNominal),
        valorVencidoCorrigido: toNum(dto.valorVencidoCorrigido),
        valorAVencerNominal:   toNum(dto.valorAVencerNominal),
        valorJuros:            toNum(dto.valorJuros),
        valorPago:             toNum(dto.valorPago),
        portador:    dto.portador    || null,
        diasAtraso:  dto.diasAtraso  != null ? parseInt(dto.diasAtraso) : null,
        historico:   dto.historico   || null,
        classeValor: dto.classeValor || null,
        observacao:  dto.observacao  || null,
        pedido:      dto.pedido      || null,
        ctaContab:   dto.ctaContab   || null,
        centroCusto: dto.centroCusto || null,
      } as any,
    }));
  }

  @Put("contas-a-pagar/:id")
  @Permissions("financeiro:gerenciar")
  async update(@Param("id") id: string, @Body() dto: any, @Req() req: any) {
    const orgId = req.user?.organizationId;
    const exists = await (this.prisma as any).contaPagar.findFirst({
      where: { id, ...(orgId ? { organizationId: orgId } : {}) },
    });
    if (!exists) throw new NotFoundException("Conta não encontrada");

    const data: any = {};
    const strFields = ["fornecedorNome","fornecedorCodigo","prefixo","numero","parcela","tipo","natureza","portador","historico","classeValor","observacao","pedido","ctaContab","centroCusto"];
    const numFields = ["valorOriginal","valorVencidoNominal","valorVencidoCorrigido","valorAVencerNominal","valorJuros","valorPago","diasAtraso"];
    const dtFields  = ["dataEmissao","dataVencto","dataVenctoReal","dataPagamento"];
    for (const f of strFields) if (dto[f] !== undefined) data[f] = dto[f] || null;
    for (const f of numFields) if (dto[f] !== undefined) data[f] = toNum(dto[f]);
    for (const f of dtFields)  if (dto[f] !== undefined) data[f] = toDate(dto[f]);

    return mapConta(await (this.prisma as any).contaPagar.update({ where: { id }, data }));
  }

  @Delete("contas-a-pagar/:id")
  @Permissions("financeiro:gerenciar")
  async remove(@Param("id") id: string, @Req() req: any) {
    const orgId = req.user?.organizationId;
    const exists = await (this.prisma as any).contaPagar.findFirst({
      where: { id, ...(orgId ? { organizationId: orgId } : {}) },
    });
    if (!exists) throw new NotFoundException("Conta não encontrada");
    await (this.prisma as any).contaPagar.delete({ where: { id } });
    return { message: "Removida" };
  }

  // ── Fornecedores (autocomplete) ───────────────────────────────────────────

  @Get("fornecedores-list")
  @Permissions("financeiro:ver")
  async listFornecedores(@Req() req: any, @Query("q") q?: string) {
    const orgId = req.user?.organizationId;
    const where: any = { ...(orgId ? { organizationId: orgId } : {}) };
    if (q) where.fornecedorNome = { contains: q, mode: "insensitive" };
    const rows = await (this.prisma as any).contaPagar.groupBy({
      by: ["fornecedorNome", "fornecedorCodigo"],
      where,
      orderBy: { fornecedorNome: "asc" },
      take: 50,
    });
    return rows;
  }

  // ── Private: where builder ────────────────────────────────────────────────

  private buildWhere(req: any, opts: {
    q?: string; statusQ?: string; tipo?: string;
    fornecedor?: string; centroCusto?: string; natureza?: string;
    inicio?: string; fim?: string;
  }) {
    const orgId = req.user?.organizationId;
    const where: any = { ...(orgId ? { organizationId: orgId } : {}) };
    const { q, statusQ, tipo, fornecedor, centroCusto, natureza, inicio, fim } = opts;

    if (q) where.OR = [
      { fornecedorNome: { contains: q, mode: "insensitive" } },
      { numero: { contains: q } },
      { historico: { contains: q, mode: "insensitive" } },
      { observacao: { contains: q, mode: "insensitive" } },
      { pedido: { contains: q } },
      { ctaContab: { contains: q } },
    ];
    if (tipo)        where.tipo = tipo;
    if (fornecedor)  where.fornecedorNome = { contains: fornecedor, mode: "insensitive" };
    if (centroCusto) where.centroCusto = { contains: centroCusto, mode: "insensitive" };
    if (natureza)    where.natureza = { contains: natureza };

    const hoje = new Date(); hoje.setHours(23, 59, 59, 999);
    if (statusQ === "pago")     where.dataPagamento = { not: null };
    if (statusQ === "vencido")  { where.dataPagamento = null; where.dataVenctoReal = { ...(where.dataVenctoReal || {}), lt: hoje }; }
    if (statusQ === "a_vencer") { where.dataPagamento = null; where.dataVenctoReal = { ...(where.dataVenctoReal || {}), gte: hoje }; }

    if (inicio || fim) {
      const prev = where.dataVenctoReal || {};
      if (!statusQ) where.dataVenctoReal = prev;
      if (inicio) where.dataVenctoReal = { ...where.dataVenctoReal, gte: new Date(inicio) };
      if (fim)    where.dataVenctoReal = { ...where.dataVenctoReal, lte: new Date(fim) };
    }

    return where;
  }
}

// ── Module ────────────────────────────────────────────────────────────────────

@Module({ controllers: [FinanceiroController] })
export class FinanceiroModule {}
