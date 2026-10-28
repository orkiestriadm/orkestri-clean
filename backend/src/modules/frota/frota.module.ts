import {
  Module, Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, Req,
  NotFoundException, BadRequestException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../../prisma/prisma.service";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { AuditModule, AuditService } from "../audit/audit.module";
import * as crypto from "crypto";

// ── Helpers de coerção / construção de payload ─────────────────────────────────
type FieldType = "string" | "int" | "float" | "bool" | "date" | "json";
type FieldDef  = { k: string; t: FieldType };

function coerce(t: FieldType, v: any): any {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  switch (t) {
    case "int":   { const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : null; }
    case "float": { const n = Number(v); return Number.isFinite(n) ? n : null; }
    case "bool":  return Boolean(v);
    case "date":  { const d = new Date(v); return isNaN(d.getTime()) ? null : d; }
    case "json":  return v;
    default:      return String(v);
  }
}

/** Monta o objeto de dados a partir do body. Em update (onlyDefined) só inclui chaves presentes. */
function buildData(body: any, fields: FieldDef[], onlyDefined = false): Record<string, any> {
  const data: Record<string, any> = {};
  for (const f of fields) {
    if (onlyDefined && body[f.k] === undefined) continue;
    const val = coerce(f.t, body[f.k]);
    if (val !== undefined) data[f.k] = val;
  }
  return data;
}

// ── Base CRUD reutilizada por todos os cadastros da frota ──────────────────────
// Soft-delete (deletedAt), auditoria de usuário (criadoPorId/atualizadoPorId +
// AuditService) e scoping multi-tenant. As subclasses só declaram a configuração.
abstract class BaseFrotaController {
  constructor(protected prisma: PrismaService, protected audit: AuditService) {}
  protected get db() { return this.prisma as any; }

  protected abstract model: string;          // delegate Prisma (ex.: "veiculo")
  protected abstract tabela: string;         // nome lógico p/ auditoria (ex.: "veiculos")
  protected abstract fields: FieldDef[];      // campos aceitos em create/update
  protected searchFields: string[] = [];      // campos para busca textual (?q=)
  protected requiredFields: string[] = [];    // campos obrigatórios no create
  protected include: any = undefined;         // include padrão das listagens
  protected includeOne: any = undefined;      // include do findOne (detalhe)
  protected orderBy: any = { criadoEm: "desc" };
  protected filterKeys: string[] = ["status", "veiculoId", "motoristaId", "categoriaId", "tipo"];

  private get delegate() { return this.db[this.model]; }

  protected scope(req: any, extra: any = {}) {
    return { organizationId: req.user?.organizationId, deletedAt: null, ...extra };
  }

  /** Hook opcional executado antes do create (ex.: gerar código). */
  protected async beforeCreate(_data: any, _req: any): Promise<void> {}
  /** Hook opcional após persistir (create/update). */
  protected async afterWrite(_row: any, _req: any, _acao: string): Promise<void> {}

  @Get()
  @Permissions("frota:ver")
  async findAll(@Req() req: any, @Query() query: any) {
    const take = Math.min(Number(query.limit) || 50, 200);
    const skip = (Math.max(Number(query.page) || 1, 1) - 1) * take;
    const where: any = this.scope(req);
    for (const k of this.filterKeys) {
      if (query[k]) where[k] = query[k];
    }
    if (query.q && this.searchFields.length) {
      where.OR = this.searchFields.map(f => ({ [f]: { contains: query.q, mode: "insensitive" } }));
    }
    const [items, total] = await Promise.all([
      this.delegate.findMany({ where, include: this.include, orderBy: this.orderBy, take, skip }),
      this.delegate.count({ where }),
    ]);
    return { items, total, page: Math.max(Number(query.page) || 1, 1), limit: take };
  }

  @Get(":id")
  @Permissions("frota:ver")
  async findOne(@Param("id") id: string, @Req() req: any) {
    const row = await this.delegate.findFirst({
      where: this.scope(req, { id }),
      include: this.includeOne || this.include,
    });
    if (!row) throw new NotFoundException("Registro não encontrado");
    return row;
  }

  @Post()
  @Permissions("frota:criar")
  async create(@Body() body: any, @Req() req: any) {
    for (const f of this.requiredFields) {
      if (body[f] === undefined || body[f] === null || String(body[f]).trim() === "")
        throw new BadRequestException(`Campo obrigatório: ${f}`);
    }
    const orgId = req.user?.organizationId;
    const data: any = {
      id: crypto.randomUUID(),
      organizationId: orgId,
      criadoPorId: req.user?.id || null,
      ...buildData(body, this.fields),
    };
    await this.beforeCreate(data, req);
    let row: any;
    try {
      row = await this.delegate.create({ data, include: this.includeOne || this.include });
    } catch (e: any) {
      if (e.code === "P2002") throw new BadRequestException("Registro duplicado (valor único já utilizado)");
      throw e;
    }
    await this.afterWrite(row, req, "criar");
    await this.audit.log({
      userId: req.user?.id, modulo: "frota", tabela: this.tabela, registroId: row.id,
      acao: "criar", descricao: `Criou ${this.tabela}`, dados: data, ip: req.ip,
    });
    return row;
  }

  @Put(":id")
  @Permissions("frota:editar")
  async update(@Param("id") id: string, @Body() body: any, @Req() req: any) {
    const existing = await this.delegate.findFirst({ where: this.scope(req, { id }) });
    if (!existing) throw new NotFoundException("Registro não encontrado");
    const data: any = {
      atualizadoPorId: req.user?.id || null,
      ...buildData(body, this.fields, true),
    };
    let row: any;
    try {
      row = await this.delegate.update({ where: { id }, data, include: this.includeOne || this.include });
    } catch (e: any) {
      if (e.code === "P2002") throw new BadRequestException("Registro duplicado (valor único já utilizado)");
      throw e;
    }
    await this.afterWrite(row, req, "editar");
    await this.audit.log({
      userId: req.user?.id, modulo: "frota", tabela: this.tabela, registroId: id,
      acao: "editar", descricao: `Editou ${this.tabela}`, dados: data, ip: req.ip,
    });
    return row;
  }

  @Delete(":id")
  @Permissions("frota:excluir")
  async remove(@Param("id") id: string, @Req() req: any) {
    const existing = await this.delegate.findFirst({ where: this.scope(req, { id }) });
    if (!existing) throw new NotFoundException("Registro não encontrado");
    await this.delegate.update({ where: { id }, data: { deletedAt: new Date(), atualizadoPorId: req.user?.id || null } });
    await this.audit.log({
      userId: req.user?.id, modulo: "frota", tabela: this.tabela, registroId: id,
      acao: "excluir", descricao: `Excluiu (lógico) ${this.tabela}`, ip: req.ip,
    });
    return { message: "Registro excluído", id };
  }
}

// ── Veículos (cadastro principal) ──────────────────────────────────────────────
const VEICULO_LIST_INCLUDE = {
  categoria: { select: { id: true, nome: true, cor: true, icone: true } },
  motorista: { select: { id: true, nome: true } },
  setor:     { select: { id: true, nome: true, cor: true } },
};

@Controller("frota/veiculos")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class VeiculosController extends BaseFrotaController {
  constructor(prisma: PrismaService, audit: AuditService) { super(prisma, audit); }
  protected model = "veiculo";
  protected tabela = "veiculos";
  protected searchFields = ["placa", "codigo", "marca", "modelo", "renavam", "chassi"];
  protected requiredFields = ["placa"];
  protected filterKeys = ["status", "categoriaId", "tipo", "combustivel", "setorId", "motoristaId"];
  protected include = VEICULO_LIST_INCLUDE;
  protected includeOne = {
    ...VEICULO_LIST_INCLUDE,
    pneus:          { where: { deletedAt: null }, orderBy: { criadoEm: "desc" } },
    revisoes:       { where: { deletedAt: null }, orderBy: { dataPrevista: "desc" }, take: 50 },
    manutencoes:    { where: { deletedAt: null }, orderBy: { criadoEm: "desc" }, take: 50 },
    documentos:     { where: { deletedAt: null }, orderBy: { dataVencimento: "asc" } },
    abastecimentos: { where: { deletedAt: null }, orderBy: { data: "desc" }, take: 50 },
  };
  protected fields: FieldDef[] = [
    { k: "codigo", t: "string" }, { k: "placa", t: "string" }, { k: "renavam", t: "string" },
    { k: "chassi", t: "string" }, { k: "marca", t: "string" }, { k: "modelo", t: "string" },
    { k: "anoFabricacao", t: "int" }, { k: "anoModelo", t: "int" }, { k: "cor", t: "string" },
    { k: "tipo", t: "string" }, { k: "combustivel", t: "string" }, { k: "categoriaId", t: "string" },
    { k: "status", t: "string" }, { k: "kmAtual", t: "int" }, { k: "capacidadeTanque", t: "float" },
    { k: "motoristaId", t: "string" }, { k: "setorId", t: "string" }, { k: "ativoId", t: "string" },
    { k: "dataAquisicao", t: "date" }, { k: "valorAquisicao", t: "float" }, { k: "observacoes", t: "string" },
  ];

  protected async beforeCreate(data: any, req: any): Promise<void> {
    if (!data.codigo) {
      const orgId = req.user?.organizationId;
      const count = await this.db.veiculo.count({ where: { organizationId: orgId } });
      let n = count + 1;
      let codigo = `FRT-${String(n).padStart(5, "0")}`;
      while (await this.db.veiculo.findFirst({ where: { organizationId: orgId, codigo } })) {
        codigo = `FRT-${String(++n).padStart(5, "0")}`;
      }
      data.codigo = codigo;
    }
    if (typeof data.placa === "string") data.placa = data.placa.toUpperCase().replace(/\s+/g, "");
  }
}

// ── Motoristas ─────────────────────────────────────────────────────────────────
@Controller("frota/motoristas")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class MotoristasController extends BaseFrotaController {
  constructor(prisma: PrismaService, audit: AuditService) { super(prisma, audit); }
  protected model = "motorista";
  protected tabela = "motoristas";
  protected searchFields = ["nome", "cpf", "cnh", "telefone", "email"];
  protected requiredFields = ["nome"];
  protected filterKeys = ["status"];
  protected fields: FieldDef[] = [
    { k: "nome", t: "string" }, { k: "cpf", t: "string" }, { k: "cnh", t: "string" },
    { k: "categoriaCnh", t: "string" }, { k: "validadeCnh", t: "date" }, { k: "telefone", t: "string" },
    { k: "email", t: "string" }, { k: "userId", t: "string" }, { k: "status", t: "string" },
    { k: "observacoes", t: "string" },
  ];
}

// ── Pneus ──────────────────────────────────────────────────────────────────────
@Controller("frota/pneus")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class PneusController extends BaseFrotaController {
  constructor(prisma: PrismaService, audit: AuditService) { super(prisma, audit); }
  protected model = "pneu";
  protected tabela = "pneus";
  protected searchFields = ["numeroSerie", "marca", "modelo", "medida", "posicao"];
  protected filterKeys = ["status", "veiculoId"];
  protected include = { veiculo: { select: { id: true, placa: true, codigo: true } } };
  protected fields: FieldDef[] = [
    { k: "veiculoId", t: "string" }, { k: "numeroSerie", t: "string" }, { k: "marca", t: "string" },
    { k: "modelo", t: "string" }, { k: "medida", t: "string" }, { k: "posicao", t: "string" },
    { k: "dataInstalacao", t: "date" }, { k: "kmInstalacao", t: "int" }, { k: "kmAtual", t: "int" },
    { k: "vidaUtilKm", t: "int" }, { k: "status", t: "string" }, { k: "observacoes", t: "string" },
  ];
}

// ── Revisões ───────────────────────────────────────────────────────────────────
@Controller("frota/revisoes")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class RevisoesController extends BaseFrotaController {
  constructor(prisma: PrismaService, audit: AuditService) { super(prisma, audit); }
  protected model = "revisaoVeiculo";
  protected tabela = "revisoes_veiculo";
  protected searchFields = ["tipo", "descricao", "oficina"];
  protected requiredFields = ["veiculoId"];
  protected filterKeys = ["status", "veiculoId", "tipo"];
  protected orderBy = { dataPrevista: "asc" } as any;
  protected include = { veiculo: { select: { id: true, placa: true, codigo: true } } };
  protected fields: FieldDef[] = [
    { k: "veiculoId", t: "string" }, { k: "tipo", t: "string" }, { k: "descricao", t: "string" },
    { k: "dataPrevista", t: "date" }, { k: "kmPrevisto", t: "int" }, { k: "dataRealizada", t: "date" },
    { k: "kmRealizado", t: "int" }, { k: "status", t: "string" }, { k: "custo", t: "float" },
    { k: "oficina", t: "string" }, { k: "observacoes", t: "string" },
  ];
}

// ── Manutenções ────────────────────────────────────────────────────────────────
@Controller("frota/manutencoes")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class ManutencoesController extends BaseFrotaController {
  constructor(prisma: PrismaService, audit: AuditService) { super(prisma, audit); }
  protected model = "manutencaoVeiculo";
  protected tabela = "manutencoes_veiculo";
  protected searchFields = ["tipo", "descricao", "oficina"];
  protected requiredFields = ["veiculoId"];
  protected filterKeys = ["status", "veiculoId", "tipo"];
  protected include = { veiculo: { select: { id: true, placa: true, codigo: true } } };
  protected fields: FieldDef[] = [
    { k: "veiculoId", t: "string" }, { k: "tipo", t: "string" }, { k: "descricao", t: "string" },
    { k: "data", t: "date" }, { k: "dataAgendada", t: "date" }, { k: "km", t: "int" },
    { k: "custo", t: "float" }, { k: "fornecedorId", t: "string" }, { k: "oficina", t: "string" },
    { k: "pecas", t: "json" }, { k: "status", t: "string" }, { k: "observacoes", t: "string" },
  ];
}

// ── Documentações ──────────────────────────────────────────────────────────────
@Controller("frota/documentos")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class DocumentosController extends BaseFrotaController {
  constructor(prisma: PrismaService, audit: AuditService) { super(prisma, audit); }
  protected model = "documentoVeiculo";
  protected tabela = "documentos_veiculo";
  protected searchFields = ["tipo", "numero", "descricao"];
  protected requiredFields = ["veiculoId"];
  protected filterKeys = ["status", "veiculoId", "tipo"];
  protected orderBy = { dataVencimento: "asc" } as any;
  protected include = { veiculo: { select: { id: true, placa: true, codigo: true } } };
  protected fields: FieldDef[] = [
    { k: "veiculoId", t: "string" }, { k: "tipo", t: "string" }, { k: "numero", t: "string" },
    { k: "descricao", t: "string" }, { k: "dataEmissao", t: "date" }, { k: "dataVencimento", t: "date" },
    { k: "valor", t: "float" }, { k: "arquivoUrl", t: "string" }, { k: "status", t: "string" },
    { k: "observacoes", t: "string" },
  ];
}

// ── Abastecimentos ─────────────────────────────────────────────────────────────
@Controller("frota/abastecimentos")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class AbastecimentosController extends BaseFrotaController {
  constructor(prisma: PrismaService, audit: AuditService) { super(prisma, audit); }
  protected model = "abastecimento";
  protected tabela = "abastecimentos";
  protected searchFields = ["posto", "tipoCombustivel"];
  protected requiredFields = ["veiculoId"];
  protected filterKeys = ["veiculoId", "motoristaId"];
  protected orderBy = { data: "desc" } as any;
  protected include = {
    veiculo:   { select: { id: true, placa: true, codigo: true } },
    motorista: { select: { id: true, nome: true } },
  };
  protected fields: FieldDef[] = [
    { k: "veiculoId", t: "string" }, { k: "motoristaId", t: "string" }, { k: "data", t: "date" },
    { k: "kmAtual", t: "int" }, { k: "litros", t: "float" }, { k: "valorLitro", t: "float" },
    { k: "valorTotal", t: "float" }, { k: "tipoCombustivel", t: "string" }, { k: "posto", t: "string" },
    { k: "tanqueCheio", t: "bool" }, { k: "observacoes", t: "string" },
  ];

  protected async beforeCreate(data: any, _req: any): Promise<void> {
    // valor total automático quando litros + valor/litro vierem e total não
    if ((data.valorTotal == null) && data.litros != null && data.valorLitro != null) {
      data.valorTotal = Number((data.litros * data.valorLitro).toFixed(2));
    }
    // consumo km/L = distância desde o último abastecimento de tanque cheio / litros atuais
    if (data.kmAtual != null && data.litros) {
      const anterior = await this.db.abastecimento.findFirst({
        where: { veiculoId: data.veiculoId, deletedAt: null, kmAtual: { not: null, lt: data.kmAtual } },
        orderBy: { data: "desc" },
      });
      if (anterior?.kmAtual != null) {
        const dist = data.kmAtual - anterior.kmAtual;
        if (dist > 0) data.consumoKmL = Number((dist / data.litros).toFixed(2));
      }
    }
    // mantém o km do veículo atualizado
    if (data.kmAtual != null) {
      await this.db.veiculo.updateMany({
        where: { id: data.veiculoId, kmAtual: { lt: data.kmAtual } },
        data: { kmAtual: data.kmAtual },
      }).catch(() => {});
    }
  }
}

// ── Categorias de veículo (Configurações) ──────────────────────────────────────
@Controller("frota/categorias")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class CategoriasVeiculoController extends BaseFrotaController {
  constructor(prisma: PrismaService, audit: AuditService) { super(prisma, audit); }
  protected model = "categoriaVeiculo";
  protected tabela = "categorias_veiculo";
  protected searchFields = ["nome", "descricao"];
  protected requiredFields = ["nome"];
  protected filterKeys = [];
  protected orderBy = { nome: "asc" } as any;
  protected fields: FieldDef[] = [
    { k: "nome", t: "string" }, { k: "descricao", t: "string" },
    { k: "icone", t: "string" }, { k: "cor", t: "string" }, { k: "ativo", t: "bool" },
  ];
}

// ── Dashboard (KPIs) ───────────────────────────────────────────────────────────
@Controller("frota/dashboard")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class FrotaDashboardController {
  constructor(private prisma: PrismaService) {}
  private get db() { return this.prisma as any; }

  @Get()
  @Permissions("frota:ver")
  async dashboard(@Req() req: any) {
    const orgId = req.user?.organizationId;
    const base = { organizationId: orgId, deletedAt: null } as any;
    const now = new Date();
    const em30 = new Date(now.getTime() + 30 * 86400000);
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalVeiculos, porStatus, totalMotoristas, manutAbertas, custoManutMes, custoAbastMes,
      cnhVencendo, docVencendo, revisoesPendentes] = await Promise.all([
      this.db.veiculo.count({ where: base }),
      this.db.veiculo.groupBy({ by: ["status"], _count: true, where: base }),
      this.db.motorista.count({ where: base }),
      this.db.manutencaoVeiculo.count({ where: { ...base, status: { notIn: ["concluida", "cancelada"] } } }),
      this.db.manutencaoVeiculo.aggregate({ _sum: { custo: true }, where: { ...base, data: { gte: inicioMes } } }),
      this.db.abastecimento.aggregate({ _sum: { valorTotal: true }, where: { ...base, data: { gte: inicioMes } } }),
      this.db.motorista.count({ where: { ...base, validadeCnh: { gte: now, lte: em30 } } }),
      this.db.documentoVeiculo.count({ where: { ...base, dataVencimento: { gte: now, lte: em30 } } }),
      this.db.revisaoVeiculo.count({ where: { ...base, status: "agendada", dataPrevista: { lte: em30 } } }),
    ]);

    return {
      totalVeiculos,
      porStatus: Object.fromEntries((porStatus as any[]).map(s => [s.status, s._count])),
      totalMotoristas,
      manutAbertas,
      custoManutMes: custoManutMes._sum.custo || 0,
      custoAbastMes: custoAbastMes._sum.valorTotal || 0,
      alertas: {
        cnhVencendo, docVencendo, revisoesPendentes,
        total: cnhVencendo + docVencendo + revisoesPendentes,
      },
    };
  }
}

