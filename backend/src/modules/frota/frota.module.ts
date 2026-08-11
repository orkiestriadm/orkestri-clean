import {
  Module, Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, UseGuards, Req,
  NotFoundException, BadRequestException,
  UseInterceptors, UploadedFile,
} from "@nestjs/common";
import { IsBoolean, IsOptional } from "class-validator";
import { AuthGuard } from "@nestjs/passport";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage, memoryStorage } from "multer";
import { filtroDeTipo, nomeSeguroParaMulter, validarArquivoGravado } from "../../common/arquivo-seguro";
import * as XLSX from "xlsx";
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
import { janelaManutencao, janelaRevisao, dataQueryLocal } from "./frota-datas";
import { ReservasModule } from "./reservas/reservas.module";

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
  /** Hook opcional antes do update. `existing` é o registro atual no banco —
   *  o update é parcial, então campos não enviados não estão em `data`. */
  protected async beforeUpdate(_data: any, _existing: any, _req: any): Promise<void> {}
  /** Hook opcional após persistir (create/update). */
  protected async afterWrite(_row: any, _req: any, _acao: string): Promise<void> {}

  @Get()
  @Permissions("frota:ver")
  async findAll(@Req() req: any, @Query() query: any) {
    const take = Math.min(Number(query.limit) || 50, 1000);
    const skip = (Math.max(Number(query.page) || 1, 1) - 1) * take;
    const where: any = this.scope(req);
    for (const k of this.filterKeys) {
      if (query[k]) where[k] = query[k];
    }
    if (query.q && this.searchFields.length) {
      where.OR = this.searchFields.map(f => {
        if (f.includes(".")) {
          const [rel, field] = f.split(".");
          return { [rel]: { [field]: { contains: query.q } } };
        }
        return { [f]: { contains: query.q } };
      });
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
      organizationId: req.user?.organizationId, userId: req.user?.id, modulo: "frota", tabela: this.tabela, registroId: row.id,
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
    await this.beforeUpdate(data, existing, req);
    let row: any;
    try {
      row = await this.delegate.update({ where: { id }, data, include: this.includeOne || this.include });
    } catch (e: any) {
      if (e.code === "P2002") throw new BadRequestException("Registro duplicado (valor único já utilizado)");
      throw e;
    }
    await this.afterWrite(row, req, "editar");
    await this.audit.log({
      organizationId: req.user?.organizationId, userId: req.user?.id, modulo: "frota", tabela: this.tabela, registroId: id,
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
      organizationId: req.user?.organizationId, userId: req.user?.id, modulo: "frota", tabela: this.tabela, registroId: id,
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
  setor:       { select: { id: true, nome: true, cor: true } },
};

// ── DTOs gerados: sem classe, o ValidationPipe global nao tem metadata e a
//    rota aceita qualquer JSON. Campos derivados do tipo inline anterior.
class UpdateFrotaDto {
  @IsOptional() @IsBoolean() bloqueioCnhVencida?: boolean;
}

@Controller("frota/veiculos")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class VeiculosController extends BaseFrotaController {
  constructor(prisma: PrismaService, audit: AuditService) { super(prisma, audit); }
  protected model = "veiculo";
  protected tabela = "veiculos";
  protected searchFields = ["placa", "codigo", "identificacao", "marca", "modelo", "renavam", "chassi"];
  protected requiredFields = ["placa"];
  protected filterKeys = ["status", "categoriaId", "tipo", "combustivel", "setorId", "motoristaId", "responsavelId", "centroCusto"];
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
    { k: "codigo", t: "string" }, { k: "identificacao", t: "string" },
    { k: "placa", t: "string" }, { k: "renavam", t: "string" },
    { k: "chassi", t: "string" }, { k: "marca", t: "string" }, { k: "modelo", t: "string" },
    { k: "anoFabricacao", t: "int" }, { k: "anoModelo", t: "int" }, { k: "cor", t: "string" },
    { k: "tipo", t: "string" }, { k: "combustivel", t: "string" }, { k: "categoriaId", t: "string" },
    { k: "status", t: "string" }, { k: "kmAtual", t: "int" }, { k: "horimetroAtual", t: "int" }, { k: "capacidadeTanque", t: "float" },
    { k: "motoristaId", t: "string" }, { k: "responsavelId", t: "string" }, { k: "centroCusto", t: "string" },
    { k: "unidade", t: "string" }, { k: "setorId", t: "string" }, { k: "ativoId", t: "string" },
    { k: "dataAquisicao", t: "date" }, { k: "valorAquisicao", t: "float" }, { k: "observacoes", t: "string" }, { k: "descricao", t: "string" },
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

  // POST /frota/veiculos/:id/atualizar-km — atualiza o "KM atual" (hodômetro) do veículo.
  // Sem { km } no corpo: PUXA o maior KM lançado nos abastecimentos (só sobe).
  // Com { km }: define manualmente (permite correção). O kmAtual e lido pela Revisao e pelos Pneus.
  @Post(":id/atualizar-km")
  @Permissions("frota:editar")
  async atualizarKm(@Param("id") id: string, @Body() body: any, @Req() req: any) {
    const orgId = req.user?.organizationId;
    const v = await this.db.veiculo.findFirst({ where: { id, organizationId: orgId, deletedAt: null }, select: { id: true, kmAtual: true } });
    if (!v) throw new NotFoundException("Veículo não encontrado");

    const manual = body?.km != null && body.km !== "";
    let novoKm: number | null = manual ? Math.trunc(Number(body.km)) : null;
    let fonte = "manual";
    let ultimoAbastecimento: Date | null = null;
    if (!manual) {
      const ab = await this.db.abastecimento.findFirst({
        where: { veiculoId: id, organizationId: orgId, deletedAt: null, kmAtual: { not: null } },
        orderBy: { kmAtual: "desc" }, select: { kmAtual: true, data: true },
      });
      novoKm = ab?.kmAtual ?? null;
      ultimoAbastecimento = ab?.data ?? null;
      fonte = "abastecimento";
    }
    if (novoKm == null || isNaN(novoKm)) throw new BadRequestException("Nenhum KM de abastecimento encontrado. Informe o KM manualmente.");

    // Abastecimento so atualiza para cima (hodometro e monotonico); ajuste manual pode corrigir.
    const aplicado = manual ? true : novoKm > (v.kmAtual ?? 0);
    if (aplicado) await this.db.veiculo.update({ where: { id }, data: { kmAtual: novoKm } });
    return { aplicado, fonte, anterior: v.kmAtual ?? null, kmAtual: aplicado ? novoKm : (v.kmAtual ?? null), ultimoAbastecimento };
  }

  // POST /frota/veiculos/km/sincronizar — sincroniza o KM de TODOS os veiculos a partir do
  // ultimo abastecimento de cada um (so sobe). Retorna quantos foram atualizados.
  @Post("km/sincronizar")
  @Permissions("frota:editar")
  async sincronizarKm(@Req() req: any) {
    const orgId = req.user?.organizationId;
    const veiculos = await this.db.veiculo.findMany({ where: { organizationId: orgId, deletedAt: null }, select: { id: true, kmAtual: true } });
    let atualizados = 0;
    for (const v of veiculos) {
      const ab = await this.db.abastecimento.findFirst({
        where: { veiculoId: v.id, organizationId: orgId, deletedAt: null, kmAtual: { not: null } },
        orderBy: { kmAtual: "desc" }, select: { kmAtual: true },
      });
      if (ab?.kmAtual != null && ab.kmAtual > (v.kmAtual ?? 0)) {
        await this.db.veiculo.update({ where: { id: v.id }, data: { kmAtual: ab.kmAtual } });
        atualizados++;
      }
    }
    return { atualizados, total: veiculos.length };
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
    for (const m of manut) ev.push({ tipo: "manutencao", data: m.data || m.dataAbertura || m.dataAgendada || m.criadoEm, titulo: `Manutenção ${m.tipo || ""}`.trim(), descricao: [m.descricao, m.oficina].filter(Boolean).join(" · "), valor: m.custo ?? null });
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
    // Validade é DIA, não instante. `new Date("2026-08-15")` é meia-noite UTC =
    // 14/08 21:00 no fuso do container, e a CNH ficaria gravada um dia antes do
    // que o usuário digitou — inclusive antecipando o alerta de vencimento.
    // As 220 CNHs atuais estão corretas (meia-noite local), então este é um
    // defeito latente: nunca chegou a produzir dado errado.
    let validadeNova: Date, cnhEmissao: Date | null;
    try {
      validadeNova = dataQueryLocal(body.validadeNova)!;
      cnhEmissao = dataQueryLocal(body.dataRenovacao);
    } catch (e: any) {
      throw new BadRequestException(e?.message || "Data inválida");
    }
    const renov = await this.db.motoristaCnhRenovacao.create({
      data: {
        id: crypto.randomUUID(), organizationId: orgId, motoristaId: id,
        numeroAnterior: m.cnh || null, categoriaAnterior: m.categoriaCnh || null, validadeAnterior: m.validadeCnh || null,
        numeroNovo: body.numeroNovo || m.cnh || null, categoriaNova: body.categoriaNova || m.categoriaCnh || null,
        validadeNova, orgaoEmissor: body.orgaoEmissor || m.orgaoEmissor || null,
        observacoes: body.observacoes || null, criadoPorId: req.user?.id || null,
      },
    });
    await this.db.motorista.update({
      where: { id },
      data: {
        cnh: body.numeroNovo || m.cnh, categoriaCnh: body.categoriaNova || m.categoriaCnh,
        validadeCnh: validadeNova, orgaoEmissor: body.orgaoEmissor || m.orgaoEmissor,
        ...(cnhEmissao ? { cnhEmissao } : {}),
        atualizadoPorId: req.user?.id || null,
      },
    });
    await this.audit.log({ organizationId: req.user?.organizationId, userId: req.user?.id, modulo: "frota", tabela: "motoristas", registroId: id, acao: "editar", descricao: "Renovou CNH", ip: req.ip });
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
      // Extensao da lista de tipos aceitos, nunca de `originalname`.
      filename: nomeSeguroParaMulter,
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: filtroDeTipo,
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
  async update(@Body() body: UpdateFrotaDto, @Req() req: any) {
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
    await this.audit.log({ organizationId: req.user?.organizationId, userId: req.user?.id, modulo: "frota", tabela: "pneus", registroId: id, acao: "editar", descricao: `Pneu: ${tipo}`, ip: req.ip });
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

  /** Revisão marcada como realizada precisa ter data de realização — era o
   *  campo que o relatório e a dashboard usam para situar a revisão no período.
   *  Medido em 2026-07-24: só 12 de 52 revisões tinham `dataRealizada`. */
  protected async beforeCreate(data: any, _req: any): Promise<void> {
    if (data.status === "realizada" && !data.dataRealizada) {
      data.dataRealizada = data.dataPrevista || new Date();
    }
  }

  protected async beforeUpdate(data: any, existing: any, _req: any): Promise<void> {
    const status = data.status ?? existing?.status;
    if (status === "realizada" && !data.dataRealizada && !existing?.dataRealizada) {
      data.dataRealizada = data.dataPrevista ?? existing?.dataPrevista ?? new Date();
    }
  }
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
    { k: "modelo", t: "string" }, { k: "marca", t: "string" }, { k: "veiculoId", t: "string" }, { k: "tipo", t: "string" },
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
      // Plano vinculado a um veículo específico aplica só a ele; senão, casa por modelo (+marca).
      const planosV = planos.filter((p: any) => p.veiculoId
        ? p.veiculoId === v.id
        : (norm(p.modelo) === norm(v.modelo) && (!p.marca || norm(p.marca) === norm(v.marca))));
      for (const p of planosV) {
        const last = lastByKey[`${v.id}::${p.tipo}`];
        const base: any = { veiculoId: v.id, placa: v.placa, codigo: v.codigo, modelo: v.modelo, tipo: p.tipo, baseTipo: p.base, planoId: p.id, kmAtual: v.kmAtual, ultimaData: last?.dataRealizada || null, ultimaKm: last?.kmRealizado ?? null };
        if (p.base === "km" && p.intervaloKm) {
          const lastKm = last?.kmRealizado ?? v.kmAtual;
          const prox = lastKm + p.intervaloKm;
          const restante = prox - v.kmAtual;
          itens.push({ ...base, proximaKm: prox, atual: v.kmAtual, restante, unidade: "km", intervalo: p.intervaloKm, pct: Math.max(0, Math.min(1, 1 - restante / p.intervaloKm)), farol: farolFromPct(restante / p.intervaloKm) });
        } else if (p.base === "data" && p.intervaloDias) {
          const lastData = last?.dataRealizada ? new Date(last.dataRealizada) : (v.dataAquisicao ? new Date(v.dataAquisicao) : new Date(v.criadoEm));
          const prox = new Date(lastData.getTime() + p.intervaloDias * 86400000);
          const restante = Math.ceil((prox.getTime() - Date.now()) / 86400000);
          itens.push({ ...base, proximaData: prox, restante, unidade: "dias", intervalo: p.intervaloDias, pct: Math.max(0, Math.min(1, 1 - restante / p.intervaloDias)), farol: farolFromPct(restante / p.intervaloDias) });
        } else if (p.base === "horimetro" && p.intervaloHorimetro) {
          if (v.horimetroAtual == null) { itens.push({ ...base, semDado: true, unidade: "h", farol: "cinza" }); }
          else {
            const lastH = last?.horimetro ?? v.horimetroAtual;
            const prox = lastH + p.intervaloHorimetro;
            const restante = prox - v.horimetroAtual;
            itens.push({ ...base, proximaHorimetro: prox, atual: v.horimetroAtual, restante, unidade: "h", intervalo: p.intervaloHorimetro, pct: Math.max(0, Math.min(1, 1 - restante / p.intervaloHorimetro)), farol: farolFromPct(restante / p.intervaloHorimetro) });
          }
        }
      }
    }
    // Agenda controlada só por PLANO (KM/data/horímetro). Agendamentos avulsos por data
    // (registros agendada/atrasada) NÃO entram mais na agenda — o controle é pelo plano.
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
    _count: { select: { anexos: { where: { deletedAt: null } } } },
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
    { k: "previsaoLiberacao", t: "date" }, { k: "dataFechamento", t: "date" }, { k: "km", t: "int" },
    { k: "imobiliza", t: "bool" }, { k: "localizacao", t: "string" },
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
    // `imobiliza` é NOT NULL. O coerce transforma "" em null, então um campo
    // vazio vindo do formulário derrubaria o insert no Prisma.
    if (data.imobiliza == null) data.imobiliza = true;
    if (!data.dataAbertura) data.dataAbertura = new Date();
    // `data` é a data de referência da OS para custo e relatório. O formulário
    // não a envia, e nada a preenchia — resultado: 100% das OS ficavam com
    // `data` NULL e sumiam de qualquer filtro por período. Ancorar na abertura.
    if (!data.data) data.data = data.dataAbertura;
    data.custo = (data.custoPecas || 0) + (data.custoServicos || 0) + (data.custoTerceiros || 0);
  }

  protected async beforeUpdate(data: any, existing: any, _req: any): Promise<void> {
    // Mesma proteção do create: nunca gravar null num campo NOT NULL.
    if ("imobiliza" in data && data.imobiliza == null) data.imobiliza = true;
    // Repara OS antigas ao primeiro salvamento e cobre o caso de a abertura ser
    // preenchida só na edição.
    const abertura = data.dataAbertura ?? existing?.dataAbertura;
    if (!data.data && !existing?.data && abertura) data.data = abertura;
    // Fecha a OS junto com a conclusão, se ainda não tiver fechamento.
    if (data.status && ["finalizada", "cancelada"].includes(data.status)
        && !data.dataFechamento && !existing?.dataFechamento) {
      data.dataFechamento = new Date();
    }
  }

  protected async afterWrite(row: any, req: any, _acao: string): Promise<void> {
    const total = await this.recalcTotal(row.id);
    row.custo = total;
    await this.avisarChamado(row.id, req);
  }

  /**
   * Encerrar a OS avisa o chamado que a originou.
   *
   * AVISA, não fecha. Quem abriu o chamado pode ter pendência que a oficina não
   * resolve — peça em garantia, laudo, aprovação de custo — e fechar por fora
   * tiraria essa decisão de quem é dono dela. O sentido chamado → OS é
   * automático (ver `chamados.module.ts`); este aqui é só informativo.
   *
   * Nunca derruba o salvamento da OS: o aviso é acessório, e um erro aqui não
   * pode fazer o mecânico perder o lançamento de custo.
   */
  private async avisarChamado(id: string, req: any): Promise<void> {
    try {
      const os = await this.db.manutencaoVeiculo.findUnique({
        where: { id },
        select: {
          id: true, numeroOs: true, status: true, chamadoId: true,
          veiculo: { select: { placa: true } },
        },
      });
      if (!os?.chamadoId || !["finalizada", "cancelada"].includes(os.status)) return;

      const chamado = await (this.db as any).chamado.findUnique({
        where: { id: os.chamadoId },
        select: { id: true, numero: true, titulo: true, status: true, solicitanteId: true },
      });
      if (!chamado) return;

      // Idempotência sem coluna extra: o texto começa com a identificação da
      // OS, então salvar a OS de novo não empilha avisos repetidos.
      const prefixo = `Manutenção ${os.numeroOs || os.id} do veículo ${os.veiculo?.placa || ""}`;
      const jaAvisado = await (this.db as any).chamadoComentario.findFirst({
        where: { chamadoId: chamado.id, texto: { startsWith: prefixo } },
        select: { id: true },
      });
      if (jaAvisado) return;

      const verbo = os.status === "cancelada" ? "cancelada" : "finalizada";
      const autorId = req?.user?.id;
      if (autorId) {
        await (this.db as any).chamadoComentario.create({
          data: {
            chamadoId: chamado.id, userId: autorId, interno: false,
            texto: `${prefixo} foi ${verbo} no módulo de Frotas.`,
          },
        });
      }

      // O comentário só aparece para quem abrir o chamado. O sino é o que faz o
      // solicitante saber sem ficar conferindo.
      if (chamado.solicitanteId && chamado.solicitanteId !== autorId && !["resolvido", "fechado"].includes(chamado.status)) {
        await (this.db as any).notification.create({
          data: {
            userId: chamado.solicitanteId,
            tipo: "frota_manutencao_encerrada",
            modulo: "fleet",
            titulo: `Manutenção ${verbo} — chamado #${chamado.numero}`,
            mensagem: `${prefixo} foi ${verbo}. Confira se o chamado já pode ser encerrado.`,
            referenciaTipo: "chamado",
            referenciaId: chamado.id,
          },
        });
      }
    } catch {
      // Silencioso de propósito: ver o comentário do método.
    }
  }

  private async recalcTotal(id: string): Promise<number> {
    const m = await this.db.manutencaoVeiculo.findUnique({ where: { id }, select: { custoPecas: true, custoServicos: true, custoTerceiros: true } });
    if (!m) return 0;
    const mo = await this.db.manutencaoMaoObra.aggregate({ _sum: { custo: true }, where: { manutencaoId: id } });
    const total = (m.custoPecas || 0) + (m.custoServicos || 0) + (m.custoTerceiros || 0) + (mo._sum.custo || 0);
    await this.db.manutencaoVeiculo.update({ where: { id }, data: { custo: total } });
    return total;
  }

  /**
   * Importa a planilha FORFT_0005 ("Controle de Manutenções Corretivas").
   *
   * Duas abas, dois formatos:
   *
   *  - "Controle Frota": log histórico, uma linha = uma OS já encerrada.
   *  - "Controle": SNAPSHOT DIÁRIO da frota inteira — a mesma avaria reaparece
   *    todo dia enquanto está aberta (12.374 linhas para ~130 dias).
   *
   * O snapshot é colapsado por PERÍODO CONTÍNUO, não por texto. Deduplicar
   * pelo problema não funciona porque o texto cresce dia a dia — o operador vai
   * anexando "(OC. 06 - 13/12)", "(OC. 11 - 14/12)" na mesma célula, o que
   * geraria uma OS nova a cada dia. Medido na planilha real: colapso por texto
   * produzia 3.349 OS (2.865 abertas, para 95 veículos); colapso por período
   * produz 662, e as 27 que ficam abertas na última foto batem com os 7 parados
   * + 22 com avaria que a própria planilha contabiliza.
   *
   * Sem `confirmar`, é dry-run — devolve o que faria, sem escrever nada.
   *
   * NÃO cria veículo e NÃO altera cadastro existente. O que não casar sai
   * listado em `placasSemCadastro` para o usuário cadastrar pela tela;
   * `preencherIdentificacao` é o único opt-in de escrita fora das OS, e mesmo
   * ele só preenche apelido vazio. A base de homologação tem carga real.
   */
  @Post("importar")
  @Permissions("frota:criar")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } }))
  async importar(@UploadedFile() file: any, @Body() body: any, @Req() req: any) {
    const orgId = req.user?.organizationId;
    if (!file?.buffer) throw new BadRequestException("Arquivo obrigatório");
    const flag = (v: any) => v === "true" || v === true;
    const confirmar = flag(body?.confirmar);
    const preencherIdentificacao = flag(body?.preencherIdentificacao);

    const wb = XLSX.read(file.buffer, { type: "buffer", cellDates: true });

    const veiculos = await this.db.veiculo.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: { id: true, placa: true, codigo: true, identificacao: true },
    });
    const byPlaca = new Map<string, any>();
    const byIdent = new Map<string, any>();
    for (const v of veiculos) {
      if (v.placa) byPlaca.set(normPlacaImp(v.placa), v);
      if (v.codigo) byPlaca.set(normPlacaImp(v.codigo), v);
      if (v.identificacao) byIdent.set(normPlacaImp(v.identificacao), v);
    }

    // ── Pré-passagem: mapa apelido → placa, vindo da aba de cadastro ───────────
    // Precisa vir ANTES de extrair as OS: a aba "Base" é a terceira do arquivo,
    // e sem ela as duas primeiras não conseguiriam resolver linhas identificadas
    // só pelo apelido (o log histórico não preenche a coluna Placa dos
    // equipamentos — traz apenas "TR03", "R04").
    const identParaPlaca = new Map<string, string>();
    for (const nomeAba of wb.SheetNames) {
      const ws = wb.Sheets[nomeAba];
      if (!ws) continue;
      const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
      const iCab = acharCabecalho(raw);
      if (iCab < 0) continue;
      const header = (raw[iCab] || []).map(normHeader);
      const iP = header.indexOf("placa"), iI = header.indexOf("identificacao");
      if (iP < 0 || iI < 0) continue;
      for (const r of raw.slice(iCab + 1)) {
        const placa = String(r?.[iP] ?? "").trim();
        const ident = String(r?.[iI] ?? "").trim();
        if (placa && ident && !identParaPlaca.has(normPlacaImp(ident))) {
          identParaPlaca.set(normPlacaImp(ident), placa);
        }
      }
    }

    /**
     * Resolve a linha da planilha para um veículo do cadastro.
     *
     * Quatro tentativas, porque planilha e cadastro nomeiam equipamento de
     * formas diferentes:
     *  1. placa direta (ou código interno);
     *  2. apelido, quando o cadastro já tem `identificacao` preenchida;
     *  3. **placa + apelido concatenados** — o cadastro registra a máquina como
     *     "ROÇADEIRA A01" enquanto a planilha quebra em placa="ROÇADEIRA" e
     *     identificação="A01". Sem isto, 295 OS (as 20 roçadeiras) ficavam sem
     *     dono, todas colidindo no mesmo rótulo genérico "ROÇADEIRA";
     *  4. ponte pela aba de cadastro: apelido → placa → veículo, para o log
     *     histórico, que traz só "TR03" e nenhuma placa.
     */
    const acharVeiculo = (placaRaw: string, identRaw: string) => {
      const p = normPlacaImp(placaRaw), i = normPlacaImp(identRaw);
      if (p && byPlaca.has(p)) return byPlaca.get(p);
      if (i && byIdent.has(i)) return byIdent.get(i);
      if (p && byIdent.has(p)) return byIdent.get(p);
      if (p && i && byPlaca.has(p + i)) return byPlaca.get(p + i);
      if (i && identParaPlaca.has(i)) {
        const v = byPlaca.get(normPlacaImp(identParaPlaca.get(i)!));
        if (v) return v;
      }
      return null;
    };

    // ── Leitura das abas ──────────────────────────────────────────────────────
    // `osExtraidas` já sai no formato de OS; a colapsagem do snapshot acontece
    // por aba, porque só ali existe a noção de "dia da foto".
    const osExtraidas: any[] = [];
    const identificacoes = new Map<string, string>(); // placa normalizada → apelido
    let semVeiculo = 0, semData = 0, linhasLidas = 0, linhasColapsadas = 0;
    const naoCasadas = new Map<string, string>();     // chave → rótulo original

    for (const nomeAba of wb.SheetNames) {
      const ws = wb.Sheets[nomeAba];
      if (!ws) continue;
      const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
      const iCab = acharCabecalho(raw);
      if (iCab < 0) continue;

      const header = (raw[iCab] || []).map(normHeader);
      const col = (...nomes: string[]) => {
        for (const n of nomes) { const i = header.indexOf(n); if (i >= 0) return i; }
        return -1;
      };
      const iBaixa = col("dt baixa"), iPrev = col("prev liberacao", "previsao liberacao"),
            iLib = col("dt liberacao"), iPlaca = col("placa"), iIdent = col("identificacao"),
            iSetor = col("setor"), iStatus = col("status"), iLocal = col("localizacao"),
            iTipo = col("tipo manut"), iProb = col("problema"), iPrest = col("prestador de servico"),
            iObs = col("observacao"), iValor = col("valor"), iDia = col("dia");

      // Sem coluna de problema não há OS a extrair (é o caso da aba "Base",
      // que é só cadastro, e da aba "Revisões", vazia).
      if (iProb < 0 && iTipo < 0) {
        // Ainda assim a aba de cadastro serve para o mapa placa → identificação.
        if (iPlaca >= 0 && iIdent >= 0) {
          for (const r of raw.slice(iCab + 1)) {
            const p = normPlacaImp(r?.[iPlaca]); const id = String(r?.[iIdent] ?? "").trim();
            if (p && id) identificacoes.set(p, id);
          }
        }
        continue;
      }

      const lidas: any[] = [];
      for (const r of raw.slice(iCab + 1)) {
        if (!r || !r.some((c: any) => c != null && c !== "")) continue;

        const placaRaw = iPlaca >= 0 ? String(r[iPlaca] ?? "").trim() : "";
        const identRaw = iIdent >= 0 ? String(r[iIdent] ?? "").trim() : "";
        const problema = iProb >= 0 ? String(r[iProb] ?? "").trim() : "";
        const tipoRaw = iTipo >= 0 ? String(r[iTipo] ?? "").trim() : "";

        // Linha de veículo sadio no snapshot: existe só para completar a lista
        // da frota daquele dia, não representa manutenção nenhuma.
        if (!problema && !tipoRaw) continue;
        linhasLidas++;

        const placaNorm = normPlacaImp(placaRaw);
        if (placaNorm && identRaw) identificacoes.set(placaNorm, identRaw);

        const veic = acharVeiculo(placaRaw, identRaw);

        if (!veic) {
          // Rótulo com o apelido junto: "ROÇADEIRA" sozinho não diz qual das 20.
          const rotulo = [placaRaw, identRaw].filter(Boolean).join(" ") || placaRaw || identRaw;
          if (rotulo) naoCasadas.set(normPlacaImp(rotulo), rotulo);
          semVeiculo++;
          continue;
        }

        lidas.push({
          aba: nomeAba, placaRaw, identRaw, placaNorm, veiculo: veic,
          dtBaixa: iBaixa >= 0 ? parseDataPlanilha(r[iBaixa]) : null,
          dtDia: iDia >= 0 ? parseDataPlanilha(r[iDia]) : null,
          previsaoLiberacao: iPrev >= 0 ? parseDataPlanilha(r[iPrev]) : null,
          dataFechamento: iLib >= 0 ? parseDataPlanilha(r[iLib]) : null,
          statusPlanilha: iStatus >= 0 ? String(r[iStatus] ?? "").trim() : "",
          setor: iSetor >= 0 ? String(r[iSetor] ?? "").trim() : "",
          localizacao: iLocal >= 0 ? String(r[iLocal] ?? "").trim() : "",
          tipo: normTipoManut(tipoRaw),
          problema,
          prestador: iPrest >= 0 ? String(r[iPrest] ?? "").trim() : "",
          observacao: iObs >= 0 ? String(r[iObs] ?? "").trim() : "",
          valor: iValor >= 0 ? parseValorPlanilha(r[iValor]) : null,
        });
      }

      // Uma aba é snapshot quando tem coluna "Dia" preenchida: é a foto diária
      // da frota. Sem ela, cada linha já é uma OS fechada do log histórico.
      const ehSnapshot = iDia >= 0 && lidas.some(l => l.dtDia);

      if (!ehSnapshot) {
        for (const l of lidas) {
          const abertura = l.dtBaixa || l.dataFechamento;
          if (!abertura) { semData++; continue; }
          osExtraidas.push({
            ...l,
            dataAbertura: abertura,
            // O log histórico é fechado por definição — são registros de 2022
            // e 2023. Linha sem "Dt liberação" significa campo não preenchido
            // na época, não veículo parado há três anos. Importar essas 13
            // linhas em aberto deixaria os veículos vermelhos para sempre.
            dataFechamento: l.dataFechamento || abertura,
            historico: true,
          });
        }
        continue;
      }

      // ── Colapso do snapshot em períodos contínuos ───────────────────────────
      // A mesma avaria reaparece todo dia enquanto está aberta, e o texto do
      // problema CRESCE (o operador vai anexando "(OC. 06 - 13/12)"...). Por
      // isso não dá para deduplicar por texto: a chave mudaria a cada dia.
      // O que identifica uma OS é o PERÍODO em que o veículo esteve com
      // problema — uma corrida de dias consecutivos vira uma OS só.
      const slots = [...new Set(lidas.map(l => l.dtDia?.getTime()).filter(Boolean))].sort((a: any, b: any) => a - b) as number[];
      const idxSlot = new Map(slots.map((t, i) => [t, i]));

      const porVeiculo = new Map<string, any[]>();
      for (const l of lidas) {
        if (!l.dtDia) continue;
        if (!porVeiculo.has(l.veiculo.id)) porVeiculo.set(l.veiculo.id, []);
        porVeiculo.get(l.veiculo.id)!.push(l);
      }

      for (const [, arr] of porVeiculo) {
        arr.sort((a, b) => a.dtDia.getTime() - b.dtDia.getTime());
        let run: any[] = [];

        const fechar = () => {
          if (!run.length) return;
          linhasColapsadas += run.length - 1;
          const primeira = run[0], ultima = run[run.length - 1];
          const ultIdx = idxSlot.get(ultima.dtDia.getTime())!;
          // Se o veículo deixou de aparecer com problema antes do fim da
          // planilha, ele foi liberado — o próximo snapshot é a melhor
          // estimativa da data. Só fica aberta a OS que chega até a última foto.
          const liberacaoImplicita = ultIdx < slots.length - 1 ? new Date(slots[ultIdx + 1]) : null;
          osExtraidas.push({
            ...ultima,                                  // texto e status mais recentes
            dataAbertura: primeira.dtBaixa || primeira.dtDia,
            dataFechamento: ultima.dataFechamento || liberacaoImplicita,
            fechamentoImplicito: !ultima.dataFechamento && !!liberacaoImplicita,
            snapshots: run.length,
          });
          run = [];
        };

        for (const l of arr) {
          if (!run.length) { run = [l]; continue; }
          const ant = run[run.length - 1];
          // Tolera lacuna curta: a planilha só é preenchida em dia útil, então
          // fim de semana e feriado abrem buracos que não significam liberação.
          const gap = idxSlot.get(l.dtDia.getTime())! - idxSlot.get(ant.dtDia.getTime())!;
          // Nova "Dt baixa" = novo evento, mesmo sem intervalo entre eles.
          const mudouBaixa = !!(l.dtBaixa && ant.dtBaixa && l.dtBaixa.getTime() !== ant.dtBaixa.getTime());
          if (gap > SNAPSHOT_GAP_MAX || mudouBaixa) { fechar(); run = [l]; }
          else run.push(l);
        }
        fechar();
      }
    }

    if (!osExtraidas.length) throw new BadRequestException("Nenhuma linha de manutenção encontrada. Esperado o layout FORFT_0005 (colunas Placa, Problema, Tipo Manut).");

    // ── Corte opcional por data de abertura ───────────────────────────────────
    // `ate=YYYY-MM-DD` importa só o que abriu até essa data. Serve para trazer o
    // histórico sem tocar na janela em que o sistema já vinha sendo alimentado —
    // é a forma de levar o risco de duplicata a zero em vez de conferir caso a
    // caso.
    let ignoradasPorCorte = 0;
    let candidatas = osExtraidas;
    if (body?.ate) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(body.ate).trim());
      if (!m) throw new BadRequestException("Parâmetro `ate` deve ser YYYY-MM-DD");
      const corte = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999);
      const antes = candidatas.length;
      candidatas = candidatas.filter(c => c.dataAbertura && c.dataAbertura <= corte);
      ignoradasPorCorte = antes - candidatas.length;
    }

    // ── Dedup contra o que já existe no banco ─────────────────────────────────
    const jaNoBanco = await this.db.manutencaoVeiculo.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        veiculoId: { in: [...new Set(candidatas.map(c => c.veiculo.id))] },
      },
      select: { veiculoId: true, dataAbertura: true, data: true, descricao: true },
    });
    const existentes = new Set(jaNoBanco.map((m: any) =>
      chaveOsImportada(m.veiculoId, m.dataAbertura || m.data, m.descricao || "")));

    /**
     * Segunda chave, SEM o texto: veículo + dia.
     *
     * A chave com texto não protege contra a OS que já está no sistema, porque
     * os dois lados descrevem o mesmo evento de ângulos diferentes — a planilha
     * registra a RECLAMAÇÃO ("Problema na embreagem") e o sistema registra o
     * SERVIÇO EXECUTADO ("TROCA DE KIT EMBREAGEM"). Nunca vão casar por texto.
     * Medido na base de homologação: 4 OS da planilha caem no mesmo veículo e
     * mesmo dia de uma OS já existente.
     */
    const porVeiculoDia = new Set(jaNoBanco.map((m: any) =>
      chaveVeiculoDia(m.veiculoId, m.dataAbertura || m.data)));

    const aInserir = candidatas.filter(c =>
      !existentes.has(chaveOsImportada(c.veiculo.id, c.dataAbertura, c.problema))
      && !porVeiculoDia.has(chaveVeiculoDia(c.veiculo.id, c.dataAbertura)));
    const duplicadas = candidatas.length - aInserir.length;

    /**
     * Quase-colisões: mesmo veículo, abertura a poucos dias de uma OS já
     * existente. Não são descartadas — podem ser eventos distintos — mas saem
     * listadas para conferência, porque é aí que mora a duplicata semântica que
     * nenhuma chave automática pega.
     */
    const porVeiculoDatas = new Map<string, number[]>();
    for (const m of jaNoBanco) {
      const d = m.dataAbertura || m.data;
      if (!d) continue;
      if (!porVeiculoDatas.has(m.veiculoId)) porVeiculoDatas.set(m.veiculoId, []);
      porVeiculoDatas.get(m.veiculoId)!.push(new Date(d).getTime());
    }
    const revisarManualmente = aInserir
      .filter(c => (porVeiculoDatas.get(c.veiculo.id) || [])
        .some(t => Math.abs(t - c.dataAbertura.getTime()) <= PROXIMIDADE_DUPLICATA_MS))
      .map(c => ({
        veiculo: c.veiculo.placa,
        dataAbertura: c.dataAbertura,
        problema: String(c.problema || "").slice(0, 100),
      }));

    const placasSemCadastro = [...naoCasadas.values()].sort();

    // Cadastro que ganharia apelido — só informativo enquanto não confirmado.
    const identificacoesAplicaveis = veiculos.filter((v: any) =>
      !v.identificacao && v.placa && identificacoes.get(normPlacaImp(v.placa)));

    const datas = aInserir.map(c => c.dataAbertura).filter(Boolean) as Date[];
    const abertasResultantes = aInserir.filter(c => !c.dataFechamento);
    const resumo: any = {
      linhasLidas,
      abas: [...new Set(candidatas.map(c => c.aba))],
      osDistintas: candidatas.length,
      linhasColapsadas,
      inserir: aInserir.length,
      ficariamAbertas: abertasResultantes.length,
      ficariamParadas: abertasResultantes.filter(c => imobilizaDoStatusPlanilha(c.statusPlanilha)).length,
      fechamentosImplicitos: aInserir.filter(c => c.fechamentoImplicito).length,
      duplicadas,
      // Não são descartadas — o usuário decide olhando a lista.
      revisarManualmente,
      ignoradasPorCorte,
      semVeiculoCadastrado: semVeiculo,
      semDataUtilizavel: semData,
      placasSemCadastro,
      identificacoesAPreencher: identificacoesAplicaveis.length,
      periodo: datas.length
        ? { de: new Date(Math.min(...datas.map(d => d.getTime()))), ate: new Date(Math.max(...datas.map(d => d.getTime()))) }
        : null,
    };

    if (!confirmar) {
      return {
        dryRun: true,
        resumo,
        // Amostra priorizando o que ficaria ABERTO: é o que muda o farol da
        // frota hoje e o que o usuário precisa conferir antes de confirmar.
        amostra: [...aInserir].sort((a, b) => Number(!!a.dataFechamento) - Number(!!b.dataFechamento))
          .slice(0, 25).map(c => ({
            veiculo: c.veiculo.placa, aba: c.aba,
            dataAbertura: c.dataAbertura, dataFechamento: c.dataFechamento,
            fechamentoImplicito: !!c.fechamentoImplicito,
            tipo: c.tipo,
            imobiliza: c.dataFechamento ? false : imobilizaDoStatusPlanilha(c.statusPlanilha),
            statusPlanilha: c.statusPlanilha || null,
            problema: c.problema.slice(0, 120), prestador: c.prestador || null, valor: c.valor,
          })),
      };
    }

    // ===== COMMIT =====
    // Não há criação automática de veículo aqui, ao contrário do importador de
    // abastecimentos. Os registros sem correspondência nesta planilha são
    // equipamentos identificados por nome ("ROÇADEIRA", "Mini Retro",
    // "Retroescavadeira"), não placas — criá-los às cegas encheria uma base
    // real de cadastro incompleto. Eles saem listados em `placasSemCadastro`
    // para o usuário cadastrar pela tela, com tipo e setor corretos, e então
    // reimportar.
    let identificacoesPreenchidas = 0;
    if (preencherIdentificacao) {
      for (const v of veiculos) {
        if (v.identificacao || !v.placa) continue;
        const apelido = identificacoes.get(normPlacaImp(v.placa));
        if (!apelido) continue;
        // Só preenche vazio — nunca sobrescreve o que o usuário já cadastrou.
        const r = await this.db.veiculo.updateMany({
          where: { id: v.id, organizationId: orgId, identificacao: null },
          data: { identificacao: apelido },
        });
        identificacoesPreenchidas += r.count;
      }
    }

    const finais = aInserir;

    // Numeração sequencial contínua a partir do que já existe, para as OS
    // importadas não colidirem com as criadas pela tela.
    let seq = await this.db.manutencaoVeiculo.count({ where: { organizationId: orgId } });
    let inseridas = 0;
    const erros: string[] = [];

    for (const c of finais.sort((a, b) => a.dataAbertura.getTime() - b.dataAbertura.getTime())) {
      let numeroOs = `OS-${String(++seq).padStart(5, "0")}`;
      while (await this.db.manutencaoVeiculo.findFirst({ where: { organizationId: orgId, numeroOs } })) {
        numeroOs = `OS-${String(++seq).padStart(5, "0")}`;
      }
      // A planilha tem linhas com "Dt liberação" ANTERIOR à "Dt baixa" (erro de
      // digitação na origem). Importar como está cria OS de duração negativa —
      // aconteceu 2 vezes na carga de 04/08/2026.
      //
      // O fechamento é ancorado na abertura (duração zero) em vez de anulado.
      // Anular reabriria a OS, e afirmar que um veículo está parado desde 2023
      // por causa de um erro de digitação é pior que registrar uma manutenção
      // de duração desconhecida. A OS aconteceu e terminou; só não se sabe
      // quando — mesma regra já usada para a aba histórica sem "Dt liberação".
      if (c.dataFechamento && c.dataFechamento.getTime() < c.dataAbertura.getTime()) {
        c.dataFechamento = c.dataAbertura;
        c.fechamentoInconsistente = true;
      }
      const encerrada = !!c.dataFechamento;
      try {
        await this.db.manutencaoVeiculo.create({
          data: {
            id: crypto.randomUUID(), organizationId: orgId, veiculoId: c.veiculo.id,
            numeroOs, tipo: c.tipo,
            descricao: c.problema || null,
            // `data` ancora a OS no período — sem ela a OS some de qualquer
            // filtro por data (armadilha conhecida deste módulo).
            data: c.dataAbertura, dataAbertura: c.dataAbertura,
            previsaoLiberacao: c.previsaoLiberacao,
            dataFechamento: c.dataFechamento,
            status: encerrada ? "finalizada" : "aberta",
            // OS já encerrada não imobiliza mais ninguém; para as abertas vale
            // o status operacional que a planilha registrou.
            imobiliza: encerrada ? false : imobilizaDoStatusPlanilha(c.statusPlanilha),
            localizacao: c.localizacao || null,
            oficina: c.prestador || null,
            custoServicos: c.valor, custo: c.valor,
            observacoes: c.observacao || null,
            criadoPorId: req.user?.id || null,
          } as any,
        });
        inseridas++;
      } catch (e: any) {
        erros.push(`${c.veiculo.placa} ${c.dataAbertura?.toISOString?.().slice(0, 10)}: ${e?.message || e}`);
      }
    }

    return {
      dryRun: false,
      resumo: { ...resumo, inseridas, identificacoesPreenchidas, erros: erros.slice(0, 20) },
    };
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
      // Extensao da lista de tipos aceitos, nunca de `originalname`.
      filename: nomeSeguroParaMulter,
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: filtroDeTipo,
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
      // Extensao da lista de tipos aceitos, nunca de `originalname`.
      filename: nomeSeguroParaMulter,
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: filtroDeTipo,
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

