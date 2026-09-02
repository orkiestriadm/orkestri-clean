import {
  Module, Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, Req, NotFoundException, BadRequestException, Injectable, Logger,
} from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { IsOptional, IsString, IsNumber, IsInt, Min, Max, IsIn, IsBoolean } from "class-validator";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../../prisma/prisma.service";
import { WhatsAppService } from "../notifications/whatsapp.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";

// ── Gastos: despesa PESSOAL, por usuário ────────────────────────────────────────
// Cada pessoa só enxerga e mexe nos PRÓPRIOS gastos — todas as queries filtram
// por userId + organizationId. O registro nasce principalmente pelo WhatsApp
// (whatsapp-inbound), e esta tela lê/edita/complementa.

const FORMAS = ["CREDITO", "DEBITO", "PIX", "DINHEIRO", "BOLETO", "NAO_INFORMADO"] as const;
export const FORMA_LABEL: Record<string, string> = {
  CREDITO: "Crédito", DEBITO: "Débito", PIX: "Pix", DINHEIRO: "Dinheiro", BOLETO: "Boleto", NAO_INFORMADO: "Não informada",
};

function toNum(v: any): number | null {
  if (v == null || v === "") return null;
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
}

// "YYYY-MM-DD" → Date no fuso LOCAL do servidor. `new Date("YYYY-MM-DD")` é
// interpretado como UTC 00:00, o que empurra o fim do dia para trás e CORTA os
// lançamentos do próprio dia. Aqui montamos início (00:00) ou fim (23:59:59.999) locais.
function limiteDia(s: string, fimDoDia: boolean): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || "");
  if (!m) { const d = new Date(s); return isNaN(d.getTime()) ? new Date() : d; }
  return fimDoDia
    ? new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 59, 999)
    : new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0);
}

// Data de um gasto lançado na tela: meio-dia LOCAL, à prova de fuso (mesma
// convenção do WhatsApp), para cair no dia certo independentemente do horário.
function dataDoGasto(v: any): Date {
  if (!v) return new Date();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0, 0);
  const d = new Date(v);
  return isNaN(d.getTime()) ? new Date() : d;
}
function mapGasto(g: any) {
  return {
    ...g,
    valor: g.valor != null ? Number(g.valor) : 0,
    valorParcela: g.valorParcela != null ? Number(g.valorParcela) : null,
  };
}