// ── Relatórios ─────────────────────────────────────────────────────────────────
@Controller("frota/relatorios")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class FrotaRelatoriosController {
  constructor(private prisma: PrismaService) {}
  private get db() { return this.prisma as any; }

  private periodo(from?: string, to?: string) {
    const range: any = {};
    if (from) range.gte = new Date(from);
    if (to) { const t = new Date(to); t.setHours(23, 59, 59, 999); range.lte = t; }
    return Object.keys(range).length ? range : undefined;
  }

  @Get("custos")
  @Permissions("frota:relatorios")
  async custos(@Req() req: any, @Query("from") from?: string, @Query("to") to?: string, @Query("veiculoId") veiculoId?: string) {
    const orgId = req.user?.organizationId;
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
}

// ── Histórico de alterações (auditoria por registro) ───────────────────────────
@Controller("frota/historico")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class FrotaHistoricoController {
  constructor(private prisma: PrismaService) {}

  @Get(":tabela/:id")
  @Permissions("frota:ver")
  async historico(@Param("tabela") tabela: string, @Param("id") id: string, @Req() req: any) {
    const orgId = req.user?.organizationId;
    return this.prisma.auditLog.findMany({
      where: { organizationId: orgId, tabela, registroId: id },
      orderBy: { criadoEm: "desc" },
      take: 100,
      include: { user: { select: { id: true, nome: true, email: true, avatar: true } } },
    });
  }
}

// ── Module ─────────────────────────────────────────────────────────────────────
@Module({
  imports: [AuditModule],
  controllers: [
    FrotaDashboardController,
    VeiculosController,
    MotoristasController,
    PneusController,
    RevisoesController,
    ManutencoesController,
    DocumentosController,
    AbastecimentosController,
    CategoriasVeiculoController,
    FrotaRelatoriosController,
    FrotaHistoricoController,
  ],
  providers: [],
})
export class FrotaModule {}