// ── Helpers da importação de planilha de abastecimento (cartão-combustível) ──────
const stripAccents = (s: string) => s.normalize("NFD").split("").filter(c => { const x = c.charCodeAt(0); return x < 768 || x > 879; }).join("");
const normHeader = (h: any) => stripAccents(String(h ?? "").trim().toLowerCase());
const normPlacaImp = (s: any) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const PLATE_RE = /^([A-Z]{3}[0-9]{4}|[A-Z]{3}[0-9][A-Z][0-9]{2})$/; // antiga LLLNNNN ou Mercosul LLLNLNN
function normComb(s: any): string {
  const t = stripAccents(String(s ?? "").toLowerCase());
  if (t.includes("arla")) return "arla";
  if (t.includes("diesel")) return "diesel";
  if (t.includes("etanol") || t.includes("alcool")) return "etanol";
  if (t.includes("gasolina")) return "gasolina";
  if (t.includes("gnv")) return "gnv";
  return "";
}
function toNumImp(v: any): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return isNaN(n) ? null : n;
}
function toIntImp(v: any): number | null {
  const n = toNumImp(v); return n == null ? null : Math.trunc(n);
}
function parseDataHora(v: any): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v;
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const y = Number(m[3]), mo = Number(m[2]), d = Number(m[1]);
    const h = Number(m[4] || 0), mi = Number(m[5] || 0), se = Number(m[6] || 0);
    const dt = new Date(y, mo - 1, d, h, mi, se);
    return isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}
