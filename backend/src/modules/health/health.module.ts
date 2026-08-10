import { MARCA } from "../../common/marca";
import { Module, Controller, Get } from "@nestjs/common";

/**
 * Versao da API — deliberadamente separada da do frontend.
 *
 * A tela Sobre compara as duas. Se fosse um valor unico compartilhado, a
 * comparacao nao provaria nada; separadas, divergencia revela deploy pela
 * metade, que e a primeira hipotese a descartar num diagnostico.
 */
const VERSAO_API = "1.9.2";

@Controller("health")
class HealthController {
  @Get()
  check() {
    const now = new Date();
    return {
      status: "ok",
      app: MARCA,
      version: VERSAO_API,
      serverTime: now.toISOString(),
      serverTimeLocal: now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}