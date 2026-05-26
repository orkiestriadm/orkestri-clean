import {
  Module, Controller, Get, Post, Body, Param,
  UseGuards, Req, ForbiddenException, NotFoundException,
  BadRequestException, HttpCode, HttpStatus, Logger,
} from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { ScheduleModule, Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Resend } from 'resend';

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
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

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
      const body: Record<string, unknown> = {
        reason: `Orkiestri ${plan.nome}`,
        payer_email: masterEmail,
        back_url: `${appUrl}/dashboard/billing/me`,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: plan.valor,
          currency_id: 'BRL',
        },
        status: 'pending',
      };
      if (mpPlanId) body.preapproval_plan_id = mpPlanId;

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
        trialEndsAt: org.billing?.trialEndsAt || new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
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

// ─── Module ──────────────────────────────────────────────────────────────────

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [BillingController, BillingWebhookController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
