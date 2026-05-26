import {
  Module, Controller, Get, Post, Body, Param,
  UseGuards, Req, ForbiddenException, NotFoundException,
  BadRequestException, HttpCode, HttpStatus, Logger,
  ConflictException, UsePipes, ValidationPipe,
} from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { ScheduleModule, Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Resend } from 'resend';
import * as bcrypt from 'bcryptjs';
import { IsString, IsEmail, IsOptional, MinLength, IsIn } from 'class-validator';

// ─── Planos ──────────────────────────────────────────────────────────────────

export const PLANS: Record<string, {
  nome: string;
  valor: number | null;
  maxAdmins: number | null;
  maxUsers: number | null;
  features: string[];
}> = {
  business_cloud: {
    nome: 'Business Cloud',
    valor: 99.90,
    maxAdmins: 1,
    maxUsers: 5,
    features: ['Service Desk', 'Projetos', 'Agenda', 'CRM básico', 'Relatórios'],
  },
  business_plus: {
    nome: 'Business Plus',
    valor: 199.90,
    maxAdmins: 2,
    maxUsers: 10,
    features: ['Tudo do Business Cloud', 'Workforce', 'Squads', 'SLA avançado', 'Automações', 'WhatsApp'],
  },
  enterprise: {
    nome: 'Enterprise',
    valor: null,
    maxAdmins: null,
    maxUsers: null,
    features: ['Tudo + Customizável', 'SSO/SAML', 'API dedicada', 'SLA garantido', 'Suporte prioritário'],
  },
};

// ─── DTOs ────────────────────────────────────────────────────────────────────

class AssignPlanDto {
  plano: string;
  masterEmail?: string;
}

class OverrideStatusDto {
  status: string;
  nota?: string;
}

class ExtendTrialDto {
  dias: number;
}

class PublicSignupDto {
  @IsIn(['business_cloud', 'business_plus'])
  plano: string;

  @IsString()
  orgNome: string;

  @IsOptional()
  @IsString()
  orgSlug?: string;

  @IsString()
  adminNome: string;

  @IsEmail()
  adminEmail: string;

  @IsString()
  @MinLength(8)
  adminSenha: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  private getMpClient() {
    const accessToken = this.config.get<string>('MP_ACCESS_TOKEN');
    if (!accessToken) throw new BadRequestException('MP_ACCESS_TOKEN não configurado.');
    return accessToken;
  }

  private getResend() {
    const key = this.config.get<string>('RESEND_API_KEY');
    return key ? new Resend(key) : null;
  }

  private async sendEmail(to: string, subject: string, html: string) {
    const resend = this.getResend();
    if (!resend) return false;
    try {
      const from = this.config.get<string>('EMAIL_FROM', 'noreply@orkiestri.com');
      await resend.emails.send({ from, to, subject, html });
      return true;
    } catch (e) {
      this.logger.warn(`Falha ao enviar email para ${to}: ${e.message}`);
      return false;
    }
  }

  // ── Consultas ─────────────────────────────────────────────────────────────

  async listAll() {
    const billings = await this.prisma.orgBilling.findMany({
      include: {
        organization: { select: { id: true, nome: true, slug: true, ativo: true } },
        payments: { orderBy: { criadoEm: 'desc' }, take: 3 },
      },
      orderBy: { criadoEm: 'desc' },
    });

    // Calcula MRR
    const mrr = billings
      .filter(b => b.status === 'active' || b.status === 'enterprise_manual')
      .reduce((sum, b) => sum + (b.valorMensal || 0), 0);

    const stats = {
      total: billings.length,
      trial: billings.filter(b => b.status === 'trial').length,
      active: billings.filter(b => b.status === 'active' || b.status === 'enterprise_manual').length,
      overdue: billings.filter(b => b.status === 'overdue').length,
      suspended: billings.filter(b => b.status === 'suspended').length,
      cancelled: billings.filter(b => b.status === 'cancelled').length,
      mrr: Math.round(mrr * 100) / 100,
    };

    return { stats, billings };
  }

