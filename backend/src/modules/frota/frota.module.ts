import {
  Module, Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, UseGuards, Req,
  NotFoundException, BadRequestException,
  UseInterceptors, UploadedFile,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import * as path from "path";
import * as fs from "fs";
import { PrismaService } from "../../prisma/prisma.service";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { AuditModule, AuditService } from "../audit/audit.module";
import * as crypto from "crypto";
import { EmailService } from "../notifications/email.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { FrotaRelatoriosService } from "./frota-relatorios.service";

const FROTA_UPLOAD_DIR = process.env.UPLOAD_DIR || "/app/uploads";
const ANEXO_TIPOS = ["cnh_frente", "cnh_verso", "exame", "certificado"];

// Layout-padrão de posições de pneus por tipo de veículo (x/y em grid 0-100 p/ árvore visual)
type PneuPos = { codigo: string; label: string; x: number; y: number };
const DEFAULT_PNEU_LAYOUTS: Record<string, PneuPos[]> = {
  carro: [
    { codigo: "DE", label: "Dianteiro Esquerdo", x: 28, y: 20 },
    { codigo: "DD", label: "Dianteiro Direito", x: 72, y: 20 },
    { codigo: "TE", label: "Traseiro Esquerdo", x: 28, y: 78 },
    { codigo: "TD", label: "Traseiro Direito", x: 72, y: 78 },
    { codigo: "ESTEPE", label: "Estepe", x: 50, y: 50 },
  ],
  moto: [
    { codigo: "D", label: "Dianteiro", x: 50, y: 18 },
    { codigo: "T", label: "Traseiro", x: 50, y: 80 },
  ],
  van: [
    { codigo: "DE", label: "Dianteiro Esquerdo", x: 28, y: 18 },
    { codigo: "DD", label: "Dianteiro Direito", x: 72, y: 18 },
    { codigo: "TEE", label: "Traseiro Esq. Externo", x: 22, y: 82 },
    { codigo: "TEI", label: "Traseiro Esq. Interno", x: 38, y: 82 },
    { codigo: "TDI", label: "Traseiro Dir. Interno", x: 62, y: 82 },
    { codigo: "TDE", label: "Traseiro Dir. Externo", x: 78, y: 82 },
    { codigo: "ESTEPE", label: "Estepe", x: 50, y: 50 },
  ],
  onibus: [
    { codigo: "DE", label: "Dianteiro Esquerdo", x: 28, y: 16 },
    { codigo: "DD", label: "Dianteiro Direito", x: 72, y: 16 },
    { codigo: "TEE", label: "Traseiro Esq. Externo", x: 22, y: 84 },
    { codigo: "TEI", label: "Traseiro Esq. Interno", x: 38, y: 84 },
    { codigo: "TDI", label: "Traseiro Dir. Interno", x: 62, y: 84 },
    { codigo: "TDE", label: "Traseiro Dir. Externo", x: 78, y: 84 },
    { codigo: "ESTEPE", label: "Estepe", x: 50, y: 50 },
  ],
  caminhao: [
    { codigo: "1DE", label: "1º Eixo Esquerdo", x: 28, y: 12 },
    { codigo: "1DD", label: "1º Eixo Direito", x: 72, y: 12 },
    { codigo: "2EE", label: "2º Eixo Esq. Externo", x: 22, y: 52 },
    { codigo: "2EI", label: "2º Eixo Esq. Interno", x: 38, y: 52 },
    { codigo: "2DI", label: "2º Eixo Dir. Interno", x: 62, y: 52 },
    { codigo: "2DE", label: "2º Eixo Dir. Externo", x: 78, y: 52 },
    { codigo: "3EE", label: "3º Eixo Esq. Externo", x: 22, y: 84 },
    { codigo: "3EI", label: "3º Eixo Esq. Interno", x: 38, y: 84 },
    { codigo: "3DI", label: "3º Eixo Dir. Interno", x: 62, y: 84 },
    { codigo: "3DE", label: "3º Eixo Dir. Externo", x: 78, y: 84 },
    { codigo: "ESTEPE", label: "Estepe", x: 50, y: 35 },
  ],
};
function defaultPneuLayout(tipo: string): PneuPos[] {
  return DEFAULT_PNEU_LAYOUTS[tipo] || DEFAULT_PNEU_LAYOUTS.carro;
}

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
  categoria:   { select: { id: true, nome: true, cor: true, icone: true } },
  motorista:   { select: { id: true, nome: true } },
  responsavel: { select: { id: true, nome: true, email: true, avatar: true } },
  centroCusto: { select: { id: true, nome: true, codigo: true } },
  setor:       { select: { id: true, nome: true, cor: true } },
};

