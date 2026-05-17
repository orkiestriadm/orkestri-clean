import { Module, Controller, Get } from "@nestjs/common";

@Controller("health")
class HealthController {
  @Get()
  check() {
    const now = new Date();
    return {
      status: "ok",
      app: "Orkestri",
      serverTime: now.toISOString(),
      serverTimeLocal: now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}