  async getByOrg(orgId: string) {
    const billing = await this.prisma.orgBilling.findUnique({
      where: { organizationId: orgId },
      include: {
        organization: { select: { id: true, nome: true, slug: true } },
        payments: { orderBy: { criadoEm: 'desc' } },
      },
    });
    if (!billing) throw new NotFoundException('Billing não encontrado para esta organização.');
    return billing;
  }

  async getBillingMe(organizationId: string) {
    let billing = await this.prisma.orgBilling.findUnique({
      where: { organizationId },
      include: { payments: { orderBy: { criadoEm: 'desc' }, take: 10 } },
    });
    if (!billing) {
      // Cria automaticamente se não existir (orgs antigas)
      await this.ensureBilling(organizationId);
      billing = await this.prisma.orgBilling.findUnique({
        where: { organizationId },
        include: { payments: { orderBy: { criadoEm: 'desc' }, take: 10 } },
      });
      if (!billing) throw new NotFoundException('Erro ao inicializar billing.');
    }
    const plan = PLANS[billing.plano] || PLANS.business_cloud;
    return { ...billing, planInfo: plan };
  }

  async getCheckoutMe(organizationId: string) {
    const billing = await this.prisma.orgBilling.findUnique({ where: { organizationId } });
    if (!billing) throw new NotFoundException('Billing não encontrado.');
    if (!billing.mpCheckoutUrl) throw new BadRequestException('Nenhum link de pagamento disponível. Contate o suporte.');
    return { checkoutUrl: billing.mpCheckoutUrl };
  }

  // ── Provisionamento ───────────────────────────────────────────────────────

  async ensureBilling(organizationId: string, plano = 'business_cloud') {
    const existing = await this.prisma.orgBilling.findUnique({ where: { organizationId } });
    if (existing) return existing;

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 7);

