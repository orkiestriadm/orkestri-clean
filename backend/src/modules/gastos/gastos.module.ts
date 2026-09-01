import {
  Module, Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, Req, NotFoundException, BadRequestException,
} from "@nestjs/common";
import { IsOptional, IsString, IsNumber, IsInt, Min, IsIn } from "class-validator";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../../prisma/prisma.service";
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
  @Permissions("financeiro:ver")
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
  @Permissions("financeiro:ver")
  async resumo(@Req() req: any, @Query("inicio") inicio?: string, @Query("fim") fim?: string) {
    const esc = this.escopo(req);
    const { ini, f } = this.periodo(inicio, fim);
    const agora = new Date();
    const hoje0 = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0, 0);
    const sem0 = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 6, 0, 0, 0, 0);
    const mes0 = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0);

    const somaEntre = async (gte: Date, lte: Date) => {
      const a = await (this.prisma as any).gasto.aggregate({
        where: { ...esc, dataGasto: { gte, lte } }, _sum: { valor: true }, _count: true,
      });
      return { total: Number(a._sum?.valor || 0), qtd: a._count || 0 };
    };

    const [cardHoje, cardSemana, cardMes] = await Promise.all([
      somaEntre(hoje0, agora),
      somaEntre(sem0, agora),
      somaEntre(mes0, agora),
    ]);

    const wherePer: any = { ...esc, dataGasto: { gte: ini, lte: f } };
    const [porFormaRaw, porCatRaw, doPeriodo] = await Promise.all([
      (this.prisma as any).gasto.groupBy({ by: ["formaPagamento"], where: wherePer, _sum: { valor: true }, _count: true }),
      (this.prisma as any).gasto.groupBy({ by: ["categoria"], where: wherePer, _sum: { valor: true }, _count: true }),
      (this.prisma as any).gasto.findMany({ where: wherePer, select: { dataGasto: true, valor: true } }),
    ]);

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

    return {
      cards: { hoje: cardHoje, semana: cardSemana, mes: cardMes },
      periodo: { inicio: ini, fim: f, total: totalPeriodo, qtd: qtdPeriodo, porForma, porCategoria, porDia },
    };
  }

  // ── Criar (lançamento manual pela tela) ────────────────────────────────────
  @Post()
  @Permissions("financeiro:gerenciar")
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
  @Permissions("financeiro:gerenciar")
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
  @Permissions("financeiro:gerenciar")
  async remove(@Req() req: any, @Param("id") id: string) {
    const exists = await (this.prisma as any).gasto.findFirst({ where: { id, ...this.escopo(req) } });
    if (!exists) throw new NotFoundException("Gasto não encontrado");
    await (this.prisma as any).gasto.delete({ where: { id } });
    return { message: "Removido" };
  }
}

@Module({ controllers: [GastosController] })
export class GastosModule {}
