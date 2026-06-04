import {
  Module, Controller, Get, Post, Put, Patch, Delete,
  Body, Param, UseGuards, Req, Res, HttpCode,
  ForbiddenException, NotFoundException, ConflictException, BadRequestException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsString, IsOptional, IsBoolean, IsEmail, MinLength } from "class-validator";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { JwtModule } from "@nestjs/jwt";
import { Response } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import { WhatsAppService } from "../notifications/whatsapp.service";
import { EmailService } from "../notifications/email.service";
import * as bcrypt from "bcryptjs";

class CreateOrgDto {
  @IsString() nome: string;
  @IsString() slug: string;
  @IsOptional() @IsString() plano?: string;
  @IsOptional() @IsString() cnpj?: string;
  @IsOptional() @IsString() nomeFantasia?: string;
  @IsOptional() @IsString() segmento?: string;
  @IsOptional() @IsString() site?: string;
  @IsOptional() @IsString() emailContato?: string;
  @IsOptional() @IsString() telefone?: string;
  @IsOptional() @IsString() responsavelNome?: string;
  @IsOptional() @IsString() cep?: string;
  @IsOptional() @IsString() endereco?: string;
  @IsOptional() @IsString() cidade?: string;
  @IsOptional() @IsString() estado?: string;
  @IsOptional() @IsString() observacoes?: string;
}
class UpdateOrgDto {
  @IsOptional() @IsString() nome?: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() plano?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
  @IsOptional() @IsString() statusOperacional?: string;
  @IsOptional() @IsString() statusComercial?: string;
  @IsOptional() @IsString() cnpj?: string;
  @IsOptional() @IsString() nomeFantasia?: string;
  @IsOptional() @IsString() segmento?: string;
  @IsOptional() @IsString() site?: string;
  @IsOptional() @IsString() emailContato?: string;
  @IsOptional() @IsString() telefone?: string;
  @IsOptional() @IsString() responsavelNome?: string;
  @IsOptional() @IsString() cep?: string;
  @IsOptional() @IsString() endereco?: string;
  @IsOptional() @IsString() cidade?: string;
  @IsOptional() @IsString() estado?: string;
  @IsOptional() @IsString() observacoes?: string;
}
class VincularClienteDto {
  @IsString() clienteId: string;
}
class InviteMasterDto {
  @IsString() nome: string;
  @IsEmail() email: string;
  @IsString() @MinLength(6) senha: string;
}

function isSuperAdmin(req: any) {
  // SOMENTE o Super Admin GLOBAL (administrator@orkiestri.com) — nunca
  // um master de tenant. Fecha o vazamento cross-tenant: masters de
  // organização não enxergam/gerenciam outras organizações.
  return req.user?.isSuperAdmin === true;
}

// ── Super-admin: Organization management ──────────────────────────────────────

@Controller("superadmin/organizations")
@UseGuards(AuthGuard("jwt"))
class SuperAdminOrgsController {
  constructor(private prisma: PrismaService, private wa: WhatsAppService, private config: ConfigService, private jwtService: JwtService, private email: EmailService) {}

  private guard(req: any) {
    if (!isSuperAdmin(req)) throw new ForbiddenException("Acesso restrito a super-admins");
  }

  @Get()
  async list(@Req() req: any) {
    this.guard(req);
    const orgs = await (this.prisma as any).organization.findMany({
      orderBy: { criadoEm: "asc" },
      include: {
        _count: { select: { users: true, chamados: true } },
        whatsappConfig: true,
      },
    });
    return orgs.map((o: any) => ({
      id: o.id, nome: o.nome, slug: o.slug, plano: o.plano, ativo: o.ativo,
      criadoEm: o.criadoEm,
      crmClienteId: o.crmClienteId ?? null,
      statusComercial: o.statusComercial ?? null,
      statusOperacional: o.statusOperacional ?? null,
      cnpj: o.cnpj ?? null,
      nomeFantasia: o.nomeFantasia ?? null,
      segmento: o.segmento ?? null,
      site: o.site ?? null,
      emailContato: o.emailContato ?? null,
      telefone: o.telefone ?? null,
      responsavelNome: o.responsavelNome ?? null,
      cep: o.cep ?? null,
      endereco: o.endereco ?? null,
      cidade: o.cidade ?? null,
      estado: o.estado ?? null,
      observacoes: o.observacoes ?? null,
      usuarios: o._count.users,
      chamados: o._count.chamados,
      whatsapp: o.whatsappConfig ? {
        instanceName: o.whatsappConfig.instanceName,
        conectado: o.whatsappConfig.conectado,
        phoneNumber: o.whatsappConfig.phoneNumber,
        ultimaConexao: o.whatsappConfig.ultimaConexao,
      } : null,
    }));
  }

