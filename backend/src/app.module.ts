import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { HealthModule } from "./modules/health/health.module";
import { StatsModule } from "./modules/stats/stats.module";
import { AgendaModule } from "./modules/agenda/agenda.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { KeepModule } from "./modules/keep/keep.module";
import { SetoresModule } from "./modules/setores/setores.module";
import { AuditModule } from "./modules/audit/audit.module";
import { StatusModule } from "./modules/users/status.module";
import { CommentsModule } from "./modules/projects/comments.module";
import { SistemaModule } from "./modules/sistema/sistema.module";
import { TwoFAModule } from "./modules/auth/twofa.module";
import { UserWhatsAppModule } from "./modules/users/whatsapp.module";
import { RbacModule } from "./modules/rbac/rbac.module";
import { CacheModule } from "./modules/cache/cache.module";
import { OrcamentoModule } from "./modules/orcamento/orcamento.module";
import { AlertasModule } from "./modules/alertas/alertas.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
import { CadastroRequestModule } from './modules/cadastro-request/cadastro-request.module';
import { BillingModule } from './modules/billing/billing.module';
import { FinanceiroModule } from './modules/financeiro/financeiro.module';
import { GastosModule } from './modules/gastos/gastos.module';
import { IntegracoesModule } from './modules/integracoes/integracoes.module';
import { WhatsappInboundModule } from './modules/agenda/whatsapp-inbound.module';
import { ReferralModule } from './modules/referral/referral.module';
import { JwtModule } from '@nestjs/jwt';

/**
 * Escopo do Orkiestri a partir de 18/10/2026.
 *
 * O sistema foi reduzido aos produtos que são o seu propósito — Space,
 * Projects, Finance (com Budget dentro dele) — mais as integrações de
 * WhatsApp e Resend e o núcleo que organiza a plataforma (Core, Organizações,
 * Saúde da Plataforma). Os 27 módulos removidos (People, Fleet, Compliance,
 * Strategy, Service, Assets, Relations, Supply, Quality, Approvals e o portal
 * do cliente) continuam vivos na linha do Hub Transbrasiliana, em outra
 * branch: por isso esta branch NUNCA pode ser mesclada em `hub/*`.
 *
 * As tabelas desses módulos seguem no banco, paradas e sem uso — a limpeza do
 * schema é uma etapa própria, com migration destrutiva e janela de deploy.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule,
    PrismaModule, HealthModule, AuthModule, UsersModule,
    StatsModule, AgendaModule, NotificationsModule, WhatsappInboundModule, ReferralModule,
    ProjectsModule, KeepModule, SetoresModule,
    AuditModule, StatusModule, CommentsModule,
    SistemaModule, TwoFAModule,
    UserWhatsAppModule, RbacModule,
    AlertasModule,
    OrganizationsModule,
    CadastroRequestModule,
    BillingModule,
    JwtModule.register({ secret: process.env.JWT_SECRET, signOptions: { expiresIn: "1h" } }),
    // Finance — Financeiro, Meus Gastos, Contas a Pagar e Orçamento (Budget
    // passou a viver dentro do Finance na redução de escopo de 18/10/2026).
    FinanceiroModule,
    GastosModule,
    OrcamentoModule,
    // Integração de calendário externo (Microsoft 365) usada pelo Space.
    // Rotas em /api/integracoes/microsoft/*. Ver docs/integracoes/.
    IntegracoesModule,
  ],
})
export class AppModule {}
