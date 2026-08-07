import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";

import { ObrigacaoController } from "./presentation/obrigacao.controller";
import { ArquivoController } from "./presentation/arquivo.controller";
import { PainelController } from "./presentation/painel.controller";
import { CatalogoController } from "./presentation/catalogo.controller";

import { ObrigacaoService } from "./application/obrigacao.service";
import { CatalogoService } from "./application/catalogo.service";
import { ArquivoService } from "./application/arquivo.service";
import { PainelService } from "./application/painel.service";
import { RelatorioService } from "./application/relatorio.service";
import { NotificacaoService } from "./application/notificacao.service";
import { FluxoService } from "./application/fluxo.service";

import { ObrigacaoRepository } from "./infrastructure/obrigacao.repository";
import { CatalogoRepository } from "./infrastructure/catalogo.repository";
import { PainelRepository } from "./infrastructure/painel.repository";
import {
  ArquivoRepository, HistoricoRepository, EnvioRepository,
} from "./infrastructure/arquivo.repository";
import { ArquivoStorageService } from "./infrastructure/arquivo-storage.service";

/**
 * Orkiestri Compliance — Gestão de Obrigações.
 *
 * Rotas em `/api/v1/compliance/*`. Estruturado em camadas, como o People:
 *
 *   presentation/    controllers finos
 *   application/     casos de uso, DTOs, apresentação
 *   infrastructure/  repositórios (único ponto que fala Prisma)
 *   domain/          regras puras — prazos, situação, régua de alertas
 *
 * `NotificationsModule` entra por causa do motor de alertas: e-mail e WhatsApp
 * são os mesmos serviços que o resto do sistema usa. Reimplementá-los aqui
 * criaria um segundo lugar para configurar remetente e instância.
 *
 * Especificação: docs/architecture/gestaodeobrigacoes.md.
 * A planilha que o módulo substitui está analisada em
 * docs/architecture/COMPLIANCE_PLANILHA_ORIGEM.md.
 */
@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule, ScheduleModule.forRoot()],
  controllers: [
    ObrigacaoController,
    ArquivoController,
    PainelController,
    CatalogoController,
  ],
  providers: [
    ObrigacaoService,
    CatalogoService,
    ArquivoService,
    PainelService,
    RelatorioService,
    NotificacaoService,
    FluxoService,
    ObrigacaoRepository,
    CatalogoRepository,
    PainelRepository,
    ArquivoRepository,
    HistoricoRepository,
    EnvioRepository,
    ArquivoStorageService,
  ],
  exports: [ObrigacaoRepository, NotificacaoService],
})
export class ComplianceModule {}