// ── DTOs ────────────────────────────────────────────────────────────────────
class CreateGastoDto {
  @IsString() descricao!: string;
  @IsNumber() valor!: number;
  @IsOptional() @IsIn(FORMAS as unknown as string[]) formaPagamento?: string;
  @IsOptional() @IsInt() @Min(1) parcelas?: number;
  @IsOptional() @IsString() categoria?: string;
  @IsOptional() dataGasto?: any;
}
class UpdateGastoDto {
  @IsOptional() @IsString() descricao?: string;
  @IsOptional() @IsNumber() valor?: number;
  @IsOptional() @IsIn(FORMAS as unknown as string[]) formaPagamento?: string;
  @IsOptional() @IsInt() @Min(1) parcelas?: number;
  @IsOptional() @IsString() categoria?: string;
  @IsOptional() dataGasto?: any;
}
class MetaDto {
  @IsString() categoria!: string;
  @IsNumber() limiteMensal!: number;
}
// Tudo opcional para o PUT parcial funcionar; o create valida o que é obrigatório.
class RecorrenteDto {
  @IsOptional() @IsString() descricao?: string;
  @IsOptional() @IsNumber() valor?: number;
  @IsOptional() @IsString() categoria?: string;
  @IsOptional() @IsIn(FORMAS as unknown as string[]) formaPagamento?: string;
  @IsOptional() @IsInt() @Min(1) @Max(31) diaDoMes?: number;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

@Controller("gastos")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class GastosController {
  constructor(private prisma: PrismaService) {}

  private escopo(req: any) {
    return { organizationId: req.user?.organizationId, userId: req.user?.id };
  }

  // Período padrão = mês corrente.
  private periodo(inicio?: string, fim?: string) {
    const agora = new Date();
    const ini = inicio ? limiteDia(inicio, false) : new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0);
    const f = fim ? limiteDia(fim, true) : new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59, 999);
    return { ini, f };
  }

  // ── Lista (paginada, filtros) ──────────────────────────────────────────────
  @Get()
  @Permissions("gastos:ver")
  async list(
    @Req() req: any,
    @Query("page") pageQ = "1",
    @Query("limit") limitQ = "50",
    @Query("q") q?: string,
    @Query("forma") forma?: string,
    @Query("categoria") categoria?: string,
    @Query("inicio") inicio?: string,
    @Query("fim") fim?: string,
    @Query("ordenar") ordenar = "dataGasto",
    @Query("dir") dir = "desc",
  ) {
    const page = Math.max(1, parseInt(pageQ) || 1);
    const limit = Math.min(200, parseInt(limitQ) || 50);
    const where: any = { ...this.escopo(req) };
    if (q) where.descricao = { contains: q, mode: "insensitive" };
    if (forma) where.formaPagamento = forma;
    if (categoria) where.categoria = categoria;
    if (inicio || fim) {
      where.dataGasto = {};
      if (inicio) where.dataGasto.gte = limiteDia(inicio, false);
      if (fim) where.dataGasto.lte = limiteDia(fim, true);
    }
    const allowed = ["dataGasto", "valor", "descricao", "formaPagamento", "criadoEm"];
    const orderBy: any = {};
    orderBy[allowed.includes(ordenar) ? ordenar : "dataGasto"] = dir === "asc" ? "asc" : "desc";

    const [total, rows] = await Promise.all([
      (this.prisma as any).gasto.count({ where }),
      (this.prisma as any).gasto.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit }),
    ]);
    return { total, page, limit, totalPages: Math.ceil(total / limit), rows: rows.map(mapGasto) };
  }

  // ── Resumo (cartões + gráficos), sempre só do usuário ──────────────────────
  @Get("resumo")
  @Permissions("gastos:ver")
  async resumo(@Req() req: any, @Query("inicio") inicio?: string, @Query("fim") fim?: string) {
    const esc = this.escopo(req);
    const { ini, f } = this.periodo(inicio, fim);
    const agora = new Date();
    const hoje0 = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0, 0);
    const sem0 = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 6, 0, 0, 0, 0);
    const mes0 = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0);
    // Limite SUPERIOR = fim do dia/mês, não "agora". Os gastos são carimbados ao
    // meio-dia local; se o usuário olhar de manhã, `agora` (ex.: 8h) cortava os
    // lançamentos de hoje (12h) — por isso o cartão vinha zerado.
    const hojeFim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999);
    const mesFim = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59, 999);

    const somaEntre = async (gte: Date, lte: Date) => {
      const a = await (this.prisma as any).gasto.aggregate({
        where: { ...esc, dataGasto: { gte, lte } }, _sum: { valor: true }, _count: true,
      });
      return { total: Number(a._sum?.valor || 0), qtd: a._count || 0 };
    };

    const [cardHoje, cardSemana, cardMes] = await Promise.all([
      somaEntre(hoje0, hojeFim),
      somaEntre(sem0, hojeFim),
      somaEntre(mes0, mesFim),
    ]);

    const wherePer: any = { ...esc, dataGasto: { gte: ini, lte: f } };
    const [porFormaRaw, porCatRaw, doPeriodo] = await Promise.all([
      (this.prisma as any).gasto.groupBy({ by: ["formaPagamento"], where: wherePer, _sum: { valor: true }, _count: true }),
      (this.prisma as any).gasto.groupBy({ by: ["categoria"], where: wherePer, _sum: { valor: true }, _count: true }),
      (this.prisma as any).gasto.findMany({ where: wherePer, select: { dataGasto: true, valor: true, descricao: true } }),
    ]);

    // Mês anterior (para a variação) — janela fechada do mês passado.
    const mesAntIni = new Date(agora.getFullYear(), agora.getMonth() - 1, 1, 0, 0, 0, 0);
    const mesAntFim = new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59, 999);
    const cardMesAnterior = await somaEntre(mesAntIni, mesAntFim);

    let totalPeriodo = 0, qtdPeriodo = 0;
    const porForma = (porFormaRaw as any[]).map(g => {
      const v = Number(g._sum?.valor || 0); totalPeriodo += v; qtdPeriodo += g._count || 0;
      return { forma: g.formaPagamento, label: FORMA_LABEL[g.formaPagamento] || g.formaPagamento, valor: v, qtd: g._count || 0 };
    }).sort((a, b) => b.valor - a.valor);

    const porCategoria = (porCatRaw as any[]).map(g => ({
      categoria: g.categoria || "Sem categoria", valor: Number(g._sum?.valor || 0), qtd: g._count || 0,
    })).sort((a, b) => b.valor - a.valor);

    // Evolução por dia dentro do período.
    const porDiaMap = new Map<string, number>();
    for (const g of doPeriodo as any[]) {
      const d = new Date(g.dataGasto);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      porDiaMap.set(key, (porDiaMap.get(key) || 0) + Number(g.valor || 0));
    }
    const porDia = [...porDiaMap.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([dia, valor]) => ({ dia, label: dia.slice(8) + "/" + dia.slice(5, 7), valor }));

    // ── Insights ──
    // Maior gasto e média por dia no PERÍODO selecionado; projeção e variação são
    // conceitos do MÊS corrente (independem do filtro).
    let maiorGasto: { descricao: string; valor: number } | null = null;
    for (const g of doPeriodo as any[]) {
      const v = Number(g.valor || 0);
      if (!maiorGasto || v > maiorGasto.valor) maiorGasto = { descricao: g.descricao, valor: v };
    }
    const fimEfetivo = f < agora ? f : agora;
    const diasPeriodo = Math.max(1, Math.floor((fimEfetivo.getTime() - ini.getTime()) / 86400000) + 1);
    const mediaDia = totalPeriodo / diasPeriodo;

    const diaAtual = agora.getDate();
    const diasNoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
    const projecaoMes = diaAtual > 0 ? (cardMes.total / diaAtual) * diasNoMes : cardMes.total;
    const variacaoMes = cardMesAnterior.total > 0 ? (cardMes.total - cardMesAnterior.total) / cardMesAnterior.total : null;

    return {
      cards: { hoje: cardHoje, semana: cardSemana, mes: cardMes },
      insights: {
        maiorGasto, mediaDia,
        mesAtual: cardMes.total, mesAnterior: cardMesAnterior.total,
        projecaoMes, variacaoMes,
      },
      periodo: { inicio: ini, fim: f, total: totalPeriodo, qtd: qtdPeriodo, porForma, porCategoria, porDia },
    };
  }

  // ── Criar (lançamento manual pela tela) ────────────────────────────────────
  @Post()
  @Permissions("gastos:registrar")
  async create(@Req() req: any, @Body() dto: CreateGastoDto) {
    if (!dto.descricao?.trim()) throw new BadRequestException("Descrição obrigatória");
    const valor = toNum(dto.valor);
    if (valor == null || valor <= 0) throw new BadRequestException("Valor inválido");
    const parcelas = dto.parcelas && dto.parcelas > 1 ? Math.floor(dto.parcelas) : 1;
    const g = await (this.prisma as any).gasto.create({
      data: {
        ...this.escopo(req),
        descricao: dto.descricao.trim(),
        categoria: dto.categoria?.trim() || null,
        valor,
        formaPagamento: dto.formaPagamento || "NAO_INFORMADO",
        parcelas,
        valorParcela: parcelas > 1 ? Math.round((valor / parcelas) * 100) / 100 : null,
        dataGasto: dataDoGasto(dto.dataGasto),
        origem: "MANUAL",
      },
    });
    return mapGasto(g);
  }

  // ── Editar (só o próprio) ──────────────────────────────────────────────────
  @Put(":id")
  @Permissions("gastos:registrar")
  async update(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateGastoDto) {
    const exists = await (this.prisma as any).gasto.findFirst({ where: { id, ...this.escopo(req) } });
    if (!exists) throw new NotFoundException("Gasto não encontrado");

    const data: any = {};
    if (dto.descricao !== undefined) data.descricao = dto.descricao.trim();
    if (dto.categoria !== undefined) data.categoria = dto.categoria?.trim() || null;
    if (dto.formaPagamento !== undefined) data.formaPagamento = dto.formaPagamento;
    if (dto.dataGasto !== undefined) data.dataGasto = dataDoGasto(dto.dataGasto);
    const valor = dto.valor !== undefined ? toNum(dto.valor) : null;
    const parcelas = dto.parcelas !== undefined ? Math.max(1, Math.floor(dto.parcelas)) : exists.parcelas;
    if (dto.valor !== undefined || dto.parcelas !== undefined) {
      const v = valor != null ? valor : Number(exists.valor);
      data.valor = v;
      data.parcelas = parcelas;
      data.valorParcela = parcelas > 1 ? Math.round((v / parcelas) * 100) / 100 : null;
    }
    const g = await (this.prisma as any).gasto.update({ where: { id }, data });
    return mapGasto(g);
  }

  // ── Excluir (só o próprio) ─────────────────────────────────────────────────
  @Delete(":id")
  @Permissions("gastos:registrar")
  async remove(@Req() req: any, @Param("id") id: string) {
    const exists = await (this.prisma as any).gasto.findFirst({ where: { id, ...this.escopo(req) } });
    if (!exists) throw new NotFoundException("Gasto não encontrado");
    await (this.prisma as any).gasto.delete({ where: { id } });
    return { message: "Removido" };
  }

  // ── Metas / orçamento por categoria ────────────────────────────────────────
  @Get("metas")
  @Permissions("gastos:ver")
  async listarMetas(@Req() req: any) {
    const esc = this.escopo(req);
    const agora = new Date();
    const mes0 = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0);
    const mesFim = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59, 999);
    const [metas, gastosMes] = await Promise.all([
      (this.prisma as any).metaGasto.findMany({ where: esc, orderBy: { categoria: "asc" } }),
      (this.prisma as any).gasto.groupBy({ by: ["categoria"], where: { ...esc, dataGasto: { gte: mes0, lte: mesFim } }, _sum: { valor: true } }),
    ]);
    const spent = new Map<string, number>();
    for (const g of gastosMes as any[]) spent.set(g.categoria || "Sem categoria", Number(g._sum?.valor || 0));
    return (metas as any[]).map(m => ({
      id: m.id, categoria: m.categoria, limiteMensal: Number(m.limiteMensal), gastoMes: spent.get(m.categoria) || 0,
    }));
  }

  @Post("metas")
  @Permissions("gastos:registrar")
  async salvarMeta(@Req() req: any, @Body() dto: MetaDto) {
    const esc = this.escopo(req);
    const categoria = dto.categoria?.trim();
    const limite = toNum(dto.limiteMensal);
    if (!categoria) throw new BadRequestException("Categoria obrigatória");
    if (limite == null || limite <= 0) throw new BadRequestException("Limite inválido");
    const m = await (this.prisma as any).metaGasto.upsert({
      where: { organizationId_userId_categoria: { organizationId: esc.organizationId, userId: esc.userId, categoria } },
      create: { ...esc, categoria, limiteMensal: limite },
      update: { limiteMensal: limite },
    });
    return { id: m.id, categoria: m.categoria, limiteMensal: Number(m.limiteMensal) };
  }

  @Delete("metas/:id")
  @Permissions("gastos:registrar")
  async removerMeta(@Req() req: any, @Param("id") id: string) {
    const exists = await (this.prisma as any).metaGasto.findFirst({ where: { id, ...this.escopo(req) } });
    if (!exists) throw new NotFoundException("Meta não encontrada");
    await (this.prisma as any).metaGasto.delete({ where: { id } });
    return { message: "Removida" };
  }

  // ── Gastos fixos / recorrentes ─────────────────────────────────────────────
  @Get("recorrentes")
  @Permissions("gastos:ver")
  async listarRecorrentes(@Req() req: any) {
    const rs = await (this.prisma as any).gastoRecorrente.findMany({ where: this.escopo(req), orderBy: { diaDoMes: "asc" } });
    return (rs as any[]).map(r => ({ ...r, valor: Number(r.valor) }));
  }

  @Post("recorrentes")
  @Permissions("gastos:registrar")
  async criarRecorrente(@Req() req: any, @Body() dto: RecorrenteDto) {
    const valor = toNum(dto.valor);
    if (!dto.descricao?.trim()) throw new BadRequestException("Descrição obrigatória");
    if (valor == null || valor <= 0) throw new BadRequestException("Valor inválido");
    if (dto.diaDoMes == null) throw new BadRequestException("Dia do mês obrigatório");
    const r = await (this.prisma as any).gastoRecorrente.create({
      data: {
        ...this.escopo(req),
        descricao: dto.descricao.trim(),
        categoria: dto.categoria?.trim() || null,
        valor,
        formaPagamento: dto.formaPagamento || "NAO_INFORMADO",
        diaDoMes: Math.min(31, Math.max(1, Math.floor(dto.diaDoMes))),
        ativo: dto.ativo ?? true,
      },
    });
    return { ...r, valor: Number(r.valor) };
  }

  @Put("recorrentes/:id")
  @Permissions("gastos:registrar")
  async atualizarRecorrente(@Req() req: any, @Param("id") id: string, @Body() dto: RecorrenteDto) {
    const exists = await (this.prisma as any).gastoRecorrente.findFirst({ where: { id, ...this.escopo(req) } });
    if (!exists) throw new NotFoundException("Recorrente não encontrado");
    const data: any = {};
    if (dto.descricao !== undefined) data.descricao = dto.descricao.trim();
    if (dto.categoria !== undefined) data.categoria = dto.categoria?.trim() || null;
    if (dto.formaPagamento !== undefined) data.formaPagamento = dto.formaPagamento;
    if (dto.valor !== undefined) { const v = toNum(dto.valor); if (v != null && v > 0) data.valor = v; }
    if (dto.diaDoMes !== undefined && dto.diaDoMes != null) data.diaDoMes = Math.min(31, Math.max(1, Math.floor(dto.diaDoMes)));
    if (dto.ativo !== undefined) data.ativo = dto.ativo;
    const r = await (this.prisma as any).gastoRecorrente.update({ where: { id }, data });
    return { ...r, valor: Number(r.valor) };
  }

  @Delete("recorrentes/:id")
  @Permissions("gastos:registrar")
  async removerRecorrente(@Req() req: any, @Param("id") id: string) {
    const exists = await (this.prisma as any).gastoRecorrente.findFirst({ where: { id, ...this.escopo(req) } });
    if (!exists) throw new NotFoundException("Recorrente não encontrado");
    await (this.prisma as any).gastoRecorrente.delete({ where: { id } });
    return { message: "Removido" };
  }
}

