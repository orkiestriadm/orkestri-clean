import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { AuthService } from "./auth.service";

/**
 * Varre os acessos de teste vencidos uma vez por dia e avisa o suporte para o
 * contato de conversão (o bloqueio do login já acontece em `AuthService.login`).
 * Roda de madrugada para não competir com o tráfego do dia.
 */
@Injectable()
export class TrialScheduler {
  private readonly logger = new Logger(TrialScheduler.name);

  constructor(private readonly auth: AuthService) {}

  @Cron(CronExpression.EVERY_DAY_AT_5AM)
  async avisarTrialsVencidos() {
    try {
      const n = await this.auth.processarTrialsVencidos();
      if (n > 0) this.logger.log(`Trials vencidos avisados ao suporte: ${n}`);
    } catch (e: any) {
      this.logger.error(`Falha ao processar trials vencidos: ${e?.message || e}`);
    }
  }

  // Aviso de "vence amanhã" no WhatsApp — fim do teste ou fim do mês pago — com
  // a opção de renovar. De hora em hora
  // das 8h às 20h (Brasília): pega quem entrou na janela das últimas 24 h sem
  // mandar mensagem de madrugada — quem vence cedo recebe na véspera.
  @Cron("0 8-20 * * *", { timeZone: "America/Sao_Paulo" })
  async avisarFimDoTeste() {
    try {
      const n = await this.auth.enviarLembretesTrial();
      if (n > 0) this.logger.log(`Avisos de fim de teste enviados no WhatsApp: ${n}`);
    } catch (e: any) {
      this.logger.error(`Falha ao enviar avisos de fim de teste: ${e?.message || e}`);
    }
  }
}