    return this.prisma.orgBilling.create({
      data: {
        organizationId,
        plano,
        status: 'trial',
        trialEndsAt,
        valorMensal: PLANS[plano]?.valor || null,
      },
    });
  }

  // ── Ações SA ──────────────────────────────────────────────────────────────

  async assignPlan(orgId: string, dto: AssignPlanDto, saId: string) {
    if (!PLANS[dto.plano]) throw new BadRequestException('Plano inválido.');

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        users: { where: { ativo: true }, orderBy: { criadoEm: 'asc' }, take: 1 },
        billing: true,
      },
    });
    if (!org) throw new NotFoundException('Organização não encontrada.');

    const plan = PLANS[dto.plano];

    // Enterprise → override manual direto
    if (dto.plano === 'enterprise') {
      const billing = await this.prisma.orgBilling.upsert({
        where: { organizationId: orgId },
        create: {
          organizationId: orgId,
          plano: 'enterprise',
          status: 'enterprise_manual',
          valorMensal: null,
          overrideStatusBySaId: saId,
          overrideNota: 'Plano Enterprise atribuído manualmente.',
        },
        update: {
          plano: 'enterprise',
          status: 'enterprise_manual',
          overrideStatusBySaId: saId,
          overrideNota: 'Plano Enterprise atribuído manualmente.',
        },
      });
      return { billing, checkoutUrl: null, message: 'Plano Enterprise atribuído. Status definido como enterprise_manual.' };
    }

    // Planos pagos → criar preapproval no Mercado Pago
    const masterEmail = dto.masterEmail || org.users[0]?.email;
    if (!masterEmail) throw new BadRequestException('Email do master não encontrado. Informe masterEmail.');

    const mpPlanId = this.config.get<string>(`MP_PLAN_${dto.plano.toUpperCase()}`);
    const accessToken = this.getMpClient();
    const appUrl = this.config.get<string>('APP_URL', 'https://orkiestri.com');

    let preapprovalId: string | null = null;
    let checkoutUrl: string | null = null;

    try {
      // Quando usa plan_id (recomendado): não enviar auto_recurring — o plano já o define.
      // Sem plan_id (fallback): enviar auto_recurring inline.
      const body: Record<string, unknown> = {
        reason: `Orkiestri ${plan.nome}`,
        payer_email: masterEmail,
        back_url: `${appUrl}/dashboard/billing/me`,
        status: 'pending',
      };
      if (mpPlanId) {
        body.preapproval_plan_id = mpPlanId;
      } else {
        body.auto_recurring = {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: plan.valor,
          currency_id: 'BRL',
        };
      }

      const response = await fetch('https://api.mercadopago.com/preapproval', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.text();
        this.logger.error(`MP PreApproval error: ${err}`);
        throw new BadRequestException('Erro ao criar assinatura no Mercado Pago. Verifique as configurações.');
      }

      const data = await response.json() as { id: string; init_point: string };
      preapprovalId = data.id;
      checkoutUrl = data.init_point;
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      this.logger.error(`MP error: ${e.message}`);
      // Continua sem MP (fallback — billing fica pendente)
    }

    const now = new Date();
    const billing = await this.prisma.orgBilling.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        plano: dto.plano,
        status: 'trial', // Continua em trial até MP confirmar pagamento
        valorMensal: plan.valor,
        mpPreapprovalId: preapprovalId,
        mpPayerEmail: masterEmail,
        mpCheckoutUrl: checkoutUrl,
        trialEndsAt: org.billing?.trialEndsAt || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      },
      update: {
        plano: dto.plano,
        valorMensal: plan.valor,
        mpPreapprovalId: preapprovalId,
        mpPayerEmail: masterEmail,
        mpCheckoutUrl: checkoutUrl,
      },
    });

    // Envia email com link de pagamento
    if (checkoutUrl && masterEmail) {
      await this.sendEmail(
        masterEmail,
        `Sua assinatura Orkiestri ${plan.nome} está pronta`,
        `
        <h2>Orkiestri — Ativar Assinatura</h2>
        <p>Olá! Sua organização foi migrada para o plano <strong>${plan.nome}</strong>.</p>
        <p>Para ativar, complete o pagamento clicando no botão abaixo:</p>
        <p><a href="${checkoutUrl}" style="background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">Pagar Agora (R$ ${plan.valor?.toFixed(2)}/mês)</a></p>
        <p>Após o pagamento, seu acesso será ativado automaticamente.</p>
        <p>Dúvidas? Responda este e-mail.</p>
        `,
      );
    }

    return { billing, checkoutUrl, message: checkoutUrl ? 'Link de pagamento gerado e enviado por e-mail.' : 'Plano atribuído. Configure MP_ACCESS_TOKEN para gerar link de pagamento.' };
  }

  async overrideStatus(orgId: string, dto: OverrideStatusDto, saId: string) {
    const allowed = ['trial', 'active', 'overdue', 'suspended', 'cancelled', 'enterprise_manual'];
    if (!allowed.includes(dto.status)) throw new BadRequestException('Status inválido.');

    const billing = await this.prisma.orgBilling.findUnique({ where: { organizationId: orgId } });
    if (!billing) throw new NotFoundException('Billing não encontrado.');

    return this.prisma.orgBilling.update({
      where: { organizationId: orgId },
      data: {
        status: dto.status,
        overrideStatusBySaId: saId,
        overrideNota: dto.nota || `Override manual para ${dto.status}`,
      },
    });
  }

  async extendTrial(orgId: string, dto: ExtendTrialDto, saId: string) {
    if (!dto.dias || dto.dias < 1 || dto.dias > 365) throw new BadRequestException('Dias inválidos (1-365).');

    const billing = await this.prisma.orgBilling.findUnique({ where: { organizationId: orgId } });
    if (!billing) throw new NotFoundException('Billing não encontrado.');

    const base = billing.trialEndsAt && billing.trialEndsAt > new Date() ? billing.trialEndsAt : new Date();
    const trialEndsAt = new Date(base);
    trialEndsAt.setDate(trialEndsAt.getDate() + dto.dias);

    return this.prisma.orgBilling.update({
      where: { organizationId: orgId },
      data: {
        trialEndsAt,
        status: billing.status === 'suspended' || billing.status === 'cancelled' ? 'trial' : billing.status,
        overrideStatusBySaId: saId,
        overrideNota: `Trial estendido ${dto.dias} dias por SA.`,
      },
    });
  }

  async cancelSubscription(orgId: string, saId: string) {
    const billing = await this.prisma.orgBilling.findUnique({ where: { organizationId: orgId } });
    if (!billing) throw new NotFoundException('Billing não encontrado.');

    // Cancela no MP se tiver preapproval
    if (billing.mpPreapprovalId) {
      const accessToken = this.config.get<string>('MP_ACCESS_TOKEN');
      if (accessToken) {
        try {
          await fetch(`https://api.mercadopago.com/preapproval/${billing.mpPreapprovalId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'cancelled' }),
          });
        } catch (e) {
          this.logger.warn(`Falha ao cancelar MP preapproval: ${e.message}`);
        }
      }
    }

    return this.prisma.orgBilling.update({
      where: { organizationId: orgId },
      data: {
        status: 'cancelled',
        overrideStatusBySaId: saId,
        overrideNota: 'Cancelado manualmente pelo SA.',
      },
    });
  }

  // ── Auto-signup público (landing page → MP → provisionamento) ─────────────

  async initiateSignup(dto: PublicSignupDto) {
    const ALLOWED_PLANS = ['business_cloud', 'business_plus'];
    if (!ALLOWED_PLANS.includes(dto.plano)) {
      throw new BadRequestException('Plano inválido. Para Enterprise, entre em contato.');
    }

    // Normaliza slug
    const slug = (dto.orgSlug || dto.orgNome)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);

    // Verifica duplicidade de e-mail em sessões pendentes (anti-spam)
    const existing = await (this.prisma as any).billingSignupSession.findFirst({
      where: { payerEmail: dto.adminEmail, status: { in: ['pending', 'redirected'] } },
    });
    if (existing) {
      throw new ConflictException('Já existe uma sessão de cadastro em andamento para este e-mail. Verifique sua caixa de entrada ou aguarde alguns minutos.');
    }

    // Verifica se e-mail já está em uso em alguma org
    const emailInUse = await this.prisma.user.findFirst({ where: { email: dto.adminEmail } });
    if (emailInUse) {
      throw new ConflictException('Este e-mail já está associado a uma conta. Faça login ou use outro e-mail.');
    }

    const plan = PLANS[dto.plano];
    const adminSenhaHash = await bcrypt.hash(dto.adminSenha, 12);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    // Tenta criar preapproval no MP (se configurado)
    let mpPreapprovalId: string | null = null;
    let mpCheckoutUrl: string | null = null;

    const accessToken = this.config.get<string>('MP_ACCESS_TOKEN');
    const appUrl = this.config.get<string>('APP_URL') || 'https://www.orkiestri.com';

    // Criamos a sessão primeiro para obter o token
    const session = await (this.prisma as any).billingSignupSession.create({
      data: {
        plano: dto.plano,
        payerEmail: dto.adminEmail,
        orgNome: dto.orgNome,
        orgSlug: slug,
        adminNome: dto.adminNome,
        adminSenhaHash,
        status: 'pending',
        expiresAt,
      },
    });

    if (accessToken) {
      try {
        // Usa sempre auto_recurring inline no signup — garante que MP retorna
        // init_point (redirect checkout) independente de como os planos foram configurados.
        const body: Record<string, unknown> = {
          reason: `Orkiestri ${plan.nome} — ${dto.orgNome}`,
          payer_email: dto.adminEmail,
          back_url: `${appUrl}/signup/success?token=${session.token}`,
          status: 'pending',
          auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: plan.valor,
            currency_id: 'BRL',
          },
        };

        const res = await fetch('https://api.mercadopago.com/preapproval', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const data = await res.json() as { id: string; init_point: string };
          mpPreapprovalId = data.id;
          mpCheckoutUrl = data.init_point;
        } else {
          const err = await res.text();
          this.logger.warn(`MP preapproval signup falhou: ${err}`);
        }
      } catch (e: any) {
        this.logger.warn(`Erro ao criar preapproval signup: ${e.message}`);
      }
    }

    // Atualiza sessão com dados do MP
    await (this.prisma as any).billingSignupSession.update({
      where: { id: session.id },
      data: {
        mpPreapprovalId,
        mpCheckoutUrl,
        status: mpCheckoutUrl ? 'redirected' : 'pending',
      },
    });

    if (!mpCheckoutUrl) {
      // MP não configurado: provisiona direto em trial
      this.logger.warn(`MP não configurado — provisionando signup em trial para ${dto.adminEmail}`);
      await this.provisionSignupSession({ ...session, mpPreapprovalId, mpCheckoutUrl });
      return {
        token: session.token,
        checkoutUrl: null,
        status: 'completed',
        message: 'Conta criada em modo trial. Verifique seu e-mail.',
      };
    }

    return {
      token: session.token,
      checkoutUrl: mpCheckoutUrl,
      status: 'redirected',
    };
  }

  async getSignupStatus(token: string) {
    const session = await (this.prisma as any).billingSignupSession.findUnique({
      where: { token },
      select: { status: true, plano: true, orgSlug: true, organizationId: true, expiresAt: true },
    });
    if (!session) throw new NotFoundException('Sessão não encontrada.');

    if (session.status !== 'completed' && session.status !== 'failed' && new Date() > new Date(session.expiresAt)) {
      await (this.prisma as any).billingSignupSession.update({ where: { token }, data: { status: 'expired' } });
      return { status: 'expired', plano: session.plano };
    }

    return {
      status: session.status,
      plano: session.plano,
      orgSlug: session.status === 'completed' ? session.orgSlug : undefined,
    };
  }

  private async provisionSignupSession(session: {
    id: string; token: string; plano: string; payerEmail: string;
    orgNome: string; orgSlug: string; adminNome: string; adminSenhaHash: string;
    mpPreapprovalId: string | null; mpCheckoutUrl: string | null;
  }) {
    // Garante slug único
    let slug = session.orgSlug;
    const slugExiste = await this.prisma.organization.findUnique({ where: { slug } });
    if (slugExiste) slug = `${slug}-${Date.now()}`;

    // Cria organização
    const org = await this.prisma.organization.create({
      data: {
        nome: session.orgNome,
        slug,
        plano: session.plano,
        ativo: true,
        statusOperacional: 'ativo',
        statusComercial: 'ativo',
        modulosAtivos: [],
      },
    });

    // Cria usuário master com a senha que o usuário escolheu
    const user = await this.prisma.user.create({
      data: {
        organizationId: org.id,
        nome: session.adminNome,
        email: session.payerEmail,
        senhaHash: session.adminSenhaHash,
        ativo: true,
        primeiroAcesso: false, // usuário já definiu a senha
      },
    });

    // Atribui role master
    const masterRole = await this.prisma.role.findFirst({ where: { isMaster: true } });
    if (masterRole) {
      await this.prisma.userRole.create({
        data: { userId: user.id, roleId: masterRole.id, atribuidoPorId: user.id },
      });
    }

    // Cria UserProfile
    await this.prisma.userProfile.create({
      data: {
        userId: user.id,
        modulos: JSON.stringify(['projetos', 'keep', 'gantt', 'relatorios', 'chamados', 'clientes', 'contratos']),
      },
    });

    // Cria OrgBilling — já ativo se veio do MP, trial se não veio
    const hasMpPayment = !!session.mpPreapprovalId;
    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

    await this.prisma.orgBilling.create({
      data: {
        organizationId: org.id,
        plano: session.plano,
        status: hasMpPayment ? 'active' : 'trial',
        trialEndsAt: hasMpPayment ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        valorMensal: PLANS[session.plano]?.valor || null,
        mpPreapprovalId: session.mpPreapprovalId || null,
        mpPayerEmail: session.payerEmail,
        mpCheckoutUrl: session.mpCheckoutUrl || null,
        currentPeriodStart: hasMpPayment ? new Date() : null,
        currentPeriodEnd: hasMpPayment ? nextBillingDate : null,
        nextBillingDate: hasMpPayment ? nextBillingDate : null,
      },
    });

    // Atualiza sessão como concluída
    await (this.prisma as any).billingSignupSession.update({
      where: { id: session.id },
      data: { status: 'completed', organizationId: org.id },
    });

    // E-mail de boas-vindas
    await this.sendEmail(
      session.payerEmail,
      `🎉 Bem-vindo ao Orkiestri, ${session.adminNome.split(' ')[0]}!`,
      `
      <h2>Sua conta está pronta!</h2>
      <p>Olá, <strong>${session.adminNome}</strong>! Sua organização <strong>${org.nome}</strong> foi criada com sucesso no plano <strong>${PLANS[session.plano]?.nome || session.plano}</strong>.</p>
      <p>Acesse agora com suas credenciais:</p>
      <ul>
        <li><strong>URL:</strong> <a href="${this.config.get('APP_URL') || 'https://app.orkiestri.com'}/login">app.orkiestri.com/login</a></li>
        <li><strong>E-mail:</strong> ${session.payerEmail}</li>
        <li><strong>Senha:</strong> a que você escolheu no cadastro</li>
      </ul>
      <p><a href="${this.config.get('APP_URL') || 'https://app.orkiestri.com'}/login" style="background:#7c3aed;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">Acessar o Sistema</a></p>
      <p style="color:#888;font-size:12px">Dúvidas? Responda este e-mail ou acesse nossa central de ajuda.</p>
      `,
    ).catch(() => {});

    this.logger.log(`Signup provisionado: org=${org.id} user=${user.email} plano=${session.plano}`);
    return { org, user };
  }

  // ── Webhook Mercado Pago ──────────────────────────────────────────────────

  async processWebhook(body: Record<string, unknown>, xSignature?: string) {
    const type = body.type as string;
    const dataId = (body.data as { id: string })?.id;

    if (!type || !dataId) {
      this.logger.warn('Webhook MP: body inválido');
      return { received: true };
    }

    this.logger.log(`Webhook MP: type=${type} id=${dataId}`);

    const accessToken = this.config.get<string>('MP_ACCESS_TOKEN');
    if (!accessToken) return { received: true };

    try {
      if (type === 'subscription_preapproval') {
        await this.handlePreapprovalEvent(dataId, accessToken);
      } else if (type === 'payment') {
        await this.handlePaymentEvent(dataId, accessToken);
      }
    } catch (e) {
      this.logger.error(`Erro ao processar webhook MP: ${e.message}`);
    }

    return { received: true };
  }

  private async handlePreapprovalEvent(preapprovalId: string, accessToken: string) {
    const res = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!res.ok) return;
    const data = await res.json() as { status: string; next_payment_date?: string; last_charged_date?: string };

    // ── Verifica se é uma sessão de signup (novo cliente) ──────────────────
    const signupSession = await (this.prisma as any).billingSignupSession.findFirst({
      where: { mpPreapprovalId: preapprovalId, status: { in: ['pending', 'redirected', 'paid'] } },
    });
    if (signupSession && data.status === 'authorized') {
      try {
        await this.provisionSignupSession(signupSession);
      } catch (e: any) {
        this.logger.error(`Erro ao provisionar signup session ${signupSession.id}: ${e.message}`);
        await (this.prisma as any).billingSignupSession.update({
          where: { id: signupSession.id },
          data: { status: 'failed' },
        }).catch(() => {});
      }
      return;
    }

    // ── Org existente: atualiza billing normalmente ────────────────────────
    const billing = await this.prisma.orgBilling.findFirst({
      where: { mpPreapprovalId: preapprovalId },
    });
    if (!billing) {
      this.logger.warn(`Billing não encontrado para preapprovalId=${preapprovalId}`);
      return;
    }

    const statusMap: Record<string, string> = {
      authorized: 'active',
      paused: 'overdue',
      cancelled: 'cancelled',
      pending: 'trial',
    };
    const newStatus = statusMap[data.status] || billing.status;

    const update: Record<string, unknown> = { status: newStatus };
    if (data.next_payment_date) update.nextBillingDate = new Date(data.next_payment_date);

    await this.prisma.orgBilling.update({ where: { id: billing.id }, data: update });
    this.logger.log(`Billing org=${billing.organizationId} → status=${newStatus}`);
  }

  private async handlePaymentEvent(paymentId: string, accessToken: string) {
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!res.ok) return;
    const payment = await res.json() as {
      status: string; transaction_amount: number; payment_method_id: string;
      date_approved?: string; date_of_expiration?: string;
      metadata?: { preapproval_id?: string; org_billing_id?: string };
      preapproval_id?: string;
    };

    // Tenta achar o billing pelo preapproval_id do pagamento
    const preapprovalId = payment.preapproval_id || payment.metadata?.preapproval_id;
    if (!preapprovalId) return;

    const billing = await this.prisma.orgBilling.findFirst({
      where: { mpPreapprovalId: preapprovalId },
    });
    if (!billing) return;

    const paymentStatusMap: Record<string, string> = {
      approved: 'approved',
      rejected: 'rejected',
      refunded: 'refunded',
      cancelled: 'cancelled',
      pending: 'pending',
      in_process: 'pending',
    };

    // Registra pagamento
    await this.prisma.billingPayment.create({
      data: {
        orgBillingId: billing.id,
        mpPaymentId: paymentId,
        valor: payment.transaction_amount || 0,
        status: paymentStatusMap[payment.status] || payment.status,
        metodo: payment.payment_method_id || null,
        dataPagamento: payment.status === 'approved' && payment.date_approved ? new Date(payment.date_approved) : null,
        referencia: new Date().toISOString().slice(0, 7), // YYYY-MM
      },
    });

    // Atualiza status do billing
    if (payment.status === 'approved') {
      const nextBillingDate = new Date();
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

      await this.prisma.orgBilling.update({
        where: { id: billing.id },
        data: {
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: nextBillingDate,
          nextBillingDate,
        },
      });
      this.logger.log(`Pagamento aprovado — org=${billing.organizationId} → status=active`);
    } else if (payment.status === 'rejected') {
      await this.prisma.orgBilling.update({
        where: { id: billing.id },
        data: { status: 'overdue' },
      });
      this.logger.log(`Pagamento rejeitado — org=${billing.organizationId} → status=overdue`);
    }
  }

  // ── Cron: verificação diária ──────────────────────────────────────────────

  @Cron('0 8 * * *') // 08:00 UTC todo dia
  async checkBillingStatus() {
    this.logger.log('Cron billing: verificando trials e inadimplentes...');
    const now = new Date();

    // 1. Trials expirados → suspended
    const expiredTrials = await this.prisma.orgBilling.findMany({
      where: { status: 'trial', trialEndsAt: { lt: now } },
      include: { organization: { select: { nome: true } } },
    });
    for (const b of expiredTrials) {
      await this.prisma.orgBilling.update({ where: { id: b.id }, data: { status: 'suspended' } });
      this.logger.log(`Trial expirado → suspenso: org=${b.organizationId}`);
    }

    // 2. Overdue há > 7 dias → suspended
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const overdueOld = await this.prisma.orgBilling.findMany({
      where: { status: 'overdue', atualizadoEm: { lt: sevenDaysAgo } },
    });
    for (const b of overdueOld) {
      await this.prisma.orgBilling.update({ where: { id: b.id }, data: { status: 'suspended' } });
      this.logger.log(`Overdue > 7d → suspenso: org=${b.organizationId}`);
    }

    // 3. Avisos de trial expirando: 7, 3, 1 dia
    const warningDays = [7, 3, 1];
    for (const days of warningDays) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + days);
      const startOfDay = new Date(targetDate); startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate); endOfDay.setHours(23, 59, 59, 999);

      const expiringSoon = await this.prisma.orgBilling.findMany({
        where: { status: 'trial', trialEndsAt: { gte: startOfDay, lte: endOfDay } },
        include: {
          organization: {
            select: { nome: true, users: { where: { ativo: true }, orderBy: { criadoEm: 'asc' }, take: 1, select: { email: true } } },
          },
        },
      });

      for (const b of expiringSoon) {
        const masterEmail = b.organization?.users?.[0]?.email;
        if (!masterEmail) continue;
        const orgNome = b.organization?.nome || 'sua organização';
        await this.sendEmail(
          masterEmail,
          `⚠️ Trial Orkiestri expira em ${days} dia${days > 1 ? 's' : ''}`,
          `
          <h2>Seu trial está expirando!</h2>
          <p>O período de trial de <strong>${orgNome}</strong> expira em <strong>${days} dia${days > 1 ? 's' : ''}</strong>.</p>
          ${b.mpCheckoutUrl ? `<p><a href="${b.mpCheckoutUrl}" style="background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">Ativar Assinatura Agora</a></p>` : '<p>Entre em contato com o suporte para ativar sua assinatura.</p>'}
          <p>Após o vencimento, o acesso será suspenso automaticamente.</p>
          `,
        );
      }
    }

    this.logger.log(`Cron billing: ${expiredTrials.length} trials suspensos, ${overdueOld.length} overdues suspensos.`);
  }
}

// ─── Controllers ─────────────────────────────────────────────────────────────

// Guard helper
function requireSuperAdmin(req: any) {
  if (!req.user?.isSuperAdmin) throw new ForbiddenException('Acesso restrito a super-admins.');
}

@Controller('billing')
@UseGuards(AuthGuard('jwt'))
export class BillingController {
  constructor(private billing: BillingService) {}

  // ── SA: listagem global ───────────────────────────────────────────────────

  @Get()
  async listAll(@Req() req: any) {
    requireSuperAdmin(req);
    return this.billing.listAll();
  }

  @Get(':orgId')
  async getByOrg(@Req() req: any, @Param('orgId') orgId: string) {
    requireSuperAdmin(req);
    return this.billing.getByOrg(orgId);
  }

  // ── SA: ações ─────────────────────────────────────────────────────────────

  @Post(':orgId/assign-plan')
  async assignPlan(@Req() req: any, @Param('orgId') orgId: string, @Body() dto: AssignPlanDto) {
    requireSuperAdmin(req);
    return this.billing.assignPlan(orgId, dto, req.user.id);
  }

  @Post(':orgId/override-status')
  async overrideStatus(@Req() req: any, @Param('orgId') orgId: string, @Body() dto: OverrideStatusDto) {
    requireSuperAdmin(req);
    return this.billing.overrideStatus(orgId, dto, req.user.id);
  }

  @Post(':orgId/extend-trial')
  async extendTrial(@Req() req: any, @Param('orgId') orgId: string, @Body() dto: ExtendTrialDto) {
    requireSuperAdmin(req);
    return this.billing.extendTrial(orgId, dto, req.user.id);
  }

  @Post(':orgId/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelSubscription(@Req() req: any, @Param('orgId') orgId: string) {
    requireSuperAdmin(req);
    return this.billing.cancelSubscription(orgId, req.user.id);
  }

  // ── Master da própria org ─────────────────────────────────────────────────

  @Get('me/summary')
  async billingMe(@Req() req: any) {
    if (!req.user?.organizationId) throw new ForbiddenException('Sem organização associada.');
    return this.billing.getBillingMe(req.user.organizationId);
  }

  @Get('me/checkout')
  async checkoutMe(@Req() req: any) {
    if (!req.user?.organizationId) throw new ForbiddenException('Sem organização associada.');
    return this.billing.getCheckoutMe(req.user.organizationId);
  }
}

// Webhook (sem guard JWT — público, verificado por assinatura MP)
@Controller('billing/webhook')
export class BillingWebhookController {
  constructor(private billing: BillingService) {}

  @Post('mp')
  @HttpCode(HttpStatus.OK)
  async mercadopago(@Req() req: any, @Body() body: Record<string, unknown>) {
    const xSignature = req.headers['x-signature'];
    return this.billing.processWebhook(body, xSignature);
  }
}

// Endpoints públicos de auto-signup (sem JWT)
@Controller('billing/public')
export class BillingPublicController {
  constructor(private billing: BillingService) {}

  /** Inicia o fluxo: recebe dados do formulário, cria sessão + preapproval no MP */
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() dto: PublicSignupDto) {
    return this.billing.initiateSignup(dto);
  }

  /** Polling de status — frontend chama após redirect do MP */
  @Get('status/:token')
  async status(@Param('token') token: string) {
    return this.billing.getSignupStatus(token);
  }
}

// ─── Module ──────────────────────────────────────────────────────────────────

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [BillingController, BillingWebhookController, BillingPublicController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