const KM_SALTO_MAX = 30000; // avanço plausível de hodômetro numa importação

// ── Helpers da importação de manutenções corretivas (planilha FORFT_0005) ──────

/**
 * Data vinda de célula de planilha: Date (cellDates), serial Excel ou texto.
 *
 * SEMPRE devolve meia-noite LOCAL. Sem isso:
 *  - o caminho do serial Excel produz meia-noite UTC, que em America/Sao_Paulo
 *    é 21h do DIA ANTERIOR — a OS seria gravada um dia atrás;
 *  - o caminho `cellDates` devolve `00:00:28` (arredondamento do SheetJS,
 *    verificado na planilha real), sujando a chave de deduplicação e fazendo
 *    duas datas do mesmo dia parecerem diferentes.
 * É a mesma armadilha de fuso que o `diaLocal()` dos relatórios já resolve.
 */
function meiaNoiteLocal(ano: number, mes1a12: number, dia: number): Date | null {
  const d = new Date(ano, mes1a12 - 1, dia);
  return isNaN(d.getTime()) || d.getMonth() !== mes1a12 - 1 ? null : d;
}

function parseDataPlanilha(v: any): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    // Já vem no fuso local; zera a hora residual.
    return meiaNoiteLocal(v.getFullYear(), v.getMonth() + 1, v.getDate());
  }
  if (typeof v === "number") {
    // Serial Excel: dias desde 30/12/1899. Faixa sanitária evita que um número
    // solto numa célula de data (ex.: um KM digitado errado) vire ano 3500.
    if (v < 1 || v > 80000) return null;
    const utc = new Date(Math.round((v - 25569) * 86400000));
    if (isNaN(utc.getTime())) return null;
    // Lê os componentes em UTC (é onde o serial os colocou) e remonta local.
    return meiaNoiteLocal(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
  }
  const s = String(v).trim();
  // A planilha mistura dd/mm/aaaa e m/d/aa. Sem saber a origem de cada célula,
  // trata >12 no primeiro campo como dia; o resto fica ambíguo e é descartado
  // se não formar data válida.
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let [, a, b, y] = m;
    let ano = Number(y); if (ano < 100) ano += ano < 70 ? 2000 : 1900;
    let dia = Number(a), mes = Number(b);
    if (dia <= 12 && mes > 12) { const t = dia; dia = mes; mes = t; }
    return meiaNoiteLocal(ano, mes, dia);
  }
  return null;
}

