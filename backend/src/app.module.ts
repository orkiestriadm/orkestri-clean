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
import { RelatoriosModule } from "./modules/stats/relatorios.module";
import { SistemaModule } from "./modules/sistema/sistema.module";
import { TwoFAModule } from "./modules/auth/twofa.module";
import { UserWhatsAppModule } from "./modules/users/whatsapp.module";
import { ClientesModule } from "./modules/clientes/clientes.module";
import { ChamadosModule } from "./modules/chamados/chamados.module";
import { RbacModule } from "./modules/rbac/rbac.module";
import { CacheModule } from "./modules/cache/cache.module";
import { OrcamentoModule } from "./modules/orcamento/orcamento.module";
import { AlertasModule } from "./modules/alertas/alertas.module";
import { SuppliersModule } from "./modules/suppliers/suppliers.module";
import { SlaModule } from "./modules/sla/sla.module";
import { ConhecimentoModule } from "./modules/conhecimento/conhecimento.module";
import { AtivosModule } from "./modules/ativos/ativos.module";
import { AutomacoesModule } from "./modules/automacoes/automacoes.module";
import { ApontamentosModule } from "./modules/apontamentos/apontamentos.module";
import { ContratosModule } from "./modules/contratos/contratos.module";
import { CsatModule } from "./modules/csat/csat.module";
import { PortalModule } from "./modules/portal/portal.module";
import { WebhooksModule } from "./modules/automacoes/webhooks.module";
import { FaturasModule } from "./modules/faturas/faturas.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
import { CadastroRequestModule } from './modules/cadastro-request/cadastro-request.module';
import { CollaboratorsModule } from './modules/collaborators/collaborators.module';
import { CapacityModule } from './modules/capacity/capacity.module';
import { SkillsModule } from './modules/skills/skills.module';
import { AusenciasModule } from './modules/ausencias/ausencias.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
import { WorkflowTemplatesModule } from './modules/workflow-templates/workflow-templates.module';
import { ChamadoTemplatesModule } from './modules/chamado-templates/chamado-templates.module';
import { WorkforceModule } from './modules/workforce/workforce.module';
import { SquadsModule } from './modules/squads/squads.module';
import { BillingModule } from './modules/billing/billing.module';
import { MonitoramentoModule } from './modules/monitoramento/monitoramento.module';
import { OsaModule } from './modules/osa/osa.module';
import { FinanceiroModule } from './modules/financeiro/financeiro.module';
import { FrotaModule } from './modules/frota/frota.module';
import { PeopleModule } from './modules/people/people.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { IntegracoesModule } from './modules/integracoes/integracoes.module';
import { WhatsappInboundModule } from './modules/agenda/whatsapp-inbound.module';
import { ReferralModule } from './modules/referral/referral.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule,
    PrismaModule, HealthModule, AuthModule, UsersModule,
    StatsModule, AgendaModule, NotificationsModule, WhatsappInboundModule, ReferralModule,
    ProjectsModule, KeepModule, SetoresModule,
    AuditModule, StatusModule, CommentsModule,
    RelatoriosModule, SistemaModule, TwoFAModule,
    UserWhatsAppModule, ClientesModule, ChamadosModule, RbacModule,
    OrcamentoModule,
    AlertasModule,
    SuppliersModule,
    SlaModule,
    ConhecimentoModule,
    AtivosModule,
    AutomacoesModule,
    ApontamentosModule,
    ContratosModule,
    CsatModule,
    PortalModule,
    WebhooksModule,
    FaturasModule,
    OrganizationsModule,
    CadastroRequestModule,
    CollaboratorsModule,
    CapacityModule,
    SkillsModule,
    AusenciasModule,
    WorkflowsModule,
    WorkflowTemplatesModule,
    ChamadoTemplatesModule,
    WorkforceModule,
    SquadsModule,
    BillingModule,
    // Modulo Monitoramento Operacional (independente do modulo Ativos)
    JwtModule.register({ secret: process.env.JWT_SECRET, signOptions: { expiresIn: "1h" } }),
    MonitoramentoModule,
    OsaModule,
    FinanceiroModule,
    FrotaModule,
    // Orkiestri People — rotas em /api/v1/people/*. Convive com CollaboratorsModule
    // (/api/collaborators) durante a migração. Ver docs/people/MIGRATION_MATRIX.md.
    PeopleModule,
    // Orkiestri Compliance — Gestão de Obrigações. Rotas em /api/v1/compliance/*.
    // Ver docs/architecture/gestaodeobrigacoes.md.
    ComplianceModule,
    // Integração de calendário externo (Microsoft 365 / futuro Google).
    // Rotas em /api/integracoes/microsoft/*. Ver docs/integracoes/.
    IntegracoesModule,
  ],
})
export class AppModule {}