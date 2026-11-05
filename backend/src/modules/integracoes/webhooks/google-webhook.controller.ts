import { Controller, Post, Headers, Res, Logger, HttpCode } from "@nestjs/common";
import { Response } from "express";
import { PrismaService } from "../../../prisma/prisma.service";
import { CalendarSyncService } from "../calendar/calendar-sync.service";

@Controller("integracoes/google/webhook")
export class GoogleWebhookController {
  private readonly logger = new Logger(GoogleWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sync: CalendarSyncService,
  ) {}

  @Post()
  @HttpCode(200)
  async handleWebhook(
    @Headers("x-goog-channel-id") channelId?: string,
    @Headers("x-goog-resource-id") resourceId?: string,
    @Headers("x-goog-resource-state") resourceState?: string,
    @Headers("x-goog-channel-token") clientToken?: string,
  ) {
    if (!channelId) {
      return { ok: true };
    }

    // Handshake inicial do Google ao criar o canal
    if (resourceState === "sync") {
      this.logger.log(`Google Webhook canal ${channelId} verificado com sucesso.`);
      return { ok: true };
    }

    // Notificação de evento alterado/criado
    const sub = await this.prisma.calendarSubscription.findFirst({
      where: { subscriptionId: channelId },
    });

    if (sub) {
      if (sub.clientState && clientToken !== sub.clientState) {
        this.logger.warn(`Google Webhook token inválido para canal ${channelId} — descartado.`);
        return { ok: true };
      }
      this.logger.log(`Google Webhook notificação recebida (canal ${channelId}). Disparando deltaSync...`);
      this.sync.deltaSync(sub.connectionId).catch((e) => {
        this.logger.warn(`Erro no deltaSync disparado pelo Google Webhook: ${e?.message || e}`);
      });
    }

    return { ok: true };
  }
}