/** "R$ 13,315.00" / "1.234,56" → número. */
function parseValorPlanilha(v: any): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  let s = String(v).replace(/[R$\s]/gi, "").trim();
  if (!s || s === "-") return null;
  // Decide o separador decimal pelo que aparece por último.
  const ultVirg = s.lastIndexOf(","), ultPonto = s.lastIndexOf(".");
  if (ultVirg > ultPonto) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return isFinite(n) ? n : null;
}

/** Tipo de manutenção da planilha → vocabulário do sistema. */
function normTipoManut(v: any): string {
  const t = stripAccents(String(v ?? "").toLowerCase());
  // "Preventiva/Corretiva" aparece bastante: o que dispara a OS é a corretiva.
  if (t.includes("corretiv") || t.includes("coretiv")) return "corretiva";
  if (t.includes("preventiv") || t.includes("prevetiv")) return "preventiva";
  if (t.includes("incidente") || t.includes("emergenc")) return "emergencial";
  return "corretiva";
}

/**
 * Status operacional da planilha → { imobiliza }.
 * "Parado" = a OS tira o veículo de operação; "Operando com Avaria" = não.
 */
function imobilizaDoStatusPlanilha(v: any): boolean {
  const t = stripAccents(String(v ?? "").toLowerCase()).trim();
  if (!t) return true;               // sem status declarado, mantém o padrão
  if (t.startsWith("parado")) return true;
  if (t.includes("avaria")) return false;
  if (t.startsWith("operando")) return false;
  return true;
}

