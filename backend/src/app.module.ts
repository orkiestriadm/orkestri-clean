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
import { WorkforceModule } from './modules/workforce/workforce.module';
import { SquadsModule } from './modules/squads/squads.module';
import { BillingModule } from './modules/billing/billing.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule,
    PrismaModule, HealthModule, AuthModule, UsersModule,
    StatsModule, AgendaModule, NotificationsModule,
    ProjectsModule, KeepModule, SetoresModule,
    AuditModule, StatusModule, CommentsModule,
    RelatoriosModule, SistemaModule, TwoFAModule,
    UserWhatsAppModule, ClientesModule, ChamadosModule, RbacModule,
    OrcamentoModule,
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
    WorkforceModule,
    SquadsModule,
    BillingModule,
  ],
})
export class AppModule {}