  @Get(":id")
  async findOne(@Req() req: any, @Param("id") id: string) {
    this.guard(req);
    const org = await (this.prisma as any).organization.findUnique({
      where: { id },
      include: { whatsappConfig: true, _count: { select: { users: true, chamados: true } } },
    });
    if (!org) throw new NotFoundException("Organização não encontrada");
    return org;
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateOrgDto) {
    this.guard(req);
    const exists = await (this.prisma as any).organization.findUnique({ where: { slug: dto.slug } });
    if (exists) throw new ConflictException("Slug já em uso");
    const { plano, ...rest } = dto;
    const org = await (this.prisma as any).organization.create({
      data: { ...rest, plano: plano || "starter" },
    });
    return org;
  }

  @Put(":id")
  @Patch(":id")
  async update(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateOrgDto) {
    this.guard(req);
    const org = await (this.prisma as any).organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException("Organização não encontrada");
    if (dto.slug && dto.slug !== org.slug) {
      const exists = await (this.prisma as any).organization.findUnique({ where: { slug: dto.slug } });
      if (exists) throw new ConflictException("Slug já em uso");
    }
    return (this.prisma as any).organization.update({
      where: { id },
      data: { ...dto },
    });
  }

  @Delete(":id")
  async remove(@Req() req: any, @Param("id") id: string) {
    this.guard(req);
    const org = await (this.prisma as any).organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException("Organização não encontrada");
    if (org.slug === "default") throw new ForbiddenException("Não é possível excluir a organização padrão");
    try {
      await (this.prisma as any).organization.delete({ where: { id } });
      return { ok: true };
    } catch (e: any) {
      // Caso reste alguma FK sem cascade, retorna mensagem clara em vez de 500
      if (e?.code === "P2003" || /foreign key/i.test(e?.message || "")) {
        throw new BadRequestException(
          "Não foi possível excluir: ainda há registros vinculados a esta organização que impedem a remoção. Contate o suporte técnico.",
        );
      }
      throw e;
    }
  }

  @Get(":id/crm-cliente")
  async getCrmCliente(@Req() req: any, @Param("id") id: string) {
    this.guard(req);
    const org = await (this.prisma as any).organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException("Organização não encontrada");
    if (!org.crmClienteId) return null;
    const cliente = await (this.prisma as any).cliente.findUnique({ where: { id: org.crmClienteId } });
    return cliente ?? null;
  }

  @Post(":id/vincular-cliente")
  async vincularCliente(@Req() req: any, @Param("id") id: string, @Body() dto: VincularClienteDto) {
    this.guard(req);
    const org = await (this.prisma as any).organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException("Organização não encontrada");
    const cliente = await (this.prisma as any).cliente.findUnique({ where: { id: dto.clienteId } });
    if (!cliente) throw new NotFoundException("Cliente não encontrado");
    await Promise.all([
      (this.prisma as any).organization.update({ where: { id }, data: { crmClienteId: dto.clienteId } }),
      (this.prisma as any).cliente.update({ where: { id: dto.clienteId }, data: { tenantOrgId: id } }),
    ]);
    return { ok: true };
  }

  @Post(":id/invite-master")
  async inviteMaster(@Req() req: any, @Param("id") orgId: string, @Body() dto: InviteMasterDto) {
    this.guard(req);
    const org = await (this.prisma as any).organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException("Organização não encontrada");
    const exists = await this.prisma.user.findFirst({
      where: { email: dto.email, organizationId: orgId } as any,
    });
    if (exists) throw new ConflictException("E-mail já cadastrado nesta organização");
    const masterRole = await this.prisma.role.findFirst({ where: { isMaster: true } });
    const hash = await bcrypt.hash(dto.senha, 12);
    const user = await this.prisma.user.create({
      data: {
        nome: dto.nome, email: dto.email, senhaHash: hash, ativo: true,
        primeiroAcesso: true,
        organizationId: orgId,
        userRoles: masterRole ? { create: { roleId: masterRole.id } } : undefined,
      } as any,
    });
    // Envia as credenciais de acesso por e-mail ao convidado
    let entregaEmail = false;
    try {
      entregaEmail = await this.email.sendUserInvite(dto.email, dto.nome, dto.senha, org.nome, "Master");
    } catch { entregaEmail = false; }
    return { id: user.id, nome: user.nome, email: user.email, organizationId: orgId, senha: dto.senha, entregaEmail };
  }