/** Dia local de uma data, em `YYYY-MM-DD`. */
function diaChave(dt: Date | null): string {
  // Componentes LOCAIS, não `toISOString()`: em fuso positivo a meia-noite local
  // vira o dia anterior em UTC e a chave passaria a apontar para outro dia.
  if (!dt) return "sem-data";
  const d = new Date(dt);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Chave "só posição": veículo + dia, sem o texto do problema. */
function chaveVeiculoDia(veiculoId: string, dt: Date | null): string {
  return `${veiculoId}|${diaChave(dt)}`;
}

/** Janela em que duas OS do mesmo veículo levantam suspeita de duplicata. */
const PROXIMIDADE_DUPLICATA_MS = 7 * 86400000;

/** Chave de deduplicação de uma OS importada. */
function chaveOsImportada(veiculoId: string, dt: Date | null, problema: string): string {
  const dia = diaChave(dt);
  const p = stripAccents(String(problema || "").toLowerCase()).replace(/\s+/g, " ").trim().slice(0, 120);
  return `${veiculoId}|${dia}|${p}`;
}

/**
 * Lacuna máxima, em fotos consecutivas, que ainda mantém o mesmo período.
 * A planilha só é preenchida em dia útil: feriado emendado abre buraco de até
 * 3 fotos sem que o veículo tenha sido liberado.
 */
const SNAPSHOT_GAP_MAX = 3;

/** Localiza a linha de cabeçalho procurando a que contém "placa". */
function acharCabecalho(raw: any[][], limite = 15): number {
  for (let i = 0; i < Math.min(raw.length, limite); i++) {
    const linha = (raw[i] || []).map(normHeader);
    if (linha.includes("placa")) return i;
  }
  return -1;
}

// ── Abastecimentos ─────────────────────────────────────────────────────────────
@Controller("frota/abastecimentos")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class AbastecimentosController extends BaseFrotaController {
  constructor(prisma: PrismaService, audit: AuditService) { super(prisma, audit); }
  protected model = "abastecimento";
  protected tabela = "abastecimentos";
  protected searchFields = ["veiculo.placa", "veiculo.codigo", "posto"];
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

  // POST /frota/abastecimentos/importar — importa planilha de transações de cartão-combustível.
  // Sem confirmar (padrão): DRY-RUN (prévia, não grava). confirmar=true: grava.
  // Regras: casa veículo por placa (fallback código/nº da frota); ARLA e linhas sem placa são
  // ignoradas; placas reais não cadastradas são criadas; kmAtual só avança se o salto for plausível.
  @Post("importar")
  @Permissions("frota:criar")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }))
  async importar(@UploadedFile() file: any, @Body() body: any, @Req() req: any) {
    const orgId = req.user?.organizationId;
    if (!file?.buffer) throw new BadRequestException("Arquivo obrigatório");
    const confirmar = body?.confirmar === "true" || body?.confirmar === true;

    const wb = XLSX.read(file.buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    if (!raw?.length) throw new BadRequestException("Planilha vazia");
    const header = (raw[0] || []).map(normHeader);
    const col = (name: string) => header.indexOf(name);
    const iData = col("data/hora lancamento"), iPlaca = col("placa"), iCond = col("condutor"),
          iPosto = col("credenciado / nome fantasia"), iComb = col("combustivel"),
          iQtd = col("quantidade"), iVUnit = col("valor unitario"), iVTot = col("valor total"),
          iKm = col("km"), iFrota = col("numero da frota");
    if (iPlaca < 0 || iKm < 0) throw new BadRequestException("Layout não reconhecido (esperado relatório com colunas Placa e KM).");

    const veiculos = await this.db.veiculo.findMany({ where: { organizationId: orgId, deletedAt: null }, select: { id: true, placa: true, codigo: true, kmAtual: true } });
    const byPlaca = new Map<string, any>(), byCodigo = new Map<string, any>();
    for (const v of veiculos) { if (v.placa) byPlaca.set(normPlacaImp(v.placa), v); if (v.codigo) byCodigo.set(normPlacaImp(v.codigo), v); }

    const dataRows = raw.slice(1).filter(r => r && r.some((c: any) => c != null && c !== ""));
    const parsed: any[] = [];
    for (const r of dataRows) {
      const placa = normPlacaImp(r[iPlaca]);
      const comb = normComb(r[iComb]);
      const p: any = {
        placaRaw: String(r[iPlaca] ?? "").trim(), placa, comb,
        km: toIntImp(r[iKm]), litros: toNumImp(r[iQtd]), valorLitro: toNumImp(r[iVUnit]), valorTotal: toNumImp(r[iVTot]),
        data: parseDataHora(r[iData]),
        posto: (r[iPosto] != null ? String(r[iPosto]).trim() : "") || null,
        condutor: (r[iCond] != null ? String(r[iCond]).trim() : "") || null,
        frota: iFrota >= 0 ? normPlacaImp(r[iFrota]) : "",
      };
      let veic = placa ? (byPlaca.get(placa) || byCodigo.get(placa)) : null;
      if (!veic && p.frota) veic = byCodigo.get(p.frota) || byPlaca.get(p.frota);
      p.veiculo = veic || null;
      if (comb === "arla") { p.acao = "ignorar"; p.motivo = "ARLA (não é combustível)"; }
      else if (!placa) { p.acao = "ignorar"; p.motivo = "sem placa"; }
      else if (veic) { p.acao = "importar"; }
      else if (PLATE_RE.test(placa)) { p.acao = "cadastrar"; p.motivo = "placa não cadastrada — será criada"; }
      else { p.acao = "ignorar"; p.motivo = "código (não é placa)"; }
      parsed.push(p);
    }

    // dedup contra o que já existe (veículo + data exata)
    const datas = parsed.map(p => p.data).filter(Boolean) as Date[];
    let existentes = new Set<string>();
    if (datas.length) {
      const min = new Date(Math.min(...datas.map(d => d.getTime()))), max = new Date(Math.max(...datas.map(d => d.getTime())));
      const ja = await this.db.abastecimento.findMany({ where: { organizationId: orgId, deletedAt: null, data: { gte: min, lte: max } }, select: { veiculoId: true, data: true } });
      existentes = new Set(ja.map(a => `${a.veiculoId}|${new Date(a.data).getTime()}`));
    }
    // Dedup contra o banco E entre as linhas do próprio arquivo (vistos acumula as já contadas).
    const vistos = new Set<string>(existentes);
    for (const p of parsed) {
      if (p.acao !== "importar" || !p.veiculo || !p.data) continue;
      const k = `${p.veiculo.id}|${p.data.getTime()}`;
      if (vistos.has(k)) { p.acao = "duplicado"; p.motivo = existentes.has(k) ? "já importado" : "linha repetida na planilha"; }
      else vistos.add(k);
    }

    const placasCadastrar = [...new Set(parsed.filter(p => p.acao === "cadastrar").map(p => p.placa))];
    const placasIgnoradas = [...new Set(parsed.filter(p => p.acao === "ignorar" && p.placa && p.motivo === "código (não é placa)").map(p => p.placa))];
    const resumo: any = {
      totalLinhas: parsed.length,
      importar: parsed.filter(p => p.acao === "importar").length,
      cadastrarEImportar: parsed.filter(p => p.acao === "cadastrar").length,
      duplicados: parsed.filter(p => p.acao === "duplicado").length,
      ignorados: parsed.filter(p => p.acao === "ignorar").length,
      placasNovas: placasCadastrar, placasIgnoradas,
      periodo: datas.length ? { de: new Date(Math.min(...datas.map(d => d.getTime()))), ate: new Date(Math.max(...datas.map(d => d.getTime()))) } : null,
    };

    if (!confirmar) {
      return { dryRun: true, resumo, amostra: parsed.slice(0, 25).map(p => ({ placa: p.placaRaw, veiculo: p.veiculo?.placa || null, data: p.data, km: p.km, litros: p.litros, comb: p.comb, acao: p.acao, motivo: p.motivo || null })) };
    }

    // ===== COMMIT =====
    const novos = new Map<string, any>();
    for (const placa of placasCadastrar) {
      const v = await this.db.veiculo.create({ data: { id: crypto.randomUUID(), organizationId: orgId, placa, codigo: `IMP-${placa}`, status: "ativo", tipo: "carro", kmAtual: 0, criadoPorId: req.user?.id || null } as any });
      novos.set(placa, v); byPlaca.set(placa, v);
    }
    for (const p of parsed) {
      if (p.acao === "cadastrar") { p.veiculo = novos.get(p.placa) || null; p.acao = p.veiculo ? "importar" : "ignorar"; }
    }

    // Já deduplicado na marcação acima (banco + intra-arquivo): basta pegar os "importar".
    const aInserir = parsed
      .filter(p => p.acao === "importar" && p.veiculo && p.data)
      .sort((a, b) => a.data.getTime() - b.data.getTime());
    let inseridos = 0;
    const kmPorVeiculo = new Map<string, number>();
    for (const p of aInserir) {
      const vid = p.veiculo.id;
      let valorTotal = p.valorTotal;
      if (valorTotal == null && p.litros != null && p.valorLitro != null) valorTotal = Number((p.litros * p.valorLitro).toFixed(2));
      let consumoKmL: number | null = null, custoKm: number | null = null;
      if (p.km != null) {
        const ant = await this.db.abastecimento.findFirst({ where: { veiculoId: vid, deletedAt: null, kmAtual: { not: null, lt: p.km } }, orderBy: { data: "desc" }, select: { kmAtual: true } });
        if (ant?.kmAtual != null) { const dist = p.km - ant.kmAtual; if (dist > 0) { if (p.litros) consumoKmL = Number((dist / p.litros).toFixed(2)); if (valorTotal != null) custoKm = Number((valorTotal / dist).toFixed(3)); } }
      }
      await this.db.abastecimento.create({ data: { id: crypto.randomUUID(), organizationId: orgId, veiculoId: vid, data: p.data, kmAtual: p.km, litros: p.litros, valorLitro: p.valorLitro, valorTotal, tipoCombustivel: p.comb || null, posto: p.posto, consumoKmL, custoKm, criadoPorId: req.user?.id || null } as any });
      inseridos++;
      if (p.km != null) {
        const atual = p.veiculo.kmAtual ?? 0;
        const plausivel = atual === 0 ? (p.km > 0 && p.km < 2000000) : (p.km > atual && (p.km - atual) <= KM_SALTO_MAX);
        if (plausivel) kmPorVeiculo.set(vid, Math.max(kmPorVeiculo.get(vid) ?? 0, p.km));
      }
    }
    let kmAtualizados = 0;
    for (const [vid, km] of kmPorVeiculo) {
      // Veículos novos são criados com kmAtual 0 e os existentes têm valor; só avança para cima.
      const rr = await this.db.veiculo.updateMany({ where: { id: vid, kmAtual: { lt: km } }, data: { kmAtual: km } });
      kmAtualizados += rr.count;
    }
    return { dryRun: false, resumo: { ...resumo, inseridos, veiculosCadastrados: novos.size, kmAtualizados } };
  }

  // GET /frota/abastecimentos/analise/consumo — consumo médio, custo/km e desvios
  @Get("analise/consumo")
  @Permissions("frota:ver")
  async analise(@Req() req: any, @Query("from") from?: string, @Query("to") to?: string, @Query("veiculoId") veiculoId?: string) {
    const orgId = req.user?.organizationId;
    const range: any = {};
    // `dataQueryLocal` ancora no fuso local e valida — `new Date(from)` cru
    // puxava o dia anterior e transformava data malformada em erro 500.
    try {
      const de = dataQueryLocal(from);
      const ate = dataQueryLocal(to, true);
      if (de) range.gte = de;
      if (ate) range.lte = ate;
    } catch (e: any) {
      throw new BadRequestException(e?.message || "Data inválida");
    }
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
  constructor(private prisma: PrismaService, private relService: FrotaRelatoriosService) {}
  private get db() { return this.prisma as any; }

  /**
   * Farol da frota — foto do status operacional de cada veículo.
   *
   * Espelha `GET /frota/relatorios/status-frota`, mas exige só `frota:ver`: é
   * um painel de acompanhamento diário da operação, não um relatório gerencial.
   * Exportar continua sendo do domínio de `frota:relatorios`.
   */
  @Get("farol")
  @Permissions("frota:ver")
  async farol(@Req() req: any, @Query() q: any) {
    return this.relService.statusFrota(req.user?.organizationId, q);
  }

  /** Série diária de operando / com avaria / parado, derivada das janelas de OS. */
  @Get("disponibilidade-historico")
  @Permissions("frota:ver")
  async disponibilidadeHistorico(@Req() req: any, @Query() q: any) {
    return this.relService.historicoDisponibilidade(req.user?.organizationId, q);
  }

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
      // "concluida" nunca foi gravado pelo formulário — o status de OS encerrada
      // é "finalizada". O filtro antigo (`notIn ["concluida","cancelada"]`)
      // contava toda OS finalizada como aberta, inflando este KPI em silêncio.
      this.db.manutencaoVeiculo.count({ where: { ...base, status: { notIn: ["finalizada", "concluida", "cancelada"] } } }),
      this.db.manutencaoVeiculo.aggregate({ _sum: { custo: true }, where: { ...base, ...janelaManutencao({ gte: inicioMes }) } }),
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
    // Mesma correção da análise de consumo: `new Date("2026-07-01")` é UTC e
    // vira 30/06 21:00 no fuso do container, arrastando o dia anterior para
    // dentro do período. O default (sem filtro) já era construído com
    // componentes locais e por isso estava correto — só o caminho com filtro
    // do usuário é que errava.
    let to: Date, from: Date;
    try {
      to = dataQueryLocal(q.to, true) || (() => { const d = new Date(now); d.setHours(23, 59, 59, 999); return d; })();
      from = dataQueryLocal(q.from) || new Date(now.getFullYear(), now.getMonth() - 5, 1);
    } catch (e: any) {
      throw new BadRequestException(e?.message || "Data inválida");
    }
    if (from.getTime() > to.getTime()) throw new BadRequestException("Período inválido: início posterior ao fim.");
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
    const em30 = new Date(now.getTime() + 30 * 86400000);
    const em90 = new Date(now.getTime() + 90 * 86400000);
    const hoje = new Date(now); hoje.setHours(0, 0, 0, 0);
    const dia = (n: number) => new Date(hoje.getTime() + n * 86400000);

    // Filtro de veículos
    const vehWhere: any = { organizationId: orgId, deletedAt: null };
    if (q.tipo) vehWhere.tipo = q.tipo;
    if (q.unidade) vehWhere.unidade = q.unidade;
    if (q.centroCusto) vehWhere.centroCusto = q.centroCusto;
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
      this.db.manutencaoVeiculo.aggregate({ _sum: { custo: true }, where: { organizationId: orgId, deletedAt: null, veiculoId: inSet, ...janelaManutencao({ gte: inicioMes }) } }),
      this.db.abastecimento.aggregate({ _sum: { valorTotal: true }, where: { organizationId: orgId, deletedAt: null, veiculoId: inSet, data: { gte: inicioMes } } }),
      this.db.revisaoVeiculo.aggregate({ _sum: { custo: true }, where: { organizationId: orgId, deletedAt: null, veiculoId: inSet, ...janelaRevisao({ gte: inicioMes }) } }),
      this.db.documentoVeiculo.aggregate({ _sum: { valor: true }, where: { organizationId: orgId, deletedAt: null, veiculoId: inSet, dataEmissao: { gte: inicioMes } } }),
      this.db.manutencaoVeiculo.findMany({ where: { organizationId: orgId, deletedAt: null, veiculoId: inSet, ...janelaManutencao(periodo) }, select: { veiculoId: true, custo: true, data: true, dataAbertura: true } }),
      this.db.abastecimento.findMany({ where: { organizationId: orgId, deletedAt: null, veiculoId: inSet, data: periodo, ...(q.motoristaId ? { motoristaId: q.motoristaId } : {}) }, select: { veiculoId: true, valorTotal: true, litros: true, consumoKmL: true, data: true } }),
      this.db.revisaoVeiculo.findMany({ where: { organizationId: orgId, deletedAt: null, veiculoId: inSet, ...janelaRevisao(periodo) }, select: { veiculoId: true, custo: true, dataRealizada: true, dataPrevista: true } }),
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

  @Get("status-frota")
  @Permissions("frota:relatorios")
  async statusFrota(@Req() req: any, @Query() q: any) {
    const orgId = req.user?.organizationId;
    return this.relService.statusFrota(orgId, q);
  }

  @Post("enviar-email")
  @Permissions("frota:relatorios")
  async enviarEmail(@Req() req: any, @Body() body: any) {
    const orgId = req.user?.organizationId;
    return this.relService.enviarEmail(orgId, body, req.user?.id);
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
  imports: [AuditModule, NotificationsModule, ReservasModule],
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