// ── Resumo semanal automático (proativo, com opt-out) ───────────────────────────
// Domingo 20:00 (fuso local). Só para quem TEVE gasto na semana e não desligou
// (comando "parar resumo"). É a mesma ideia dos lembretes de agenda: notificação
// do sistema pelo WhatsApp já conectado da organização — sem custo por mensagem.
@Injectable()
export class GastosScheduler {
  private readonly logger = new Logger("GastosScheduler");
  constructor(private prisma: PrismaService, private wa: WhatsAppService) {}

  @Cron("0 20 * * 0", { timeZone: "America/Sao_Paulo" })
  async resumoSemanal() {
    try {
      const desde = new Date();
      desde.setDate(desde.getDate() - 7);
      desde.setHours(0, 0, 0, 0);

      const gastos = await (this.prisma as any).gasto.findMany({
        where: { dataGasto: { gte: desde } },
        select: { userId: true, organizationId: true, valor: true, categoria: true },
      });
      if (!gastos.length) return;

      const porUser = new Map<string, { org: string; total: number; qtd: number; cats: Map<string, number> }>();
      for (const g of gastos as any[]) {
        let u = porUser.get(g.userId);
        if (!u) { u = { org: g.organizationId, total: 0, qtd: 0, cats: new Map() }; porUser.set(g.userId, u); }
        const v = Number(g.valor || 0);
        u.total += v; u.qtd++;
        const c = g.categoria || "Outros";
        u.cats.set(c, (u.cats.get(c) || 0) + v);
      }

      const perfis = await this.prisma.userProfile.findMany({
        where: { userId: { in: [...porUser.keys()] }, NOT: { whatsapp: null } } as any,
        select: { userId: true, whatsapp: true, resumoGastosOff: true, user: { select: { nome: true, ativo: true } } } as any,
      });

      const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      let enviados = 0;
      for (const p of perfis as any[]) {
        if (p.resumoGastosOff || !p.user?.ativo || !p.whatsapp) continue;
        const u = porUser.get(p.userId);
        if (!u || u.total <= 0) continue;
        const nome = (p.user?.nome || "").trim().split(/\s+/)[0];
        const topCat = [...u.cats.entries()].sort((a, b) => b[1] - a[1])[0];
        let msg = `📊 *Seu resumo da semana${nome ? ", " + nome : ""}*\n\n`;
        msg += `Você registrou ${u.qtd} ${u.qtd === 1 ? "gasto" : "gastos"}, somando *R$ ${fmt(u.total)}*.`;
        if (topCat) msg += `\nMaior categoria: *${topCat[0]}* — R$ ${fmt(topCat[1])}.`;
        msg += `\n\n📱 Ver tudo: *Financeiro › Meus Gastos* no sistema.\n_Não quer mais este resumo? Responda *parar resumo*._`;
        const ok = await this.wa.sendMessageForOrg(u.org, p.whatsapp, msg).catch(() => false);
        if (ok) enviados++;
        await new Promise(r => setTimeout(r, 400)); // throttle leve para não sobrecarregar o gateway
      }
      this.logger.log(`Resumo semanal de gastos: ${enviados} enviados (de ${perfis.length} perfis com WhatsApp)`);
    } catch (e: any) {
      this.logger.error(`Falha no resumo semanal de gastos: ${e?.message || e}`);
    }
  }