  // ── WhatsApp per-org ─────────────────────────────────────────────────────

  @Get(":id/whatsapp/status")
  async waStatus(@Req() req: any, @Param("id") id: string) {
    this.guard(req);
    return this.wa.getOrgStatus(id);
  }

  @Post(":id/whatsapp/create-instance")
  async waCreate(@Req() req: any, @Param("id") id: string) {
    this.guard(req);
    const org = await (this.prisma as any).organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException("Organização não encontrada");
    return this.wa.createOrgInstance(id, org.slug);
  }

  @Get(":id/whatsapp/qrcode")
  async waQrCode(@Req() req: any, @Param("id") id: string) {
    this.guard(req);
    return this.wa.getOrgQrCode(id);
  }

  @Post(":id/whatsapp/disconnect")
  async waDisconnect(@Req() req: any, @Param("id") id: string) {
    this.guard(req);
    return this.wa.disconnectOrg(id);
  }

  @Patch(":id/whatsapp/phone")
  async setPhone(@Req() req: any, @Param("id") id: string, @Body() body: { phoneNumber: string }) {
    this.guard(req);
    await (this.prisma as any).orgWhatsappConfig.upsert({
      where: { organizationId: id },
      create: { organizationId: id, instanceName: `orkestri-${id}`, phoneNumber: body.phoneNumber, conectado: false },
      update: { phoneNumber: body.phoneNumber },
    });
    return { ok: true };
  }

  @Post(":id/impersonate")
  @HttpCode(200)
  async impersonate(@Req() req: any, @Res({ passthrough: true }) res: Response, @Param("id") orgId: string) {
    this.guard(req);
    if (req.user.impersonating) throw new ForbiddenException("Saia do modo de impersonation antes de entrar em outra organização");
    const org = await (this.prisma as any).organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException("Organização não encontrada");

    const token = this.jwtService.sign(
      { sub: req.user.id, email: req.user.email, impersonating: true, targetOrgId: org.id, targetOrgName: org.nome },
      { secret: this.config.get<string>("JWT_SECRET"), expiresIn: "8h" },
    );

    const original = (req as any).cookies?.orkestri_token;
    const isSecure = req.headers["x-forwarded-proto"] === "https";
    const opts = { httpOnly: true, sameSite: "strict" as const, secure: isSecure, maxAge: 8 * 60 * 60 * 1000, path: "/" };
    if (original) res.cookie("orkestri_sa_token", original, opts);
    res.cookie("orkestri_token", token, opts);

    return { ok: true, orgName: org.nome, orgId: org.id };
  }
}

@Controller("superadmin")
@UseGuards(AuthGuard("jwt"))
class SuperAdminController {
  @Post("exit-impersonation")
  @HttpCode(200)
  exitImpersonation(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const saToken = (req as any).cookies?.orkestri_sa_token;
    if (!saToken) return { ok: true };
    const isSecure = req.headers["x-forwarded-proto"] === "https";
    const opts = { httpOnly: true, sameSite: "strict" as const, secure: isSecure, maxAge: 8 * 60 * 60 * 1000, path: "/" };
    res.cookie("orkestri_token", saToken, opts);
    res.clearCookie("orkestri_sa_token", { path: "/" });
    return { ok: true };
  }
}

// ── Org-master: manage own org's WhatsApp (non-super-admin master) ─────────────

@Controller("organizations/me/whatsapp")
@UseGuards(AuthGuard("jwt"))
class OrgWhatsAppController {
  constructor(private prisma: PrismaService, private wa: WhatsAppService) {}

  @Get("status")
  async status(@Req() req: any) {
    if (!req.user.isMaster) throw new ForbiddenException("Apenas masters");
    return this.wa.getOrgStatus(req.user.organizationId);
  }

  @Post("create-instance")
  async create(@Req() req: any) {
    if (!req.user.isMaster) throw new ForbiddenException("Apenas masters");
    const org = await (this.prisma as any).organization.findUnique({ where: { id: req.user.organizationId } });
    if (!org) throw new NotFoundException("Organização não encontrada");
    return this.wa.createOrgInstance(req.user.organizationId, org.slug);
  }

  @Get("qrcode")
  async qrcode(@Req() req: any) {
    if (!req.user.isMaster) throw new ForbiddenException("Apenas masters");
    return this.wa.getOrgQrCode(req.user.organizationId);
  }

