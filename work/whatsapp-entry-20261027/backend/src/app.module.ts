import { ProspectsModule } from "./modules/prospects/prospects.module";
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
// SetoresModule saiu em 20/10/2026 junto com a tabela `setores`. Servia
// /setores, /setores/tree e /organizacao/diretorio — este último alimentava só
// a aba Organograma do Core, removida na mesma mudança.
import { AuditModule } from "./modules/audit/audit.module";
import { StatusModule } from "./modules/users/status.module";
import { CommentsModule } from "./modules/projects/comments.module";
import { SistemaModule } from "./modules/sistema/sistema.module";
import { TwoFAModule } from "./modules/auth/twofa.module";
import { UserWhatsAppModule } from "./modules/users/whatsapp.module";
import { ChamadosModule } from "./modules/chamados/chamados.module";
import { RbacModule } from "./modules/rbac/rbac.module";
import { CacheModule } from "./modules/cache/cache.module";
import { OrcamentoModule } from "./modules/orcamento/orcamento.module";
import { AlertasModule } from "./modules/alertas/alertas.module";
import { SlaModule } from "./modules/sla/sla.module";
import { ConhecimentoModule } from "./modules/conhecimento/conhecimento.module";
import { AutomacoesModule } from "./modules/automacoes/automacoes.module";
import { ApontamentosModule } from "./modules/apontamentos/apontamentos.module";
import { CsatModule } from "./modules/csat/csat.module";
import { WebhooksModule } from "./modules/automacoes/webhooks.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
import { CadastroRequestModule } from './modules/cadastro-request/cadastro-request.module';
import { ChamadoTemplatesModule } from './modules/chamado-templates/chamado-templates.module';
import { BillingModule } from './modules/billing/billing.module';
import { FinanceiroModule } from './modules/financeiro/financeiro.module';
import { GastosModule } from './modules/gastos/gastos.module';
import { IntegracoesModule } from './modules/integracoes/integracoes.module';
import { WhatsappInboundModule } from './modules/agenda/whatsapp-inbound.module';
import { ReferralModule } from './modules/referral/referral.module';
import { JwtModule } from '@nestjs/jwt';

/**
 * Escopo do Orkiestri em produção a partir de 19/10/2026.
 *
 * Saíram os módulos que NÃO tinham dado operacional em produção, medidos
 * tabela por tabela antes da remoção: Fleet, Assets (Ativos, Monitoramento,
 * OSA), Compliance, Strategy, People (+collaborators, ausencias, skills,
 * squads, workforce), Approvals (workflows), Relations (clientes, contratos,
 * faturas), Supply e o portal do cliente. Capacity saiu junto porque lia de
 * ausencias/collaborators, e sem eles não tem o que medir.
 *
 * FICARAM, porque têm dado vivo: Service — Chamados (236 registros), SLA,
 * CSAT, Horas e Catálogo — e Quality — Conhecimento (61 artigos). Junto com
 * Space, Projects, Finance, Orçamento, Automações, WhatsApp, Resend,
 * Outlook/M365 e o núcleo (Core, Organizações, Saúde da Plataforma).
 *
 * As tabelas dos módulos removidos seguem no banco, paradas: a remoção foi de
 * código, sem migration destrutiva.
 *
 * EXCEÇÃO, de 20/10/2026: `setores` e `aprovadores_setor` foram DERRUBADAS ao
 * simplificar o cadastro do Core. A migration que as derruba abre com um gate
 * que levanta exceção se achar linha dependente em collaborators, ativos,
 * veiculos ou aprovadores_setor — ou seja, ela se RECUSA a rodar no banco do
 * Hub, onde esses módulos estão vivos.
 *
 * O Hub Transbrasiliana roda do MESMO repositório, em branch `hub/*`, e USA
 * Fleet, Compliance, People e Strategy — esta linha nunca pode ser mesclada lá.
 */
@Module({
  imports: [
    ProspectsModule,
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule,
    PrismaModule, HealthModule, AuthModule, UsersModule,
    StatsModule, AgendaModule, NotificationsModule, WhatsappInboundModule, ReferralModule,
    ProjectsModule, KeepModule,
    AuditModule, StatusModule, CommentsModule,
    SistemaModule, TwoFAModule,
    UserWhatsAppModule, ChamadosModule, RbacModule,
    OrcamentoModule,
    AlertasModule,
    SlaModule,
    ConhecimentoModule,
    AutomacoesModule,
    ApontamentosModule,
    CsatModule,
    ChamadoTemplatesModule,
    WebhooksModule,
    OrganizationsModule,
    CadastroRequestModule,
    BillingModule,
    JwtModule.register({ secret: process.env.JWT_SECRET, signOptions: { expiresIn: "1h" } }),
    FinanceiroModule,
    GastosModule,
    // Integração de calendário externo (Microsoft 365 / futuro Google).
    // Rotas em /api/integracoes/microsoft/*. Ver docs/integracoes/.
    IntegracoesModule,
  ],
})
export class AppModule {}
