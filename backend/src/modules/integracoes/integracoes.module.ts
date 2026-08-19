import { Module } from "@nestjs/common";
import { MicrosoftConfig } from "./graph/microsoft.config";
import { MicrosoftConfigResolver } from "./graph/microsoft-config.resolver";
import { MicrosoftOAuthService } from "./graph/microsoft-oauth.service";
import { MicrosoftGraphClient } from "./graph/microsoft-graph.client";
import { CalendarConnectionService } from "./calendar/calendar-connection.service";
import { CalendarSyncService } from "./calendar/calendar-sync.service";
import { CalendarWritebackService } from "./calendar/calendar-writeback.service";
import { SubscriptionService } from "./webhooks/subscription.service";
import { SubscriptionScheduler } from "./webhooks/subscription.scheduler";
import { GraphWebhookController } from "./webhooks/graph-webhook.controller";
import { IntegracoesController } from "./integracoes.controller";
import { OAuthCallbackController } from "./oauth-callback.controller";
import { IntegrationConfigService } from "./integration-config.service";

/**
 * Integração de calendário externo (Microsoft 365 / futuro Google).
 *
 * Estruturado em camadas para ser provider-agnóstico:
 *   graph/     → OAuth + HTTP do Microsoft Graph (o que é específico do provedor)
 *   calendar/  → conexão, mapper, sync e writeback sobre a agenda unificada (Event)
 *   webhooks/  → assinaturas de Change Notification + scheduler de manutenção
 *
 * Exporta CalendarWritebackService para o AgendaModule empurrar ao Outlook os
 * eventos criados/editados/apagados no Orkiestri.
 */
@Module({
  // Sem imports: AuthGuard("jwt")/PermissionsGuard funcionam por JwtStrategy já
  // instanciada globalmente pelo AuthModule (mesmo padrão do AgendaModule), e
  // PrismaService é @Global.
  controllers: [IntegracoesController, OAuthCallbackController, GraphWebhookController],
  providers: [
    MicrosoftConfig,
    MicrosoftConfigResolver,
    MicrosoftOAuthService,
    MicrosoftGraphClient,
    CalendarConnectionService,
    CalendarSyncService,
    CalendarWritebackService,
    SubscriptionService,
    SubscriptionScheduler,
    IntegrationConfigService,
  ],
  exports: [CalendarWritebackService],
})
export class IntegracoesModule {}
