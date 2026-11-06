import { Module } from "@nestjs/common";
import { MicrosoftConfig } from "./graph/microsoft.config";
import { MicrosoftConfigResolver } from "./graph/microsoft-config.resolver";
import { MicrosoftOAuthService } from "./graph/microsoft-oauth.service";
import { MicrosoftGraphClient } from "./graph/microsoft-graph.client";
import { GoogleConfig } from "./google/google.config";
import { GoogleConfigResolver } from "./google/google-config.resolver";
import { GoogleOAuthService } from "./google/google-oauth.service";
import { GoogleCalendarClient } from "./google/google-calendar.client";
import { CalendarConnectionService } from "./calendar/calendar-connection.service";
import { CalendarSyncService } from "./calendar/calendar-sync.service";
import { CalendarWritebackService } from "./calendar/calendar-writeback.service";
import { SubscriptionService } from "./webhooks/subscription.service";
import { SubscriptionScheduler } from "./webhooks/subscription.scheduler";
import { GraphWebhookController } from "./webhooks/graph-webhook.controller";
import { GoogleWebhookController } from "./webhooks/google-webhook.controller";
import { IntegracoesController } from "./integracoes.controller";
import { OAuthCallbackController } from "./oauth-callback.controller";
import { GoogleIntegracoesController } from "./google/google-integracoes.controller";
import { GoogleOAuthCallbackController } from "./google/google-oauth-callback.controller";
import { IntegrationConfigService } from "./integration-config.service";

/**
 * Integração de calendário externo (Microsoft 365 e Google Calendar).
 *
 * Estruturado em camadas para ser provider-agnóstico:
 *   graph/     → OAuth + HTTP do Microsoft Graph
 *   google/    → OAuth + HTTP da Google Calendar API v3
 *   calendar/  → conexão, mappers, sync e writeback sobre a agenda unificada (Event)
 *   webhooks/  → assinaturas / watch channels + scheduler de manutenção
 *
 * Exporta CalendarWritebackService para o AgendaModule empurrar ao Outlook e Google
 * os eventos criados/editados/apagados no Orkiestri e no WhatsApp.
 */
@Module({
  controllers: [
    IntegracoesController,
    OAuthCallbackController,
    GraphWebhookController,
    GoogleIntegracoesController,
    GoogleOAuthCallbackController,
    GoogleWebhookController,
  ],
  providers: [
    MicrosoftConfig,
    MicrosoftConfigResolver,
    MicrosoftOAuthService,
    MicrosoftGraphClient,
    GoogleConfig,
    GoogleConfigResolver,
    GoogleOAuthService,
    GoogleCalendarClient,
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
