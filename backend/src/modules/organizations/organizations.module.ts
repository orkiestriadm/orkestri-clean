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
}
class UpdateOrgDto {
  @IsOptional() @IsString() nome?: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() plano?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
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
  return req.user?.isMaster === true;
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
    const org = await (this.prisma as any).organization.create({
      data: { nome: dto.nome, slug: dto.slug, plano: dto.plano || "starter" },
    });
    return org;
  }

  @Put(":id")
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

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: config.get("JWT_SECRET"), signOptions: { expiresIn: "8h" } }),
    }),
  ],
  controllers: [SuperAdminOrgsController, SuperAdminController, OrgWhatsAppController],
  providers: [WhatsAppService, EmailService],
})
export class OrganizationsModule {}
