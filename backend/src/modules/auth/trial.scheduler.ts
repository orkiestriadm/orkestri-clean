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
}
