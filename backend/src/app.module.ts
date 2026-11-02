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
import { OrganizationsModule } from "./modules/organizations/organizations.module";
import { CadastroRequestModule } from './modules/cadastro-request/cadastro-request.module';
import { BillingModule } from './modules/billing/billing.module';
import { GastosModule } from './modules/gastos/gastos.module';
import { IntegracoesModule } from './modules/integracoes/integracoes.module';
import { WhatsappInboundModule } from './modules/agenda/whatsapp-inbound.module';
import { ReferralModule } from './modules/referral/referral.module';
import { AssinaturaModule } from './modules/assinatura/assinatura.module';
// Resgatado do servidor de produção: o módulo roda lá desde 26/10 e nunca
// esteve no git. Ver o commit de resgate para o que ainda falta.
import { ProspectsModule } from './modules/prospects/prospects.module';
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
 * FICARAM, porque têm dado vivo: Service — Chamados (236 registros) e SLA —
 * e Quality — Conhecimento (61 artigos). Junto com Space, Projects, Finance,
 * Budget, WhatsApp, Resend, Outlook/M365 e o núcleo (Core, Organizações,
 * Saúde da Plataforma).
 *
 * SEGUNDA REDUÇÃO, de 02/11/2026 — a que enxugou o que SOBROU:
 *
 * Service ficou só com o Chamado. Saíram CSAT, Horas (apontamentos),
 * Catálogo (chamado-templates) e Automações — este último levando junto os
 * webhooks de saída, que viviam sob a mesma permissão. Automações não era
 * tela: era um motor injetado em chamados, projetos, usuários e auth, que
 * consultava a tabela de regras a CADA chamado criado ou atualizado, a cada
 * tarefa e a cada usuário novo. Sem regra escrita, era uma consulta por
 * evento para não fazer nada — e é a única parte desta redução com ganho de
 * tempo de resposta, não só de código.
 *
 * Finance ficou só com Meus Gastos. Saíram Contas a Pagar e a Dashboard do
 * Finance, que não era uma tela empobrecida pela saída das contas: ela ERA
 * as contas, lia /financeiro/dashboard e nada mais. Os comandos de conta no
 * WhatsApp saíram junto, de propósito: deixá-los de pé criaria lançamento
 * que ninguém mais conseguiria ver.
 *
 * Orçamento voltou a ser produto próprio (Budget), como era antes de
 * 19/10/2026 — ele nunca teve uma linha em comum com o Financeiro.
 *
 * Esta também foi remoção de CÓDIGO: as tabelas (contas_pagar, apontamentos,
 * automacoes, webhooks, chamado_templates) seguem no banco, paradas.
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
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule,
    PrismaModule, HealthModule, AuthModule, UsersModule,
    StatsModule, AgendaModule, NotificationsModule, WhatsappInboundModule, ReferralModule,
    ProspectsModule,
    ProjectsModule, KeepModule,
    AuditModule, StatusModule, CommentsModule,
    SistemaModule, TwoFAModule,
    UserWhatsAppModule, ChamadosModule, RbacModule,
    OrcamentoModule,
    AlertasModule,
    SlaModule,
    ConhecimentoModule,
    OrganizationsModule,
    CadastroRequestModule,
    BillingModule,
    // Mensalidade (R$ 11,90/mês) cobrada no Mercado Pago. Rotas em
    // /api/assinatura/*: checkout sem login (o vencido não consegue entrar) e
    // o webhook, que é quem libera o mês pago.
    AssinaturaModule,
    JwtModule.register({ secret: process.env.JWT_SECRET, signOptions: { expiresIn: "1h" } }),
    GastosModule,
    // Integração de calendário externo (Microsoft 365 / futuro Google).
    // Rotas em /api/integracoes/microsoft/*. Ver docs/integracoes/.
    IntegracoesModule,
  ],
})
export class AppModule {}