  @Post("disconnect")
  async disconnect(@Req() req: any) {
    if (!req.user.isMaster) throw new ForbiddenException("Apenas masters");
    return this.wa.disconnectOrg(req.user.organizationId);
  }

  @Patch("phone")
  async setPhone(@Req() req: any, @Body() body: { phoneNumber: string }) {
    if (!req.user.isMaster) throw new ForbiddenException("Apenas masters");
    await (this.prisma as any).orgWhatsappConfig.upsert({
      where: { organizationId: req.user.organizationId },
      create: { organizationId: req.user.organizationId, instanceName: `orkestri-org-${req.user.organizationId}`, phoneNumber: body.phoneNumber, conectado: false },
      update: { phoneNumber: body.phoneNumber },
    });
    return { ok: true };
  }
}

// ── Demo Data Generator ───────────────────────────────────────────────────────
@Controller("superadmin/organizations")
@UseGuards(AuthGuard("jwt"))
class DemoDataController {
  constructor(private prisma: PrismaService) {}
  private guard(req: any) { if (!isSuperAdmin(req)) throw new ForbiddenException("Restrito a super-admins"); }

  @Post(":orgId/demo-data")
  async generateDemoData(@Req() req: any, @Param("orgId") orgId: string) {
    this.guard(req);
    const { v4: uuid } = await import("uuid");
    const db = this.prisma as any;

    const org = await db.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException("Organização não encontrada");

    const master = await db.user.findFirst({ where: { organizationId: orgId, isMaster: true } });
    if (!master) throw new BadRequestException("A organização precisa ter pelo menos um master.");

    const now = new Date();
    const hs = (h: number) => new Date(now.getTime() - h * 3600000);
    const ds = (d: number) => new Date(now.getTime() - d * 86400000);
    const df = (d: number) => new Date(now.getTime() + d * 86400000);

    const counts = { chamados: 0, projetos: 0, clientes: 0, ativos: 0, eventos: 0 };

    // Clientes demo
    const clientesData = [
      { id: uuid(), organizationId: orgId, nome: "Carlos Mendes", empresa: "TechSolutions Ltda", email: "carlos@techsolutions.com", telefone: "11999990001", segmento: "TI", ativo: true, criadoEm: ds(30) },
      { id: uuid(), organizationId: orgId, nome: "Ana Lima",     empresa: "Distribuidora ABC", email: "ana@abc.com.br",           telefone: "11999990002", segmento: "Distribuição", ativo: true, criadoEm: ds(25) },
      { id: uuid(), organizationId: orgId, nome: "João Pereira", empresa: "Grupo Inovação SA",  email: "joao@inovacao.com.br",      telefone: "11999990003", segmento: "Serviços", ativo: true, criadoEm: ds(20) },
    ];
    for (const c of clientesData) {
      try { await db.cliente.create({ data: c }); counts.clientes++; } catch {}
    }
    const clientes = await db.cliente.findMany({ where: { organizationId: orgId }, take: 3 });

    // Chamados demo
    const chamadosData = [
      { id: uuid(), organizationId: orgId, solicitanteId: master.id, titulo: "Computador não liga após atualização", descricao: "Após a atualização do Windows, o computador não inicializa mais. Tela preta após o boot.", status: "em_atendimento", prioridade: "alta", categoria: "Suporte Técnico", slaHoras: 8, criadoEm: hs(5), atualizadoEm: hs(3), atendenteId: master.id, clienteId: clientes[0]?.id },
      { id: uuid(), organizationId: orgId, solicitanteId: master.id, titulo: "Criar usuário no Microsoft 365",        descricao: "Precisamos criar um novo usuário para a colaboradora Maria Santos que inicia na segunda-feira.", status: "aberto", prioridade: "media", categoria: "TI", slaHoras: 24, criadoEm: hs(2), atualizadoEm: hs(2), clienteId: clientes[1]?.id },
      { id: uuid(), organizationId: orgId, solicitanteId: master.id, titulo: "Impressora HP não imprime em cores",     descricao: "A impressora HP LaserJet Pro está imprimindo apenas em preto e branco mesmo com tinta colorida.", status: "aguardando", prioridade: "baixa", categoria: "Hardware", slaHoras: 72, criadoEm: hs(48), atualizadoEm: hs(24), atendenteId: master.id },
      { id: uuid(), organizationId: orgId, solicitanteId: master.id, titulo: "Servidor de produção com alta CPU",      descricao: "O servidor de produção está com CPU acima de 95% nas últimas 2 horas. Risco de queda do serviço.", status: "em_atendimento", prioridade: "critica", categoria: "Infraestrutura", slaHoras: 2, criadoEm: hs(1), atualizadoEm: hs(0.5), atendenteId: master.id, slaResolucaoAt: df(0.08) },
      { id: uuid(), organizationId: orgId, solicitanteId: master.id, titulo: "Solicitar acesso ao sistema ERP",        descricao: "O usuário Diego Fernandes precisa de acesso ao módulo financeiro do ERP.", status: "resolvido", prioridade: "media", categoria: "Acesso", slaHoras: 24, criadoEm: ds(3), atualizadoEm: ds(2), resolvidoEm: ds(2), atendenteId: master.id, clienteId: clientes[2]?.id },
      { id: uuid(), organizationId: orgId, solicitanteId: master.id, titulo: "Backup não executou na madrugada",       descricao: "O backup automático agendado para as 02:00 não foi executado. Log de erro em anexo.", status: "fechado", prioridade: "alta", categoria: "Infraestrutura", slaHoras: 8, criadoEm: ds(7), atualizadoEm: ds(6), resolvidoEm: ds(6), fechadoEm: ds(5), atendenteId: master.id, avaliacao: 5, avaliacaoNota: "Excelente atendimento, problema resolvido rapidamente!" },
    ];
    for (const c of chamadosData) {
      try { await db.chamado.create({ data: c }); counts.chamados++; } catch {}
    }

    // Ativos demo
    const ativosData = [
      { id: uuid(), organizationId: orgId, codigo: "NB-DEMO-001", nome: "Notebook Dell Latitude 5540", tipo: "Computadores", status: "ativo", responsavelId: master.id, valorCompra: 4200, dataCompra: ds(365), dataGarantiaFim: df(365), numeroSerie: "DL5540DEMO001", criadoEm: ds(365) },
      { id: uuid(), organizationId: orgId, codigo: "SV-DEMO-001", nome: "Servidor Dell PowerEdge R750", tipo: "Hardware", status: "ativo", responsavelId: master.id, valorCompra: 45000, dataCompra: ds(180), dataGarantiaFim: df(900), numeroSerie: "DVPR750DEMO", criadoEm: ds(180) },
      { id: uuid(), organizationId: orgId, codigo: "PR-DEMO-001", nome: "Impressora HP LaserJet Pro", tipo: "Periféricos", status: "em_manutencao", responsavelId: master.id, valorCompra: 1800, dataCompra: ds(730), dataGarantiaFim: ds(5), criadoEm: ds(730) },
    ];
    for (const a of ativosData) {
      try { await db.ativo.create({ data: a }); counts.ativos++; } catch {}
    }

    // Projeto demo
    try {
      const proj = await db.project.create({ data: { id: uuid(), organizationId: orgId, nome: "Migração para Cloud AWS", descricao: "Migração da infraestrutura on-premise para AWS", status: "EM_ANDAMENTO", prioridade: "ALTA", criadoPorId: master.id, prazo: df(90), criadoEm: ds(15), atualizadoEm: ds(1) } });
      const cols = ["A Fazer","Em Andamento","Em Revisão","Concluída","Cancelada"];
      for (let i = 0; i < cols.length; i++) {
        await db.projectColumn.create({ data: { id: uuid(), projectId: proj.id, nome: cols[i], ordem: i, cor: ["#94a3b8","#3b82f6","#f59e0b","#22c55e","#ef4444"][i] } });
      }
      counts.projetos++;
    } catch {}

    // Evento demo
    try {
      await db.event.create({ data: { id: uuid(), organizationId: orgId, userId: master.id, titulo: "Daily Standup — Equipe TI", descricao: "Reunião diária de alinhamento", inicio: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0), fim: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 30), tipo: "REUNIAO", cor: "#a78bfa", recorrencia: "SEMANAL", criadoEm: ds(7) } });
      counts.eventos++;
    } catch {}

    return { ok: true, gerado: counts, mensagem: `Dados demo criados com sucesso para ${org.nome}` };
  }
}

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: config.get("JWT_SECRET"), signOptions: { expiresIn: "8h" } }),
    }),
  ],
  controllers: [SuperAdminOrgsController, SuperAdminController, OrgWhatsAppController, DemoDataController],
  providers: [WhatsAppService, EmailService],
})
export class OrganizationsModule {}