  // Todo dia de manhã: lança os gastos fixos cujo dia é hoje (uma vez por mês) e
  // avisa a pessoa pelo WhatsApp, com desfazer ("apagar").
  @Cron("0 8 * * *", { timeZone: "America/Sao_Paulo" })
  async lancarRecorrentes() {
    try {
      const agora = new Date();
      const dia = agora.getDate();
      const ultimoDiaMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
      const mes0 = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0);

      const recs = await (this.prisma as any).gastoRecorrente.findMany({ where: { ativo: true } });
      const fmt = (n: any) => Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      let criados = 0;
      for (const r of recs as any[]) {
        // Dia efetivo: se o dia configurado passa do fim do mês (ex.: 31 em fevereiro), usa o último dia.
        const diaAlvo = Math.min(r.diaDoMes, ultimoDiaMes);
        if (diaAlvo !== dia) continue;
        // Já lançou este mês? (evita duplicar se o cron rodar de novo)
        if (r.ultimoLancamento && new Date(r.ultimoLancamento) >= mes0) continue;

        const dataGasto = new Date(agora.getFullYear(), agora.getMonth(), dia, 12, 0, 0, 0);
        await (this.prisma as any).gasto.create({
          data: {
            organizationId: r.organizationId, userId: r.userId,
            descricao: r.descricao, categoria: r.categoria, valor: r.valor,
            formaPagamento: r.formaPagamento, parcelas: 1, valorParcela: null,
            dataGasto, origem: "RECORRENTE",
          },
        });
        await (this.prisma as any).gastoRecorrente.update({ where: { id: r.id }, data: { ultimoLancamento: agora } });
        criados++;

        const perfil = await this.prisma.userProfile.findUnique({
          where: { userId: r.userId }, select: { whatsapp: true } as any,
        }).catch(() => null);
        if ((perfil as any)?.whatsapp) {
          await this.wa.sendMessageForOrg(r.organizationId, (perfil as any).whatsapp,
            `🔁 Lancei seu gasto fixo: *${r.descricao}* — R$ ${fmt(r.valor)}.\n_Não era pra lançar? Responda *apagar*._`).catch(() => {});
          await new Promise(res => setTimeout(res, 300));
        }
      }
      if (criados) this.logger.log(`Gastos recorrentes lançados: ${criados}`);
    } catch (e: any) {
      this.logger.error(`Falha ao lançar recorrentes: ${e?.message || e}`);
    }
  }
}

@Module({
  imports: [NotificationsModule],
  controllers: [GastosController],
  providers: [GastosScheduler],
})
export class GastosModule {}