@Controller("frota/veiculos")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class VeiculosController extends BaseFrotaController {
  constructor(prisma: PrismaService, audit: AuditService) { super(prisma, audit); }
  protected model = "veiculo";
  protected tabela = "veiculos";
  protected searchFields = ["placa", "codigo", "marca", "modelo", "renavam", "chassi"];
  protected requiredFields = ["placa"];
  protected filterKeys = ["status", "categoriaId", "tipo", "combustivel", "setorId", "motoristaId", "responsavelId", "centroCustoId"];
  protected include = VEICULO_LIST_INCLUDE;
  protected includeOne = {
    ...VEICULO_LIST_INCLUDE,
    pneus:          { where: { deletedAt: null }, orderBy: { criadoEm: "desc" } },
    revisoes:       { where: { deletedAt: null }, orderBy: { dataPrevista: "desc" }, take: 50 },
    manutencoes:    { where: { deletedAt: null }, orderBy: { criadoEm: "desc" }, take: 50 },
    documentos:     { where: { deletedAt: null }, orderBy: { dataVencimento: "asc" } },
    abastecimentos: { where: { deletedAt: null }, orderBy: { data: "desc" }, take: 50, include: { motorista: { select: { id: true, nome: true } } } },
    condutores:     { where: { deletedAt: null }, orderBy: { dataInicio: "desc" }, include: { motorista: { select: { id: true, nome: true } } } },
  };
  protected fields: FieldDef[] = [
    { k: "codigo", t: "string" }, { k: "placa", t: "string" }, { k: "renavam", t: "string" },
    { k: "chassi", t: "string" }, { k: "marca", t: "string" }, { k: "modelo", t: "string" },
    { k: "anoFabricacao", t: "int" }, { k: "anoModelo", t: "int" }, { k: "cor", t: "string" },
    { k: "tipo", t: "string" }, { k: "combustivel", t: "string" }, { k: "categoriaId", t: "string" },
    { k: "status", t: "string" }, { k: "kmAtual", t: "int" }, { k: "horimetroAtual", t: "int" }, { k: "capacidadeTanque", t: "float" },
    { k: "motoristaId", t: "string" }, { k: "responsavelId", t: "string" }, { k: "centroCustoId", t: "string" },
    { k: "unidade", t: "string" }, { k: "setorId", t: "string" }, { k: "ativoId", t: "string" },
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

  // GET /frota/veiculos/:id/timeline — linha do tempo completa do veículo
  @Get(":id/timeline")
  @Permissions("frota:ver")
  async timeline(@Param("id") id: string, @Req() req: any) {
    const orgId = req.user?.organizationId;
    const v = await this.db.veiculo.findFirst({ where: { id, organizationId: orgId, deletedAt: null } });
    if (!v) throw new NotFoundException("Veículo não encontrado");
    const w = { veiculoId: id, deletedAt: null };
    const [pneus, revisoes, manut, abast, docs, cond, logs] = await Promise.all([
      this.db.pneu.findMany({ where: w }),
      this.db.revisaoVeiculo.findMany({ where: w }),
      this.db.manutencaoVeiculo.findMany({ where: w }),
      this.db.abastecimento.findMany({ where: w, include: { motorista: { select: { nome: true } } } }),
      this.db.documentoVeiculo.findMany({ where: w }),
      this.db.veiculoCondutor.findMany({ where: w, include: { motorista: { select: { nome: true } } } }),
      this.db.auditLog.findMany({ where: { organizationId: orgId, tabela: "veiculos", registroId: id }, include: { user: { select: { nome: true } } }, take: 100 }),
    ]);

    const ev: any[] = [];
    ev.push({ tipo: "cadastro", data: v.criadoEm, titulo: "Veículo cadastrado", descricao: `${v.placa} — ${[v.marca, v.modelo].filter(Boolean).join(" ")}` });
    for (const p of pneus) ev.push({ tipo: "pneu", data: p.dataInstalacao || p.criadoEm, titulo: "Pneu instalado", descricao: [p.marca, p.medida, p.posicao].filter(Boolean).join(" · "), valor: null });
    for (const r of revisoes) ev.push({ tipo: "revisao", data: r.dataRealizada || r.dataPrevista || r.criadoEm, titulo: `Revisão${r.dataRealizada ? " realizada" : " agendada"}`, descricao: [r.tipo, r.oficina].filter(Boolean).join(" · "), valor: r.custo ?? null });
    for (const m of manut) ev.push({ tipo: "manutencao", data: m.data || m.dataAgendada || m.criadoEm, titulo: `Manutenção ${m.tipo || ""}`.trim(), descricao: [m.descricao, m.oficina].filter(Boolean).join(" · "), valor: m.custo ?? null });
    for (const a of abast) ev.push({ tipo: "abastecimento", data: a.data, titulo: "Abastecimento", descricao: [a.posto, a.litros != null ? `${a.litros} L` : "", a.motorista?.nome].filter(Boolean).join(" · "), valor: a.valorTotal ?? null });
    for (const d of docs) ev.push({ tipo: "documento", data: d.dataEmissao || d.criadoEm, titulo: `Documento ${String(d.tipo).toUpperCase()}`, descricao: [d.numero, d.dataVencimento ? `vence ${new Date(d.dataVencimento).toLocaleDateString("pt-BR")}` : ""].filter(Boolean).join(" · "), valor: d.valor ?? null });
    for (const c of cond) {
      ev.push({ tipo: "condutor", data: c.dataInicio, titulo: "Condutor designado", descricao: [c.motorista?.nome, c.motivo].filter(Boolean).join(" · "), valor: null });
      if (c.dataFim) ev.push({ tipo: "condutor", data: c.dataFim, titulo: "Condutor encerrado", descricao: c.motorista?.nome || "", valor: null });
    }
    for (const l of logs) {
      if (l.acao === "criar") continue; // já coberto pelo evento de cadastro
      ev.push({ tipo: "auditoria", data: l.criadoEm, titulo: l.acao === "excluir" ? "Veículo excluído" : "Cadastro alterado", descricao: l.user?.nome || "Sistema", valor: null });
    }

    ev.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    return { veiculo: { id: v.id, placa: v.placa, codigo: v.codigo }, eventos: ev };
  }

  // GET /frota/veiculos/:id/pneus-tree — layout de posições + pneus instalados
  @Get(":id/pneus-tree")
  @Permissions("frota:ver")
  async pneusTree(@Param("id") id: string, @Req() req: any) {
    const orgId = req.user?.organizationId;
    const v = await this.db.veiculo.findFirst({ where: { id, organizationId: orgId, deletedAt: null }, select: { id: true, tipo: true, placa: true, kmAtual: true } });
    if (!v) throw new NotFoundException("Veículo não encontrado");
    const layoutRow = await this.db.pneuLayout.findFirst({ where: { organizationId: orgId, tipo: v.tipo } });
    const posicoes = layoutRow?.posicoes || defaultPneuLayout(v.tipo);
    const pneus = await this.db.pneu.findMany({
      where: { veiculoId: id, deletedAt: null, status: "em_uso" },
      select: { id: true, numeroFogo: true, codigo: true, marca: true, modelo: true, medida: true, posicao: true, kmInicial: true, kmAtual: true, vidaUtilKm: true, valorCompra: true },
    });
    return { veiculo: v, posicoes, pneus };
  }
}

// ── Motoristas ─────────────────────────────────────────────────────────────────
@Controller("frota/motoristas")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class MotoristasController extends BaseFrotaController {
  constructor(prisma: PrismaService, audit: AuditService) { super(prisma, audit); }
  protected model = "motorista";
  protected tabela = "motoristas";
  protected searchFields = ["nome", "cpf", "matricula", "cnh", "telefone", "email"];
  protected requiredFields = ["nome"];
  protected filterKeys = ["status", "categoriaCnh"];
  protected fields: FieldDef[] = [
    { k: "nome", t: "string" }, { k: "cpf", t: "string" }, { k: "matricula", t: "string" },
    { k: "departamento", t: "string" }, { k: "cargo", t: "string" },
    { k: "cnh", t: "string" }, { k: "categoriaCnh", t: "string" }, { k: "cnhEmissao", t: "date" },
    { k: "validadeCnh", t: "date" }, { k: "orgaoEmissor", t: "string" },
    { k: "telefone", t: "string" }, { k: "email", t: "string" }, { k: "userId", t: "string" },
    { k: "status", t: "string" }, { k: "observacoes", t: "string" },
  ];

  // GET /frota/motoristas/cnh/dashboard — estatísticas de vencimento da CNH
  @Get("cnh/dashboard")
  @Permissions("frota:ver")
  async cnhDashboard(@Req() req: any) {
    const orgId = req.user?.organizationId;
    const base = { organizationId: orgId, deletedAt: null } as any;
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const dia = (n: number) => new Date(hoje.getTime() + n * 86400000);

    const [total, semCnh, vencida, d7, d15, d30, d60, d90] = await Promise.all([
      this.db.motorista.count({ where: base }),
      this.db.motorista.count({ where: { ...base, validadeCnh: null } }),
      this.db.motorista.count({ where: { ...base, validadeCnh: { lt: hoje } } }),
      this.db.motorista.count({ where: { ...base, validadeCnh: { gte: hoje, lte: dia(7) } } }),
      this.db.motorista.count({ where: { ...base, validadeCnh: { gt: dia(7), lte: dia(15) } } }),
      this.db.motorista.count({ where: { ...base, validadeCnh: { gt: dia(15), lte: dia(30) } } }),
      this.db.motorista.count({ where: { ...base, validadeCnh: { gt: dia(30), lte: dia(60) } } }),
      this.db.motorista.count({ where: { ...base, validadeCnh: { gt: dia(60), lte: dia(90) } } }),
    ]);
    const validas = total - semCnh - vencida - d7 - d15 - d30 - d60 - d90;
    const proximos = await this.db.motorista.findMany({
      where: { ...base, validadeCnh: { not: null, lte: dia(90) } },
      select: { id: true, nome: true, cnh: true, categoriaCnh: true, validadeCnh: true },
      orderBy: { validadeCnh: "asc" }, take: 30,
    });
    const bloqueio = await this.getBloqueioCnh(orgId);
    return { total, semCnh, vencida, vence7: d7, vence15: d15, vence30: d30, vence60: d60, vence90: d90, validas, proximos, bloqueioCnhVencida: bloqueio };
  }

  // GET /frota/motoristas/lookup/:userId — dados do usuário p/ preencher cadastro
  @Get("lookup/:userId")
  @Permissions("frota:ver")
  async userLookup(@Param("userId") userId: string, @Req() req: any) {
    const orgId = req.user?.organizationId;
    const u = await this.db.user.findFirst({
      where: { id: userId, organizationId: orgId },
      select: { id: true, nome: true, email: true, profile: { select: { telefone: true, cargo: true, setor: { select: { nome: true } } } } },
    });
    if (!u) throw new NotFoundException("Usuário não encontrado");
    return {
      nome: u.nome, email: u.email,
      telefone: u.profile?.telefone || null,
      cargo: u.profile?.cargo || null,
      departamento: u.profile?.setor?.nome || null,
    };
  }

  // POST /frota/motoristas/:id/renovar — registra renovação e atualiza a CNH
  @Post(":id/renovar")
  @Permissions("frota:editar")
  async renovar(@Param("id") id: string, @Body() body: any, @Req() req: any) {
    const orgId = req.user?.organizationId;
    const m = await this.db.motorista.findFirst({ where: { id, organizationId: orgId, deletedAt: null } });
    if (!m) throw new NotFoundException("Motorista não encontrado");
    if (!body.validadeNova) throw new BadRequestException("Informe a nova validade");
    const renov = await this.db.motoristaCnhRenovacao.create({
      data: {
        id: crypto.randomUUID(), organizationId: orgId, motoristaId: id,
        numeroAnterior: m.cnh || null, categoriaAnterior: m.categoriaCnh || null, validadeAnterior: m.validadeCnh || null,
        numeroNovo: body.numeroNovo || m.cnh || null, categoriaNova: body.categoriaNova || m.categoriaCnh || null,
        validadeNova: new Date(body.validadeNova), orgaoEmissor: body.orgaoEmissor || m.orgaoEmissor || null,
        observacoes: body.observacoes || null, criadoPorId: req.user?.id || null,
      },
    });
    await this.db.motorista.update({
      where: { id },
      data: {
        cnh: body.numeroNovo || m.cnh, categoriaCnh: body.categoriaNova || m.categoriaCnh,
        validadeCnh: new Date(body.validadeNova), orgaoEmissor: body.orgaoEmissor || m.orgaoEmissor,
        ...(body.dataRenovacao ? { cnhEmissao: new Date(body.dataRenovacao) } : {}),
        atualizadoPorId: req.user?.id || null,
      },
    });
    await this.audit.log({ userId: req.user?.id, modulo: "frota", tabela: "motoristas", registroId: id, acao: "editar", descricao: "Renovou CNH", ip: req.ip });
    return renov;
  }

  // GET /frota/motoristas/:id/renovacoes — histórico de renovações
  @Get(":id/renovacoes")
  @Permissions("frota:ver")
  async renovacoes(@Param("id") id: string, @Req() req: any) {
    const orgId = req.user?.organizationId;
    return this.db.motoristaCnhRenovacao.findMany({
      where: { motoristaId: id, organizationId: orgId },
      orderBy: { dataRenovacao: "desc" },
    });
  }

  // GET /frota/motoristas/:id/anexos
  @Get(":id/anexos")
  @Permissions("frota:ver")
  async listAnexos(@Param("id") id: string, @Req() req: any) {
    const orgId = req.user?.organizationId;
    const anexos = await this.db.motoristaAnexo.findMany({
      where: { motoristaId: id, organizationId: orgId, deletedAt: null },
      orderBy: { criadoEm: "desc" },
    });
    return anexos.map((a: any) => ({ ...a, url: `/uploads/motoristas/${id}/${a.nomeArquivo}` }));
  }

  // POST /frota/motoristas/:id/anexos — upload (cnh_frente | cnh_verso | exame | certificado)
  @Post(":id/anexos")
  @Permissions("frota:editar")
  @UseInterceptors(FileInterceptor("file", {
    storage: diskStorage({
      destination: (req: any, _file, cb) => {
        const dir = path.join(FROTA_UPLOAD_DIR, "motoristas", req.params.id);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
      },
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
  }))
  async uploadAnexo(@Param("id") id: string, @UploadedFile() file: any, @Body() body: any, @Req() req: any) {
    const orgId = req.user?.organizationId;
    const m = await this.db.motorista.findFirst({ where: { id, organizationId: orgId, deletedAt: null } });
    if (!m) throw new NotFoundException("Motorista não encontrado");
    if (!file) throw new BadRequestException("Arquivo obrigatório");
    const tipo = ANEXO_TIPOS.includes(body.tipo) ? body.tipo : "certificado";
    const anexo = await this.db.motoristaAnexo.create({
      data: {
        id: crypto.randomUUID(), organizationId: orgId, motoristaId: id, tipo,
        nomeArquivo: file.filename, nomeOriginal: file.originalname, mime: file.mimetype, tamanho: file.size,
        criadoPorId: req.user?.id || null,
      },
    });
    return { ...anexo, url: `/uploads/motoristas/${id}/${anexo.nomeArquivo}` };
  }

  // DELETE /frota/motoristas/:id/anexos/:anexoId
  @Delete(":id/anexos/:anexoId")
  @Permissions("frota:editar")
  async removeAnexo(@Param("id") id: string, @Param("anexoId") anexoId: string, @Req() req: any) {
    const orgId = req.user?.organizationId;
    const anexo = await this.db.motoristaAnexo.findFirst({ where: { id: anexoId, motoristaId: id, organizationId: orgId } });
    if (!anexo) throw new NotFoundException("Anexo não encontrado");
    await this.db.motoristaAnexo.update({ where: { id: anexoId }, data: { deletedAt: new Date() } });
    return { message: "Anexo removido" };
  }

  private async getBloqueioCnh(orgId: string): Promise<boolean> {
    const cfg = await this.db.sistemaConfig.findFirst({ where: { organizationId: orgId, chave: "frota_bloqueio_cnh" } });
    return cfg?.valor === "true";
  }
}

// ── Configurações da frota (toggle de bloqueio CNH) ────────────────────────────
@Controller("frota/config")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class FrotaConfigController {
  constructor(private prisma: PrismaService) {}
  private get db() { return this.prisma as any; }

  @Get()
  @Permissions("frota:ver")
  async get(@Req() req: any) {
    const orgId = req.user?.organizationId;
    const cfg = await this.db.sistemaConfig.findFirst({ where: { organizationId: orgId, chave: "frota_bloqueio_cnh" } });
    return { bloqueioCnhVencida: cfg?.valor === "true" };
  }

  @Put()
  @Permissions("frota:configurar")
  async update(@Body() body: { bloqueioCnhVencida?: boolean }, @Req() req: any) {
    const orgId = req.user?.organizationId;
    const valor = body.bloqueioCnhVencida ? "true" : "false";
    const existing = await this.db.sistemaConfig.findFirst({ where: { organizationId: orgId, chave: "frota_bloqueio_cnh" } });
    if (existing) await this.db.sistemaConfig.update({ where: { id: existing.id }, data: { valor } });
    else await this.db.sistemaConfig.create({ data: { id: crypto.randomUUID(), organizationId: orgId, chave: "frota_bloqueio_cnh", valor } });
    return { bloqueioCnhVencida: body.bloqueioCnhVencida === true };
  }
}

// ── Pneus ──────────────────────────────────────────────────────────────────────
@Controller("frota/pneus")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class PneusController extends BaseFrotaController {
  constructor(prisma: PrismaService, audit: AuditService) { super(prisma, audit); }
  protected model = "pneu";
  protected tabela = "pneus";
  protected searchFields = ["numeroFogo", "codigo", "numeroSerie", "marca", "modelo", "medida", "posicao", "dot"];
  protected filterKeys = ["status", "veiculoId"];
  protected include = { veiculo: { select: { id: true, placa: true, codigo: true } } };
  protected fields: FieldDef[] = [
    { k: "veiculoId", t: "string" }, { k: "numeroFogo", t: "string" }, { k: "codigo", t: "string" },
    { k: "numeroSerie", t: "string" }, { k: "marca", t: "string" }, { k: "modelo", t: "string" },
    { k: "medida", t: "string" }, { k: "dot", t: "string" }, { k: "dataFabricacao", t: "date" },
    { k: "fornecedor", t: "string" }, { k: "valorCompra", t: "float" }, { k: "posicao", t: "string" },
    { k: "dataInstalacao", t: "date" }, { k: "kmInstalacao", t: "int" }, { k: "kmInicial", t: "int" },
    { k: "kmAtual", t: "int" }, { k: "vidaUtilKm", t: "int" }, { k: "kmPrevisto", t: "int" },
    { k: "status", t: "string" }, { k: "observacoes", t: "string" },
  ];

  // POST /frota/pneus/:id/evento — instalacao | remocao | rodizio | recapagem | descarte
  @Post(":id/evento")
  @Permissions("frota:editar")
  async evento(@Param("id") id: string, @Body() body: any, @Req() req: any) {
    const orgId = req.user?.organizationId;
    const pneu = await this.db.pneu.findFirst({ where: { id, organizationId: orgId, deletedAt: null } });
    if (!pneu) throw new NotFoundException("Pneu não encontrado");
    const tipo = body.tipo;
    if (!["instalacao", "remocao", "rodizio", "recapagem", "descarte"].includes(tipo)) throw new BadRequestException("Tipo de evento inválido");
    const km = body.km != null && body.km !== "" ? Math.trunc(Number(body.km)) : (pneu.kmAtual ?? null);
    const data: any = { atualizadoPorId: req.user?.id || null };
    if (km != null) data.kmAtual = km;
    let posicaoDe: string | null = pneu.posicao || null;
    let posicaoPara: string | null = null;

    if (tipo === "instalacao") {
      if (!body.veiculoId) throw new BadRequestException("Informe o veículo de instalação");
      data.veiculoId = body.veiculoId; data.posicao = body.posicaoPara || null; data.status = "em_uso";
      data.dataInstalacao = body.data ? new Date(body.data) : new Date();
      data.kmInstalacao = km; if (pneu.kmInicial == null) data.kmInicial = km;
      posicaoDe = null; posicaoPara = body.posicaoPara || null;
    } else if (tipo === "remocao") {
      data.veiculoId = null; data.posicao = null; data.status = body.status || "estoque";
    } else if (tipo === "rodizio") {
      data.posicao = body.posicaoPara || pneu.posicao; posicaoPara = body.posicaoPara || pneu.posicao;
    } else if (tipo === "recapagem") {
      data.status = "recapagem"; data.veiculoId = null; data.posicao = null;
    } else if (tipo === "descarte") {
      data.status = "descarte"; data.veiculoId = null; data.posicao = null;
    }
    await this.db.pneu.update({ where: { id }, data });
    const ev = await this.db.pneuEvento.create({
      data: {
        id: crypto.randomUUID(), organizationId: orgId, pneuId: id,
        veiculoId: tipo === "instalacao" ? body.veiculoId : (tipo === "rodizio" ? pneu.veiculoId : (tipo === "remocao" || tipo === "recapagem" || tipo === "descarte" ? pneu.veiculoId : null)),
        tipo, data: body.data ? new Date(body.data) : new Date(), km,
        posicaoDe, posicaoPara, custo: body.custo != null && body.custo !== "" ? Number(body.custo) : null,
        observacoes: body.observacoes || null, criadoPorId: req.user?.id || null,
      },
    });
    await this.audit.log({ userId: req.user?.id, modulo: "frota", tabela: "pneus", registroId: id, acao: "editar", descricao: `Pneu: ${tipo}`, ip: req.ip });
    return ev;
  }

  // GET /frota/pneus/:id/eventos — histórico completo do pneu
  @Get(":id/eventos")
  @Permissions("frota:ver")
  async eventos(@Param("id") id: string, @Req() req: any) {
    const orgId = req.user?.organizationId;
    return this.db.pneuEvento.findMany({ where: { pneuId: id, organizationId: orgId }, orderBy: { data: "desc" } });
  }
}

// ── Layout de posições de pneus (configurável por tipo de veículo) ──────────────
@Controller("frota/pneu-layouts")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class PneuLayoutController {
  constructor(private prisma: PrismaService) {}
  private get db() { return this.prisma as any; }

  @Get(":tipo")
  @Permissions("frota:ver")
  async get(@Param("tipo") tipo: string, @Req() req: any) {
    const orgId = req.user?.organizationId;
    const saved = await this.db.pneuLayout.findFirst({ where: { organizationId: orgId, tipo } });
    return { tipo, posicoes: saved?.posicoes || defaultPneuLayout(tipo), custom: !!saved };
  }

  @Put(":tipo")
  @Permissions("frota:configurar")
  async put(@Param("tipo") tipo: string, @Body() body: any, @Req() req: any) {
    const orgId = req.user?.organizationId;
    const posicoes = Array.isArray(body.posicoes) ? body.posicoes : [];
    const existing = await this.db.pneuLayout.findFirst({ where: { organizationId: orgId, tipo } });
    if (existing) await this.db.pneuLayout.update({ where: { id: existing.id }, data: { posicoes } });
    else await this.db.pneuLayout.create({ data: { id: crypto.randomUUID(), organizationId: orgId, tipo, posicoes } });
    return { tipo, posicoes };
  }
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
    { k: "kmRealizado", t: "int" }, { k: "horimetro", t: "int" }, { k: "status", t: "string" }, { k: "custo", t: "float" },
    { k: "oficina", t: "string" }, { k: "observacoes", t: "string" },
  ];
}

// ── Planos de revisão preventiva (parametrização por modelo) ───────────────────
@Controller("frota/planos-revisao")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class PlanosRevisaoController extends BaseFrotaController {
  constructor(prisma: PrismaService, audit: AuditService) { super(prisma, audit); }
  protected model = "planoRevisao";
  protected tabela = "planos_revisao";
  protected searchFields = ["modelo", "marca", "tipo"];
  protected requiredFields = ["modelo", "tipo"];
  protected filterKeys = ["tipo", "base", "modelo"];
  protected orderBy = { modelo: "asc" } as any;
  protected fields: FieldDef[] = [
    { k: "modelo", t: "string" }, { k: "marca", t: "string" }, { k: "tipo", t: "string" },
    { k: "base", t: "string" }, { k: "intervaloKm", t: "int" }, { k: "intervaloDias", t: "int" },
    { k: "intervaloHorimetro", t: "int" }, { k: "ativo", t: "bool" }, { k: "observacoes", t: "string" },
  ];
}

// ── Agenda de revisões (cálculo automático da próxima revisão + farol) ─────────
function farolFromPct(pct: number): string {
  if (pct <= 0) return "vermelho";
  if (pct <= 0.10) return "laranja";
  if (pct <= 0.30) return "amarelo";
  return "verde";
}

@Controller("frota/revisoes-agenda")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class RevisaoAgendaController {
  constructor(private prisma: PrismaService) {}
  private get db() { return this.prisma as any; }

  @Get()
  @Permissions("frota:ver")
  async agenda(@Req() req: any) {
    const orgId = req.user?.organizationId;
    const [veiculos, planos] = await Promise.all([
      this.db.veiculo.findMany({
        where: { organizationId: orgId, deletedAt: null, status: { in: ["ativo", "manutencao"] } },
        select: { id: true, placa: true, codigo: true, modelo: true, marca: true, kmAtual: true, horimetroAtual: true, dataAquisicao: true, criadoEm: true },
      }),
      this.db.planoRevisao.findMany({ where: { organizationId: orgId, deletedAt: null, ativo: true } }),
    ]);
    if (!veiculos.length || !planos.length) return { itens: [] };

    const revisoes = await this.db.revisaoVeiculo.findMany({
      where: { organizationId: orgId, deletedAt: null, status: "realizada", veiculoId: { in: veiculos.map((v: any) => v.id) } },
      select: { veiculoId: true, tipo: true, dataRealizada: true, kmRealizado: true, horimetro: true },
      orderBy: { dataRealizada: "desc" },
    });
    const lastByKey: Record<string, any> = {};
    for (const r of revisoes) { const k = `${r.veiculoId}::${r.tipo}`; if (!lastByKey[k]) lastByKey[k] = r; }

    const norm = (s: string) => (s || "").trim().toLowerCase();
    const itens: any[] = [];
    for (const v of veiculos) {
      const planosV = planos.filter((p: any) => norm(p.modelo) === norm(v.modelo) && (!p.marca || norm(p.marca) === norm(v.marca)));
      for (const p of planosV) {
        const last = lastByKey[`${v.id}::${p.tipo}`];
        const base: any = { veiculoId: v.id, placa: v.placa, codigo: v.codigo, modelo: v.modelo, tipo: p.tipo, baseTipo: p.base, planoId: p.id, ultimaData: last?.dataRealizada || null, ultimaKm: last?.kmRealizado ?? null };
        if (p.base === "km" && p.intervaloKm) {
          const lastKm = last?.kmRealizado ?? v.kmAtual;
          const prox = lastKm + p.intervaloKm;
          const restante = prox - v.kmAtual;
          itens.push({ ...base, proximaKm: prox, atual: v.kmAtual, restante, unidade: "km", farol: farolFromPct(restante / p.intervaloKm) });
        } else if (p.base === "data" && p.intervaloDias) {
          const lastData = last?.dataRealizada ? new Date(last.dataRealizada) : (v.dataAquisicao ? new Date(v.dataAquisicao) : new Date(v.criadoEm));
          const prox = new Date(lastData.getTime() + p.intervaloDias * 86400000);
          const restante = Math.ceil((prox.getTime() - Date.now()) / 86400000);
          itens.push({ ...base, proximaData: prox, restante, unidade: "dias", farol: farolFromPct(restante / p.intervaloDias) });
        } else if (p.base === "horimetro" && p.intervaloHorimetro) {
          if (v.horimetroAtual == null) { itens.push({ ...base, semDado: true, unidade: "h", farol: "cinza" }); }
          else {
            const lastH = last?.horimetro ?? v.horimetroAtual;
            const prox = lastH + p.intervaloHorimetro;
            const restante = prox - v.horimetroAtual;
            itens.push({ ...base, proximaHorimetro: prox, atual: v.horimetroAtual, restante, unidade: "h", farol: farolFromPct(restante / p.intervaloHorimetro) });
          }
        }
      }
    }
    const sev: Record<string, number> = { vermelho: 0, laranja: 1, amarelo: 2, verde: 3, cinza: 4 };
    itens.sort((a, b) => (sev[a.farol] - sev[b.farol]) || ((a.restante ?? 1e12) - (b.restante ?? 1e12)));
    const resumo = { vermelho: 0, laranja: 0, amarelo: 0, verde: 0, cinza: 0 } as Record<string, number>;
    for (const i of itens) resumo[i.farol] = (resumo[i.farol] || 0) + 1;
    return { itens, resumo };
  }
}

// ── Manutenções ────────────────────────────────────────────────────────────────
@Controller("frota/manutencoes")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class ManutencoesController extends BaseFrotaController {
  constructor(prisma: PrismaService, audit: AuditService) { super(prisma, audit); }
  protected model = "manutencaoVeiculo";
  protected tabela = "manutencoes_veiculo";
  protected searchFields = ["numeroOs", "tipo", "descricao", "oficina", "fornecedor"];
  protected requiredFields = ["veiculoId"];
  protected filterKeys = ["status", "veiculoId", "tipo"];
  protected include = {
    veiculo: { select: { id: true, placa: true, codigo: true } },
    solicitante: { select: { id: true, nome: true, avatar: true } },
  };
  protected includeOne = {
    veiculo: { select: { id: true, placa: true, codigo: true } },
    solicitante: { select: { id: true, nome: true, email: true, avatar: true } },
    maoObra: { orderBy: { criadoEm: "desc" } },
  };
  protected fields: FieldDef[] = [
    { k: "veiculoId", t: "string" }, { k: "numeroOs", t: "string" }, { k: "tipo", t: "string" },
    { k: "descricao", t: "string" }, { k: "solicitanteId", t: "string" },
    { k: "data", t: "date" }, { k: "dataAgendada", t: "date" }, { k: "dataAbertura", t: "date" },
    { k: "dataFechamento", t: "date" }, { k: "km", t: "int" },
    { k: "custoPecas", t: "float" }, { k: "custoServicos", t: "float" }, { k: "custoTerceiros", t: "float" },
    { k: "fornecedor", t: "string" }, { k: "fornecedorId", t: "string" }, { k: "oficina", t: "string" },
    { k: "pecas", t: "json" }, { k: "status", t: "string" }, { k: "observacoes", t: "string" },
  ];

  protected async beforeCreate(data: any, req: any): Promise<void> {
    const orgId = req.user?.organizationId;
    if (!data.numeroOs) {
      const count = await this.db.manutencaoVeiculo.count({ where: { organizationId: orgId } });
      let n = count + 1;
      let os = `OS-${String(n).padStart(5, "0")}`;
      while (await this.db.manutencaoVeiculo.findFirst({ where: { organizationId: orgId, numeroOs: os } })) os = `OS-${String(++n).padStart(5, "0")}`;
      data.numeroOs = os;
    }
    if (!data.dataAbertura) data.dataAbertura = new Date();
    data.custo = (data.custoPecas || 0) + (data.custoServicos || 0) + (data.custoTerceiros || 0);
  }

  protected async afterWrite(row: any, _req: any, _acao: string): Promise<void> {
    const total = await this.recalcTotal(row.id);
    row.custo = total;
  }

  private async recalcTotal(id: string): Promise<number> {
    const m = await this.db.manutencaoVeiculo.findUnique({ where: { id }, select: { custoPecas: true, custoServicos: true, custoTerceiros: true } });
    if (!m) return 0;
    const mo = await this.db.manutencaoMaoObra.aggregate({ _sum: { custo: true }, where: { manutencaoId: id } });
    const total = (m.custoPecas || 0) + (m.custoServicos || 0) + (m.custoTerceiros || 0) + (mo._sum.custo || 0);
    await this.db.manutencaoVeiculo.update({ where: { id }, data: { custo: total } });
    return total;
  }

  // ── Mão de obra ──────────────────────────────────────────────────────────────
  @Get(":id/mao-obra")
  @Permissions("frota:ver")
  async listMaoObra(@Param("id") id: string, @Req() req: any) {
    const orgId = req.user?.organizationId;
    return this.db.manutencaoMaoObra.findMany({ where: { manutencaoId: id, organizationId: orgId }, orderBy: { criadoEm: "desc" } });
  }

  @Post(":id/mao-obra")
  @Permissions("frota:editar")
  async addMaoObra(@Param("id") id: string, @Body() body: any, @Req() req: any) {
    const orgId = req.user?.organizationId;
    const m = await this.db.manutencaoVeiculo.findFirst({ where: { id, organizationId: orgId, deletedAt: null } });
    if (!m) throw new NotFoundException("Manutenção não encontrada");
    if (!body.descricao?.trim()) throw new BadRequestException("Descrição obrigatória");
    const horas = body.horas != null && body.horas !== "" ? Number(body.horas) : null;
    const valorHora = body.valorHora != null && body.valorHora !== "" ? Number(body.valorHora) : null;
    const custo = body.custo != null && body.custo !== "" ? Number(body.custo) : (horas != null && valorHora != null ? Number((horas * valorHora).toFixed(2)) : null);
    const mo = await this.db.manutencaoMaoObra.create({
      data: { id: crypto.randomUUID(), organizationId: orgId, manutencaoId: id, descricao: body.descricao.trim(), responsavel: body.responsavel || null, horas, valorHora, custo, criadoPorId: req.user?.id || null },
    });
    await this.recalcTotal(id);
    return mo;
  }

  @Delete(":id/mao-obra/:moId")
  @Permissions("frota:editar")
  async removeMaoObra(@Param("id") id: string, @Param("moId") moId: string, @Req() req: any) {
    const orgId = req.user?.organizationId;
    const mo = await this.db.manutencaoMaoObra.findFirst({ where: { id: moId, manutencaoId: id, organizationId: orgId } });
    if (!mo) throw new NotFoundException("Apontamento não encontrado");
    await this.db.manutencaoMaoObra.delete({ where: { id: moId } });
    await this.recalcTotal(id);
    return { message: "Apontamento removido" };
  }

  // ── Anexos (nota fiscal | foto | orcamento) ──────────────────────────────────
  @Get(":id/anexos")
  @Permissions("frota:ver")
  async listAnexos(@Param("id") id: string, @Req() req: any) {
    const orgId = req.user?.organizationId;
    const anexos = await this.db.manutencaoAnexo.findMany({ where: { manutencaoId: id, organizationId: orgId, deletedAt: null }, orderBy: { criadoEm: "desc" } });
    return anexos.map((a: any) => ({ ...a, url: `/uploads/manutencoes/${id}/${a.nomeArquivo}` }));
  }

  @Post(":id/anexos")
  @Permissions("frota:editar")
  @UseInterceptors(FileInterceptor("file", {
    storage: diskStorage({
      destination: (req: any, _file, cb) => {
        const dir = path.join(FROTA_UPLOAD_DIR, "manutencoes", req.params.id);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`),
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
  }))
  async uploadAnexo(@Param("id") id: string, @UploadedFile() file: any, @Body() body: any, @Req() req: any) {
    const orgId = req.user?.organizationId;
    const m = await this.db.manutencaoVeiculo.findFirst({ where: { id, organizationId: orgId, deletedAt: null } });
    if (!m) throw new NotFoundException("Manutenção não encontrada");
    if (!file) throw new BadRequestException("Arquivo obrigatório");
    const tipo = ["nota_fiscal", "foto", "orcamento"].includes(body.tipo) ? body.tipo : "orcamento";
    const anexo = await this.db.manutencaoAnexo.create({
      data: { id: crypto.randomUUID(), organizationId: orgId, manutencaoId: id, tipo, nomeArquivo: file.filename, nomeOriginal: file.originalname, mime: file.mimetype, tamanho: file.size, criadoPorId: req.user?.id || null },
    });
    return { ...anexo, url: `/uploads/manutencoes/${id}/${anexo.nomeArquivo}` };
  }

  @Delete(":id/anexos/:anexoId")
  @Permissions("frota:editar")
  async removeAnexo(@Param("id") id: string, @Param("anexoId") anexoId: string, @Req() req: any) {
    const orgId = req.user?.organizationId;
    const anexo = await this.db.manutencaoAnexo.findFirst({ where: { id: anexoId, manutencaoId: id, organizationId: orgId } });
    if (!anexo) throw new NotFoundException("Anexo não encontrado");
    await this.db.manutencaoAnexo.update({ where: { id: anexoId }, data: { deletedAt: new Date() } });
    return { message: "Anexo removido" };
  }
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
  protected includeOne = { veiculo: { select: { id: true, placa: true, codigo: true } }, anexos: { where: { deletedAt: null }, orderBy: { criadoEm: "desc" } } };
  protected fields: FieldDef[] = [
    { k: "veiculoId", t: "string" }, { k: "tipo", t: "string" }, { k: "numero", t: "string" },
    { k: "descricao", t: "string" }, { k: "dataEmissao", t: "date" }, { k: "dataVencimento", t: "date" },
    { k: "valor", t: "float" }, { k: "arquivoUrl", t: "string" }, { k: "status", t: "string" },
    { k: "observacoes", t: "string" },
  ];

  // GET /frota/documentos/vencimentos/dashboard — estatísticas de vencimento
  @Get("vencimentos/dashboard")
  @Permissions("frota:ver")
  async vencimentosDashboard(@Req() req: any) {
    const orgId = req.user?.organizationId;
    const base = { organizationId: orgId, deletedAt: null } as any;
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const dia = (n: number) => new Date(hoje.getTime() + n * 86400000);
    const [total, semData, vencido, d7, d15, d30, d60, d90, porTipo] = await Promise.all([
      this.db.documentoVeiculo.count({ where: base }),
      this.db.documentoVeiculo.count({ where: { ...base, dataVencimento: null } }),
      this.db.documentoVeiculo.count({ where: { ...base, dataVencimento: { lt: hoje } } }),
      this.db.documentoVeiculo.count({ where: { ...base, dataVencimento: { gte: hoje, lte: dia(7) } } }),
      this.db.documentoVeiculo.count({ where: { ...base, dataVencimento: { gt: dia(7), lte: dia(15) } } }),
      this.db.documentoVeiculo.count({ where: { ...base, dataVencimento: { gt: dia(15), lte: dia(30) } } }),
      this.db.documentoVeiculo.count({ where: { ...base, dataVencimento: { gt: dia(30), lte: dia(60) } } }),
      this.db.documentoVeiculo.count({ where: { ...base, dataVencimento: { gt: dia(60), lte: dia(90) } } }),
      this.db.documentoVeiculo.groupBy({ by: ["tipo"], _count: true, where: base }),
    ]);
    const vigentes = total - semData - vencido - d7 - d15 - d30 - d60 - d90;
    const proximos = await this.db.documentoVeiculo.findMany({
      where: { ...base, dataVencimento: { not: null, lte: dia(90) } },
      select: { id: true, tipo: true, numero: true, dataVencimento: true, veiculo: { select: { placa: true } } },
      orderBy: { dataVencimento: "asc" }, take: 30,
    });
    return { total, semData, vencido, vence7: d7, vence15: d15, vence30: d30, vence60: d60, vence90: d90, vigentes, porTipo: Object.fromEntries((porTipo as any[]).map(t => [t.tipo, t._count])), proximos };
  }

  // GET /frota/documentos/:id/anexos
  @Get(":id/anexos")
  @Permissions("frota:ver")
  async listAnexos(@Param("id") id: string, @Req() req: any) {
    const orgId = req.user?.organizationId;
    const anexos = await this.db.documentoAnexo.findMany({ where: { documentoId: id, organizationId: orgId, deletedAt: null }, orderBy: { criadoEm: "desc" } });
    return anexos.map((a: any) => ({ ...a, url: `/uploads/documentos/${id}/${a.nomeArquivo}` }));
  }

  @Post(":id/anexos")
  @Permissions("frota:editar")
  @UseInterceptors(FileInterceptor("file", {
    storage: diskStorage({
      destination: (req: any, _file, cb) => {
        const dir = path.join(FROTA_UPLOAD_DIR, "documentos", req.params.id);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`),
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
  }))
  async uploadAnexo(@Param("id") id: string, @UploadedFile() file: any, @Req() req: any) {
    const orgId = req.user?.organizationId;
    const doc = await this.db.documentoVeiculo.findFirst({ where: { id, organizationId: orgId, deletedAt: null } });
    if (!doc) throw new NotFoundException("Documento não encontrado");
    if (!file) throw new BadRequestException("Arquivo obrigatório");
    const anexo = await this.db.documentoAnexo.create({
      data: { id: crypto.randomUUID(), organizationId: orgId, documentoId: id, nomeArquivo: file.filename, nomeOriginal: file.originalname, mime: file.mimetype, tamanho: file.size, criadoPorId: req.user?.id || null },
    });
    return { ...anexo, url: `/uploads/documentos/${id}/${anexo.nomeArquivo}` };
  }

  @Delete(":id/anexos/:anexoId")
  @Permissions("frota:editar")
  async removeAnexo(@Param("id") id: string, @Param("anexoId") anexoId: string, @Req() req: any) {
    const orgId = req.user?.organizationId;
    const anexo = await this.db.documentoAnexo.findFirst({ where: { id: anexoId, documentoId: id, organizationId: orgId } });
    if (!anexo) throw new NotFoundException("Anexo não encontrado");
    await this.db.documentoAnexo.update({ where: { id: anexoId }, data: { deletedAt: new Date() } });
    return { message: "Anexo removido" };
  }
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
    // consumo km/L e custo/km = distância desde o último abastecimento
    if (data.kmAtual != null) {
      const anterior = await this.db.abastecimento.findFirst({
        where: { veiculoId: data.veiculoId, deletedAt: null, kmAtual: { not: null, lt: data.kmAtual } },
        orderBy: { data: "desc" },
      });
      if (anterior?.kmAtual != null) {
        const dist = data.kmAtual - anterior.kmAtual;
        if (dist > 0) {
          if (data.litros) data.consumoKmL = Number((dist / data.litros).toFixed(2));
          if (data.valorTotal != null) data.custoKm = Number((data.valorTotal / dist).toFixed(3));
        }
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

  // GET /frota/abastecimentos/analise/consumo — consumo médio, custo/km e desvios
  @Get("analise/consumo")
  @Permissions("frota:ver")
  async analise(@Req() req: any, @Query("from") from?: string, @Query("to") to?: string, @Query("veiculoId") veiculoId?: string) {
    const orgId = req.user?.organizationId;
    const range: any = {};
    if (from) range.gte = new Date(from);
    if (to) { const t = new Date(to); t.setHours(23, 59, 59, 999); range.lte = t; }
    const where: any = { organizationId: orgId, deletedAt: null, ...(veiculoId ? { veiculoId } : {}), ...(Object.keys(range).length ? { data: range } : {}) };
    const abast = await this.db.abastecimento.findMany({
      where,
      select: { id: true, veiculoId: true, data: true, kmAtual: true, litros: true, valorTotal: true, consumoKmL: true, custoKm: true, posto: true, motorista: { select: { nome: true } }, veiculo: { select: { placa: true, modelo: true } } },
      orderBy: { data: "desc" },
    });

    const avg = (a: number[]) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
    const byVeic: Record<string, any> = {};
    for (const a of abast) {
      const k = a.veiculoId;
      if (!byVeic[k]) byVeic[k] = { veiculoId: k, placa: a.veiculo?.placa, modelo: a.veiculo?.modelo, litros: 0, gasto: 0, count: 0, _cons: [], _custo: [] };
      const v = byVeic[k];
      v.litros += a.litros || 0; v.gasto += a.valorTotal || 0; v.count++;
      if (a.consumoKmL != null) v._cons.push(a.consumoKmL);
      if (a.custoKm != null) v._custo.push(a.custoKm);
    }
    const veiculos = Object.values(byVeic).map((v: any) => {
      const mediaKmL = avg(v._cons);
      const custoKmMedio = avg(v._custo);
      return { veiculoId: v.veiculoId, placa: v.placa, modelo: v.modelo, litros: Number(v.litros.toFixed(2)), gasto: Number(v.gasto.toFixed(2)), count: v.count, mediaKmL: mediaKmL != null ? Number(mediaKmL.toFixed(2)) : null, custoKmMedio: custoKmMedio != null ? Number(custoKmMedio.toFixed(3)) : null };
    }).sort((a: any, b: any) => b.gasto - a.gasto);

    // Desvios: consumo do abastecimento se afasta > 20% da média do veículo
    const avgMap: Record<string, number | null> = {};
    veiculos.forEach((v: any) => { avgMap[v.veiculoId] = v.mediaKmL; });
    const desvios: any[] = [];
    for (const a of abast) {
      const m = avgMap[a.veiculoId];
      if (a.consumoKmL == null || m == null || m <= 0) continue;
      const pct = a.consumoKmL / m;
      if (pct < 0.8 || pct > 1.2) {
        desvios.push({ id: a.id, veiculoId: a.veiculoId, placa: a.veiculo?.placa, data: a.data, posto: a.posto, motorista: a.motorista?.nome || null, consumoKmL: a.consumoKmL, mediaKmL: Number(m.toFixed(2)), desvioPct: Math.round((pct - 1) * 100), tipo: pct < 0.8 ? "alto_consumo" : "consumo_atipico" });
      }
    }
    desvios.sort((a, b) => Math.abs(b.desvioPct) - Math.abs(a.desvioPct));

    const allCons = abast.filter((a: any) => a.consumoKmL != null).map((a: any) => a.consumoKmL);
    const allCusto = abast.filter((a: any) => a.custoKm != null).map((a: any) => a.custoKm);
    const totais = {
      registros: abast.length,
      totalLitros: Number(abast.reduce((s: number, a: any) => s + (a.litros || 0), 0).toFixed(2)),
      totalGasto: Number(abast.reduce((s: number, a: any) => s + (a.valorTotal || 0), 0).toFixed(2)),
      mediaKmL: avg(allCons) != null ? Number((avg(allCons) as number).toFixed(2)) : null,
      custoKmMedio: avg(allCusto) != null ? Number((avg(allCusto) as number).toFixed(3)) : null,
    };
    return { totais, veiculos, desvios };
  }
}

// ── Condutores (histórico de motoristas por veículo) ───────────────────────────
@Controller("frota/condutores")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class CondutoresController extends BaseFrotaController {
  constructor(prisma: PrismaService, audit: AuditService) { super(prisma, audit); }
  protected model = "veiculoCondutor";
  protected tabela = "veiculo_condutores";
  protected searchFields = ["motivo"];
  protected requiredFields = ["veiculoId", "motoristaId"];
  protected filterKeys = ["veiculoId", "motoristaId"];
  protected orderBy = { dataInicio: "desc" } as any;
  protected include = {
    veiculo:   { select: { id: true, placa: true, codigo: true } },
    motorista: { select: { id: true, nome: true } },
  };
  protected fields: FieldDef[] = [
    { k: "veiculoId", t: "string" }, { k: "motoristaId", t: "string" }, { k: "dataInicio", t: "date" },
    { k: "dataFim", t: "date" }, { k: "kmInicial", t: "int" }, { k: "kmFinal", t: "int" },
    { k: "motivo", t: "string" }, { k: "observacoes", t: "string" },
  ];
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

  // GET /frota/dashboard/executivo — KPIs + datasets dos gráficos (com filtros)
  @Get("executivo")
  @Permissions("frota:ver")
  async executivo(@Req() req: any, @Query() q: any) {
    const orgId = req.user?.organizationId;
    const now = new Date();
    const to = q.to ? new Date(q.to) : new Date(now);
    to.setHours(23, 59, 59, 999);
    const from = q.from ? new Date(q.from) : new Date(now.getFullYear(), now.getMonth() - 5, 1);
    from.setHours(0, 0, 0, 0);
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
    const em30 = new Date(now.getTime() + 30 * 86400000);
    const em90 = new Date(now.getTime() + 90 * 86400000);
    const hoje = new Date(now); hoje.setHours(0, 0, 0, 0);
    const dia = (n: number) => new Date(hoje.getTime() + n * 86400000);

    // Filtro de veículos
    const vehWhere: any = { organizationId: orgId, deletedAt: null };
    if (q.tipo) vehWhere.tipo = q.tipo;
    if (q.unidade) vehWhere.unidade = q.unidade;
    if (q.centroCustoId) vehWhere.centroCustoId = q.centroCustoId;
    if (q.veiculoId) vehWhere.id = q.veiculoId;
    const veiculos = await this.db.veiculo.findMany({ where: vehWhere, select: { id: true, placa: true, modelo: true, status: true, unidade: true, tipo: true } });
    const vIds = veiculos.map((v: any) => v.id);
    const vMap: Record<string, any> = Object.fromEntries(veiculos.map((v: any) => [v.id, v]));
    const inSet = { in: vIds.length ? vIds : ["__none__"] };
    const motWhere: any = { organizationId: orgId, deletedAt: null };
    if (q.motoristaId) motWhere.id = q.motoristaId;
    const periodo = { gte: from, lte: to };

    const [proximasRevisoes, cnhVencer, pneusEstoque, pneusUso, sManut, sAbast, sRev, sDoc,
      manutP, abastP, revP, docP, pneuP, manutStatus, revStatus, vencDocs] = await Promise.all([
      this.db.revisaoVeiculo.count({ where: { organizationId: orgId, deletedAt: null, status: "agendada", dataPrevista: { lte: em30 }, veiculoId: inSet } }),
      this.db.motorista.count({ where: { ...motWhere, validadeCnh: { gte: now, lte: em30 } } }),
      this.db.pneu.count({ where: { organizationId: orgId, deletedAt: null, status: "estoque" } }),
      this.db.pneu.count({ where: { organizationId: orgId, deletedAt: null, status: "em_uso", veiculoId: inSet } }),
      this.db.manutencaoVeiculo.aggregate({ _sum: { custo: true }, where: { organizationId: orgId, deletedAt: null, veiculoId: inSet, data: { gte: inicioMes } } }),
      this.db.abastecimento.aggregate({ _sum: { valorTotal: true }, where: { organizationId: orgId, deletedAt: null, veiculoId: inSet, data: { gte: inicioMes } } }),
      this.db.revisaoVeiculo.aggregate({ _sum: { custo: true }, where: { organizationId: orgId, deletedAt: null, veiculoId: inSet, dataRealizada: { gte: inicioMes } } }),
      this.db.documentoVeiculo.aggregate({ _sum: { valor: true }, where: { organizationId: orgId, deletedAt: null, veiculoId: inSet, dataEmissao: { gte: inicioMes } } }),
      this.db.manutencaoVeiculo.findMany({ where: { organizationId: orgId, deletedAt: null, veiculoId: inSet, OR: [{ data: periodo }, { dataAbertura: periodo }] }, select: { veiculoId: true, custo: true, data: true, dataAbertura: true } }),
      this.db.abastecimento.findMany({ where: { organizationId: orgId, deletedAt: null, veiculoId: inSet, data: periodo, ...(q.motoristaId ? { motoristaId: q.motoristaId } : {}) }, select: { veiculoId: true, valorTotal: true, litros: true, consumoKmL: true, data: true } }),
      this.db.revisaoVeiculo.findMany({ where: { organizationId: orgId, deletedAt: null, veiculoId: inSet, OR: [{ dataRealizada: periodo }, { dataPrevista: periodo }] }, select: { veiculoId: true, custo: true, dataRealizada: true, dataPrevista: true } }),
      this.db.documentoVeiculo.findMany({ where: { organizationId: orgId, deletedAt: null, veiculoId: inSet, dataEmissao: periodo }, select: { veiculoId: true, valor: true, dataEmissao: true } }),
      this.db.pneuEvento.findMany({ where: { organizationId: orgId, veiculoId: inSet, data: periodo }, select: { tipo: true } }),
      this.db.manutencaoVeiculo.groupBy({ by: ["status"], _count: true, where: { organizationId: orgId, deletedAt: null, veiculoId: inSet } }),
      this.db.revisaoVeiculo.groupBy({ by: ["status"], _count: true, where: { organizationId: orgId, deletedAt: null, veiculoId: inSet } }),
      this.db.documentoVeiculo.findMany({ where: { organizationId: orgId, deletedAt: null, veiculoId: inSet, dataVencimento: { not: null, lte: em90 } }, select: { dataVencimento: true } }),
    ]);

    const totalVeiculos = veiculos.length;
    const ativos = veiculos.filter((v: any) => v.status === "ativo").length;
    const emManutencao = veiculos.filter((v: any) => v.status === "manutencao").length;
    const custoMes = (sManut._sum.custo || 0) + (sAbast._sum.valorTotal || 0) + (sRev._sum.custo || 0) + (sDoc._sum.valor || 0);

    // Buckets mensais
    const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    const months: any[] = [];
    let cur = new Date(from.getFullYear(), from.getMonth(), 1);
    const endM = new Date(to.getFullYear(), to.getMonth(), 1);
    while (cur <= endM) {
      months.push({ key: ym(cur), label: `${MES[cur.getMonth()]}/${String(cur.getFullYear()).slice(2)}`, manut: 0, abast: 0, revisao: 0, doc: 0, total: 0, litros: 0, _cons: [] });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
    const mIdx: Record<string, number> = Object.fromEntries(months.map((m, i) => [m.key, i]));
    const addM = (date: any, field: string, val: number) => { if (!date || !val) return; const i = mIdx[ym(new Date(date))]; if (i == null) return; months[i][field] += val; months[i].total += val; };

    const byVeic: Record<string, number> = {};
    const addV = (vid: string, val: number) => { if (!vid || !val) return; byVeic[vid] = (byVeic[vid] || 0) + val; };

    for (const m of manutP) { const d = m.data || m.dataAbertura; addM(d, "manut", m.custo || 0); addV(m.veiculoId, m.custo || 0); }
    for (const a of abastP) { addM(a.data, "abast", a.valorTotal || 0); addV(a.veiculoId, a.valorTotal || 0); const i = mIdx[ym(new Date(a.data))]; if (i != null) { months[i].litros += a.litros || 0; if (a.consumoKmL != null) months[i]._cons.push(a.consumoKmL); } }
    for (const r of revP) { const d = r.dataRealizada || r.dataPrevista; addM(d, "revisao", r.custo || 0); addV(r.veiculoId, r.custo || 0); }
    for (const dd of docP) { addM(dd.dataEmissao, "doc", dd.valor || 0); addV(dd.veiculoId, dd.valor || 0); }

    const avg = (a: number[]) => a.length ? Number((a.reduce((s, x) => s + x, 0) / a.length).toFixed(2)) : null;
    const custosMensais = months.map(m => ({ label: m.label, manut: Number(m.manut.toFixed(2)), abast: Number(m.abast.toFixed(2)), revisao: Number(m.revisao.toFixed(2)), doc: Number(m.doc.toFixed(2)), total: Number(m.total.toFixed(2)) }));
    const consumo = months.map(m => ({ label: m.label, litros: Number(m.litros.toFixed(0)), kmL: avg(m._cons) }));
    const custosPorVeiculo = Object.entries(byVeic).map(([vid, total]) => ({ placa: vMap[vid]?.placa || vid, total: Number(total.toFixed(2)) })).sort((a, b) => b.total - a.total).slice(0, 10);
    const byUni: Record<string, number> = {};
    for (const [vid, total] of Object.entries(byVeic)) { const u = vMap[vid]?.unidade || "Sem unidade"; byUni[u] = (byUni[u] || 0) + total; }
    const custosPorUnidade = Object.entries(byUni).map(([unidade, total]) => ({ unidade, total: Number(total.toFixed(2)) })).sort((a, b) => b.total - a.total);
    const manutencoes = (manutStatus as any[]).map(s => ({ status: s.status, count: s._count }));
    const revisoes = (revStatus as any[]).map(s => ({ status: s.status, count: s._count }));
    const pneuBy: Record<string, number> = {};
    for (const e of pneuP) pneuBy[e.tipo] = (pneuBy[e.tipo] || 0) + 1;
    const trocasPneus = Object.entries(pneuBy).map(([tipo, count]) => ({ tipo, count }));
    const venc = { vencido: 0, d30: 0, d60: 0, d90: 0 };
    for (const d of vencDocs) { const dt = new Date(d.dataVencimento); if (dt < hoje) venc.vencido++; else if (dt <= dia(30)) venc.d30++; else if (dt <= dia(60)) venc.d60++; else venc.d90++; }
    const vencimentos = [{ faixa: "Vencido", count: venc.vencido }, { faixa: "≤30d", count: venc.d30 }, { faixa: "≤60d", count: venc.d60 }, { faixa: "≤90d", count: venc.d90 }];

    return {
      periodo: { from, to },
      kpis: {
        totalVeiculos, ativos, emManutencao, proximasRevisoes, cnhVencer, pneusEstoque, pneusUso,
        custoMes: Number(custoMes.toFixed(2)),
        custoPorVeiculo: totalVeiculos ? Number((custoMes / totalVeiculos).toFixed(2)) : 0,
        disponibilidade: totalVeiculos ? Math.round((ativos / totalVeiculos) * 100) : 0,
      },
      charts: { custosMensais, custosPorVeiculo, custosPorUnidade, manutencoes, revisoes, consumo, trocasPneus, vencimentos },
    };
  }
}

// ── Relatórios ─────────────────────────────────────────────────────────────────
@Controller("frota/relatorios")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class FrotaRelatoriosController {
  constructor(private relService: FrotaRelatoriosService) {}

  @Get("custos")
  @Permissions("frota:relatorios")
  async custos(@Req() req: any, @Query("from") from?: string, @Query("to") to?: string, @Query("veiculoId") veiculoId?: string) {
    const orgId = req.user?.organizationId;
    return this.relService.custos(orgId, from, to, veiculoId);
  }

  @Get("veiculos")
  @Permissions("frota:relatorios")
  async veiculos(@Req() req: any, @Query() q: any) {
    const orgId = req.user?.organizationId;
    return this.relService.veiculos(orgId, q);
  }

  @Get("motoristas")
  @Permissions("frota:relatorios")
  async motoristas(@Req() req: any, @Query() q: any) {
    const orgId = req.user?.organizationId;
    return this.relService.motoristas(orgId, q);
  }

  @Get("cnhs")
  @Permissions("frota:relatorios")
  async cnhs(@Req() req: any, @Query() q: any) {
    const orgId = req.user?.organizationId;
    return this.relService.cnhs(orgId, q);
  }

  @Get("pneus")
  @Permissions("frota:relatorios")
  async pneus(@Req() req: any, @Query() q: any) {
    const orgId = req.user?.organizationId;
    return this.relService.pneus(orgId, q);
  }

  @Get("historico-pneus")
  @Permissions("frota:relatorios")
  async historicoPneus(@Req() req: any, @Query() q: any) {
    const orgId = req.user?.organizationId;
    return this.relService.historicoPneus(orgId, q);
  }

  @Get("revisoes")
  @Permissions("frota:relatorios")
  async revisoes(@Req() req: any, @Query() q: any) {
    const orgId = req.user?.organizationId;
    return this.relService.revisoes(orgId, q);
  }

  @Get("manutencoes")
  @Permissions("frota:relatorios")
  async manutencoes(@Req() req: any, @Query() q: any) {
    const orgId = req.user?.organizationId;
    return this.relService.manutencoes(orgId, q);
  }

  @Get("abastecimentos")
  @Permissions("frota:relatorios")
  async abastecimentos(@Req() req: any, @Query() q: any) {
    const orgId = req.user?.organizationId;
    return this.relService.abastecimentos(orgId, q);
  }

  @Get("disponibilidade")
  @Permissions("frota:relatorios")
  async disponibilidade(@Req() req: any, @Query() q: any) {
    const orgId = req.user?.organizationId;
    return this.relService.disponibilidade(orgId, q);
  }

  @Post("enviar-email")
  @Permissions("frota:relatorios")
  async enviarEmail(@Req() req: any, @Body() body: any) {
    const orgId = req.user?.organizationId;
    return this.relService.enviarEmail(orgId, body);
  }
}

// ── CRUD de Agendamento de Relatórios ──────────────────────────────────────────
@Controller("frota/report-schedules")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class FrotaReportScheduleController {
  constructor(private prisma: PrismaService) {}
  private get db() { return this.prisma as any; }

  @Get()
  @Permissions("frota:relatorios")
  async list(@Req() req: any) {
    const orgId = req.user?.organizationId;
    return this.db.frotaReportSchedule.findMany({
      where: { organizationId: orgId },
      orderBy: { criadoEm: "desc" },
    });
  }

  @Post()
  @Permissions("frota:relatorios")
  async create(@Req() req: any, @Body() body: any) {
    const orgId = req.user?.organizationId;
    const { titulo, tipoRelatorio, formato, frequencia, filtros, destinatarios } = body;
    if (!titulo || !tipoRelatorio || !formato || !frequencia || !destinatarios) {
      throw new BadRequestException("Título, tipo de relatório, formato, frequência e destinatários são obrigatórios");
    }

    return this.db.frotaReportSchedule.create({
      data: {
        id: crypto.randomUUID(),
        organizationId: orgId,
        titulo,
        tipoRelatorio,
        formato,
        frequencia,
        filtros: filtros || {},
        destinatarios,
        criadoPorId: req.user?.id || null,
      }
    });
  }

  @Patch(":id")
  @Permissions("frota:relatorios")
  async update(@Param("id") id: string, @Req() req: any, @Body() body: any) {
    const orgId = req.user?.organizationId;
    const schedule = await this.db.frotaReportSchedule.findFirst({ where: { id, organizationId: orgId } });
    if (!schedule) throw new NotFoundException("Agendamento não encontrado");

    const data: any = {};
    if (body.titulo !== undefined) data.titulo = body.titulo;
    if (body.ativo !== undefined) data.ativo = body.ativo;
    if (body.frequencia !== undefined) data.frequencia = body.frequencia;
    if (body.destinatarios !== undefined) data.destinatarios = body.destinatarios;
    if (body.formato !== undefined) data.formato = body.formato;
    if (body.filtros !== undefined) data.filtros = body.filtros;

    return this.db.frotaReportSchedule.update({
      where: { id },
      data,
    });
  }

  @Delete(":id")
  @Permissions("frota:relatorios")
  async remove(@Param("id") id: string, @Req() req: any) {
    const orgId = req.user?.organizationId;
    const schedule = await this.db.frotaReportSchedule.findFirst({ where: { id, organizationId: orgId } });
    if (!schedule) throw new NotFoundException("Agendamento não encontrado");

    await this.db.frotaReportSchedule.delete({ where: { id } });
    return { ok: true, message: "Agendamento excluído" };
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
  imports: [AuditModule, NotificationsModule],
  controllers: [
    FrotaDashboardController,
    VeiculosController,
    MotoristasController,
    PneusController,
    RevisoesController,
    PlanosRevisaoController,
    RevisaoAgendaController,
    ManutencoesController,
    DocumentosController,
    AbastecimentosController,
    CondutoresController,
    PneuLayoutController,
    CategoriasVeiculoController,
    FrotaConfigController,
    FrotaRelatoriosController,
    FrotaReportScheduleController,
    FrotaHistoricoController,
  ],
  providers: [FrotaRelatoriosService],
})
export class FrotaModule {}
