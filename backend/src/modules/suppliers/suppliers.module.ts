import {
  Module, Controller, Get, Post, Put, Delete, Patch,
  Body, Param, Query, UseGuards, Req,
  NotFoundException, BadRequestException, ConflictException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import {
  IsString, IsOptional, IsBoolean, IsArray, IsNumber, IsIn, Min,
} from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";

// ── DTOs ──────────────────────────────────────────────────────────────────────

class CreateSupplierDto {
  @IsString() razaoSocial: string;
  @IsOptional() @IsString() nomeFantasia?: string;
  @IsOptional() @IsString() cnpj?: string;
  @IsOptional() @IsString() inscricaoEstadual?: string;
  @IsOptional() @IsString() inscricaoMunicipal?: string;
  @IsOptional() @IsString() tipoEmpresa?: string;
  @IsOptional() @IsArray() categorias?: string[];
  @IsOptional() @IsString() @IsIn(["ativo","inativo","bloqueado"]) status?: string;
  // Contato principal
  @IsOptional() @IsString() contatoNome?: string;
  @IsOptional() @IsString() contatoCargo?: string;
  @IsOptional() @IsString() contatoTelefone?: string;
  @IsOptional() @IsString() contatoTelefone2?: string;
  @IsOptional() @IsString() contatoWhatsapp?: string;
  @IsOptional() @IsString() contatoEmail?: string;
  @IsOptional() @IsString() contatoEmailFinanceiro?: string;
  @IsOptional() @IsString() site?: string;
  // Endereço
  @IsOptional() @IsString() cep?: string;
  @IsOptional() @IsString() logradouro?: string;
  @IsOptional() @IsString() numero?: string;
  @IsOptional() @IsString() complemento?: string;
  @IsOptional() @IsString() bairro?: string;
  @IsOptional() @IsString() cidade?: string;
  @IsOptional() @IsString() estado?: string;
  @IsOptional() @IsString() pais?: string;
  // Financeiro
  @IsOptional() @IsString() banco?: string;
  @IsOptional() @IsString() agencia?: string;
  @IsOptional() @IsString() conta?: string;
  @IsOptional() @IsString() tipoConta?: string;
  @IsOptional() @IsString() pixChave?: string;
  @IsOptional() @IsString() condicaoPagamento?: string;
  @IsOptional() @IsNumber() @Min(0) prazoMedio?: number;
  @IsOptional() @IsString() moeda?: string;
  @IsOptional() @IsString() observacoes?: string;
}

class UpdateSupplierDto {
  @IsOptional() @IsString() razaoSocial?: string;
  @IsOptional() @IsString() nomeFantasia?: string;
  @IsOptional() @IsString() cnpj?: string;
  @IsOptional() @IsString() inscricaoEstadual?: string;
  @IsOptional() @IsString() inscricaoMunicipal?: string;
  @IsOptional() @IsString() tipoEmpresa?: string;
  @IsOptional() @IsArray() categorias?: string[];
  @IsOptional() @IsString() @IsIn(["ativo","inativo","bloqueado"]) status?: string;
  @IsOptional() @IsString() contatoNome?: string;
  @IsOptional() @IsString() contatoCargo?: string;
  @IsOptional() @IsString() contatoTelefone?: string;
  @IsOptional() @IsString() contatoTelefone2?: string;
  @IsOptional() @IsString() contatoWhatsapp?: string;
  @IsOptional() @IsString() contatoEmail?: string;
  @IsOptional() @IsString() contatoEmailFinanceiro?: string;
  @IsOptional() @IsString() site?: string;
  @IsOptional() @IsString() cep?: string;
  @IsOptional() @IsString() logradouro?: string;
  @IsOptional() @IsString() numero?: string;
  @IsOptional() @IsString() complemento?: string;
  @IsOptional() @IsString() bairro?: string;
  @IsOptional() @IsString() cidade?: string;
  @IsOptional() @IsString() estado?: string;
  @IsOptional() @IsString() pais?: string;
  @IsOptional() @IsString() banco?: string;
  @IsOptional() @IsString() agencia?: string;
  @IsOptional() @IsString() conta?: string;
  @IsOptional() @IsString() tipoConta?: string;
  @IsOptional() @IsString() pixChave?: string;
  @IsOptional() @IsString() condicaoPagamento?: string;
  @IsOptional() @IsNumber() @Min(0) prazoMedio?: number;
  @IsOptional() @IsString() moeda?: string;
  @IsOptional() @IsString() observacoes?: string;
}

class CreateContactDto {
  @IsString() nome: string;
  @IsOptional() @IsString() cargo?: string;
  @IsOptional() @IsString() telefone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsBoolean() principal?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function uuid() { return require("crypto").randomUUID(); }

function cleanCnpj(cnpj?: string) {
  if (!cnpj) return null;
  const digits = cnpj.replace(/\D/g, "");
  return digits.length === 14 ? digits : cnpj;
}

function validateCnpj(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  const calc = (d: string, len: number) => {
    let sum = 0, pos = len - 7;
    for (let i = len; i >= 1; i--) {
      sum += parseInt(d.charAt(len - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return (
    calc(digits, 12) === parseInt(digits.charAt(12)) &&
    calc(digits, 13) === parseInt(digits.charAt(13))
  );
}

function mapSupplier(s: any) {
  return {
    id: s.id,
    razaoSocial: s.razaoSocial,
    nomeFantasia: s.nomeFantasia,
    cnpj: s.cnpj,
    inscricaoEstadual: s.inscricaoEstadual,
    inscricaoMunicipal: s.inscricaoMunicipal,
    tipoEmpresa: s.tipoEmpresa,
    categorias: s.categorias ?? [],
    status: s.status,
    contatoNome: s.contatoNome,
    contatoCargo: s.contatoCargo,
    contatoTelefone: s.contatoTelefone,
    contatoTelefone2: s.contatoTelefone2,
    contatoWhatsapp: s.contatoWhatsapp,
    contatoEmail: s.contatoEmail,
    contatoEmailFinanceiro: s.contatoEmailFinanceiro,
    site: s.site,
    cep: s.cep,
    logradouro: s.logradouro,
    numero: s.numero,
    complemento: s.complemento,
    bairro: s.bairro,
    cidade: s.cidade,
    estado: s.estado,
    pais: s.pais,
    banco: s.banco,
    agencia: s.agencia,
    conta: s.conta,
    tipoConta: s.tipoConta,
    pixChave: s.pixChave,
    condicaoPagamento: s.condicaoPagamento,
    prazoMedio: s.prazoMedio,
    moeda: s.moeda,
    observacoes: s.observacoes,
    criadoPor: s.criadoPor ? { id: s.criadoPor.id, nome: s.criadoPor.nome } : null,
    contacts: s.contacts ?? [],
    documents: s.documents ?? [],
    criadoEm: s.criadoEm,
    atualizadoEm: s.atualizadoEm,
  };
}

// ── Controller ────────────────────────────────────────────────────────────────

@Controller("suppliers")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class SuppliersController {
  constructor(private prisma: PrismaService) {}

  // ── List / Search ──────────────────────────────────────────────────────────

  @Get()
  @Permissions("fornecedores:ver")
  async list(
    @Req() req: any,
    @Query("q") q?: string,
    @Query("status") status?: string,
    @Query("categoria") categoria?: string,
    @Query("page") pageQ?: string,
    @Query("limit") limitQ?: string,
  ) {
    const page  = Math.max(1, parseInt(pageQ  || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(limitQ || "20")));
    const skip  = (page - 1) * limit;
    const orgId = req.user?.organizationId;
    const where: any = { ...(orgId ? { organizationId: orgId } as any : {}) };
    if (q) {
      where.OR = [
        { razaoSocial: { contains: q, mode: "insensitive" } },
        { nomeFantasia: { contains: q, mode: "insensitive" } },
        { cnpj: { contains: q.replace(/\D/g,"") } },
        { contatoEmail: { contains: q, mode: "insensitive" } },
      ];
    }
    if (status) where.status = status;
    if (categoria) where.categorias = { has: categoria };

    const [total, items] = await Promise.all([
      (this.prisma as any).supplier.count({ where }),
      (this.prisma as any).supplier.findMany({
        where,
        include: { criadoPor: { select: { id: true, nome: true } } },
        orderBy: { razaoSocial: "asc" },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: items.map(mapSupplier),
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  @Get("search")
  @Permissions("fornecedores:ver")
  async search(@Req() req: any, @Query("q") q?: string) {
    const orgId = req.user?.organizationId;
    const where: any = { status: "ativo", ...(orgId ? { organizationId: orgId } as any : {}) };
    if (q) {
      where.OR = [
        { razaoSocial: { contains: q, mode: "insensitive" } },
        { nomeFantasia: { contains: q, mode: "insensitive" } },
        { cnpj: { contains: q.replace(/\D/g,"") } },
      ];
    }
    const items = await (this.prisma as any).supplier.findMany({
      where,
      select: {
        id: true, razaoSocial: true, nomeFantasia: true, cnpj: true,
        categorias: true, contatoNome: true, contatoEmail: true,
        contatoTelefone: true, cidade: true, estado: true,
        condicaoPagamento: true,
      },
      orderBy: { razaoSocial: "asc" },
      take: 20,
    });
    return items;
  }

  // ── Get One ────────────────────────────────────────────────────────────────

  @Get(":id")
  @Permissions("fornecedores:ver")
  async findOne(@Param("id") id: string, @Req() req: any) {
    const orgId = req.user?.organizationId;
    const s = await (this.prisma as any).supplier.findFirst({
      where: { id, ...(orgId ? { organizationId: orgId } : {}) },
      include: {
        criadoPor: { select: { id: true, nome: true } },
        contacts: { orderBy: [{ principal: "desc" }, { criadoEm: "asc" }] },
        documents: {
          include: { criadoPor: { select: { id: true, nome: true } } },
          orderBy: { criadoEm: "desc" },
        },
        history: {
          include: { usuario: { select: { id: true, nome: true } } },
          orderBy: { criadoEm: "desc" },
          take: 50,
        },
      },
    });
    if (!s) throw new NotFoundException("Fornecedor não encontrado");
    return mapSupplier(s);
  }

  // ── Create ─────────────────────────────────────────────────────────────────

  @Post()
  @Permissions("fornecedores:criar")
  async create(@Body() dto: CreateSupplierDto, @Req() req: any) {
    const cnpj = cleanCnpj(dto.cnpj);
    if (cnpj && !validateCnpj(cnpj)) throw new BadRequestException("CNPJ inválido");

    if (cnpj) {
      const exists = await (this.prisma as any).supplier.findUnique({ where: { cnpj } });
      if (exists) throw new ConflictException("CNPJ já cadastrado");
    }

    const orgId = req.user?.organizationId;
    const s = await (this.prisma as any).supplier.create({
      data: {
        id: uuid(),
        razaoSocial: dto.razaoSocial,
        nomeFantasia: dto.nomeFantasia ?? null,
        cnpj: cnpj,
        inscricaoEstadual: dto.inscricaoEstadual ?? null,
        inscricaoMunicipal: dto.inscricaoMunicipal ?? null,
        tipoEmpresa: dto.tipoEmpresa ?? "LTDA",
        categorias: dto.categorias ?? [],
        status: dto.status ?? "ativo",
        contatoNome: dto.contatoNome ?? null,
        contatoCargo: dto.contatoCargo ?? null,
        contatoTelefone: dto.contatoTelefone ?? null,
        contatoTelefone2: dto.contatoTelefone2 ?? null,
        contatoWhatsapp: dto.contatoWhatsapp ?? null,
        contatoEmail: dto.contatoEmail ?? null,
        contatoEmailFinanceiro: dto.contatoEmailFinanceiro ?? null,
        site: dto.site ?? null,
        cep: dto.cep ?? null,
        logradouro: dto.logradouro ?? null,
        numero: dto.numero ?? null,
        complemento: dto.complemento ?? null,
        bairro: dto.bairro ?? null,
        cidade: dto.cidade ?? null,
        estado: dto.estado ?? null,
        pais: dto.pais ?? "Brasil",
        banco: dto.banco ?? null,
        agencia: dto.agencia ?? null,
        conta: dto.conta ?? null,
        tipoConta: dto.tipoConta ?? null,
        pixChave: dto.pixChave ?? null,
        condicaoPagamento: dto.condicaoPagamento ?? null,
        prazoMedio: dto.prazoMedio ?? null,
        moeda: dto.moeda ?? "BRL",
        observacoes: dto.observacoes ?? null,
        criadoPorId: req.user?.id ?? null,
        ...(orgId ? { organizationId: orgId } : {}),
      } as any,
      include: { criadoPor: { select: { id: true, nome: true } } },
    });

    await (this.prisma as any).supplierHistory.create({
      data: { id: uuid(), supplierId: s.id, usuarioId: req.user?.id ?? null, acao: "criado", detalhes: { razaoSocial: s.razaoSocial } },
    });

    return mapSupplier(s);
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  @Put(":id")
  @Permissions("fornecedores:editar")
  async update(@Param("id") id: string, @Body() dto: UpdateSupplierDto, @Req() req: any) {
    const existing = await (this.prisma as any).supplier.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Fornecedor não encontrado");

    const cnpj = dto.cnpj !== undefined ? cleanCnpj(dto.cnpj) : undefined;
    if (cnpj && !validateCnpj(cnpj)) throw new BadRequestException("CNPJ inválido");

    if (cnpj && cnpj !== existing.cnpj) {
      const dup = await (this.prisma as any).supplier.findFirst({ where: { cnpj, id: { not: id } } });
      if (dup) throw new ConflictException("CNPJ já cadastrado em outro fornecedor");
    }

    const data: any = {};
    const fields = [
      "razaoSocial","nomeFantasia","inscricaoEstadual","inscricaoMunicipal",
      "tipoEmpresa","categorias","status",
      "contatoNome","contatoCargo","contatoTelefone","contatoTelefone2",
      "contatoWhatsapp","contatoEmail","contatoEmailFinanceiro","site",
      "cep","logradouro","numero","complemento","bairro","cidade","estado","pais",
      "banco","agencia","conta","tipoConta","pixChave",
      "condicaoPagamento","prazoMedio","moeda","observacoes",
    ];
    for (const f of fields) { if ((dto as any)[f] !== undefined) data[f] = (dto as any)[f]; }
    if (cnpj !== undefined) data.cnpj = cnpj;

    const s = await (this.prisma as any).supplier.update({
      where: { id },
      data,
      include: {
        criadoPor: { select: { id: true, nome: true } },
        contacts: { orderBy: [{ principal: "desc" }, { criadoEm: "asc" }] },
        documents: { include: { criadoPor: { select: { id: true, nome: true } } }, orderBy: { criadoEm: "desc" } },
      },
    });

    await (this.prisma as any).supplierHistory.create({
      data: { id: uuid(), supplierId: id, usuarioId: req.user?.id ?? null, acao: "editado", detalhes: data },
    });

    return mapSupplier(s);
  }

  // ── Status ─────────────────────────────────────────────────────────────────

  @Patch(":id/status")
  @Permissions("fornecedores:editar")
  async changeStatus(
    @Param("id") id: string,
    @Body("status") status: string,
    @Req() req: any,
  ) {
    const valid = ["ativo","inativo","bloqueado"];
    if (!valid.includes(status)) throw new BadRequestException("Status inválido");

    const existing = await (this.prisma as any).supplier.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Fornecedor não encontrado");

    await (this.prisma as any).supplier.update({ where: { id }, data: { status } });
    await (this.prisma as any).supplierHistory.create({
      data: { id: uuid(), supplierId: id, usuarioId: req.user?.id ?? null, acao: "status_alterado", detalhes: { de: existing.status, para: status } },
    });

    return { success: true, status };
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  @Delete(":id")
  @Permissions("fornecedores:excluir")
  async remove(@Param("id") id: string) {
    const existing = await (this.prisma as any).supplier.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Fornecedor não encontrado");
    await (this.prisma as any).supplier.delete({ where: { id } });
    return { success: true };
  }

  // ── Contacts ───────────────────────────────────────────────────────────────

  @Get(":id/contacts")
  @Permissions("fornecedores:ver")
  async getContacts(@Param("id") id: string) {
    const s = await (this.prisma as any).supplier.findUnique({ where: { id } });
    if (!s) throw new NotFoundException("Fornecedor não encontrado");
    return (this.prisma as any).supplierContact.findMany({
      where: { supplierId: id },
      orderBy: [{ principal: "desc" }, { criadoEm: "asc" }],
    });
  }

  @Post(":id/contacts")
  @Permissions("fornecedores:editar")
  async addContact(@Param("id") id: string, @Body() dto: CreateContactDto) {
    const s = await (this.prisma as any).supplier.findUnique({ where: { id } });
    if (!s) throw new NotFoundException("Fornecedor não encontrado");
    return (this.prisma as any).supplierContact.create({
      data: { id: uuid(), supplierId: id, nome: dto.nome, cargo: dto.cargo ?? null, telefone: dto.telefone ?? null, email: dto.email ?? null, principal: dto.principal ?? false },
    });
  }

  @Delete(":id/contacts/:cid")
  @Permissions("fornecedores:editar")
  async removeContact(@Param("id") id: string, @Param("cid") cid: string) {
    await (this.prisma as any).supplierContact.deleteMany({ where: { id: cid, supplierId: id } });
    return { success: true };
  }

  // ── History ────────────────────────────────────────────────────────────────

  @Get(":id/history")
  @Permissions("fornecedores:ver")
  async getHistory(@Param("id") id: string) {
    const s = await (this.prisma as any).supplier.findUnique({ where: { id } });
    if (!s) throw new NotFoundException("Fornecedor não encontrado");
    return (this.prisma as any).supplierHistory.findMany({
      where: { supplierId: id },
      include: { usuario: { select: { id: true, nome: true } } },
      orderBy: { criadoEm: "desc" },
      take: 100,
    });
  }
}

// ── Module ────────────────────────────────────────────────────────────────────

@Module({
  controllers: [SuppliersController],
})
export class SuppliersModule {}
