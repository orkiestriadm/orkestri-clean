import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";

import { CasoController } from "./presentation/caso.controller";
import { AtividadeController } from "./presentation/atividade.controller";
import { DocumentoController } from "./presentation/documento.controller";
import { PainelController } from "./presentation/painel.controller";
import { ReuniaoController } from "./presentation/reuniao.controller";
import { AdminController } from "./presentation/admin.controller";

import { CasoService } from "./application/caso.service";
import { AtividadeService } from "./application/atividade.service";
import { AvisoService } from "./application/aviso.service";
import { DocumentoService } from "./application/documento.service";
import { PainelService } from "./application/painel.service";
import { RelatorioService } from "./application/relatorio.service";
import { ReuniaoService } from "./application/reuniao.service";
import { ImportacaoService } from "./application/importacao.service";
import { AutomacaoService } from "./application/automacao.service";
import { AdminService } from "./application/admin.service";

import { CasoRepository } from "./infrastructure/caso.repository";
import { DocumentoStorageService } from "./infrastructure/documento-storage.service";

/**
 * Orkiestri Strategy — Gestão Estratégica.
 *
 * Informatiza a planilha "Acompanhamento Estratégico": cada assunto vira um
 * caso com etapa, dependência, próxima ação, prazos, timeline, tarefas,
 * documentos, financeiro, risco, farol calculado e trilha de auditoria; a
 * Diretoria acompanha pelo painel e conduz a Reunião Estratégica com pauta
 * gerada e ata.
 *
 * Rotas em `/api/v1/estrategico/*`. Mesmas camadas do Compliance:
 *
 *   presentation/    controllers finos
 *   application/     casos de uso, DTOs, apresentação
 *   infrastructure/  repositório e armazenamento de arquivos
 *   domain/          regras puras — farol, risco, alertas, leitura da planilha
 *
 * Especificação e decisões: docs/estrategico/MODULO.md.
 */
@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule, ScheduleModule.forRoot()],
  controllers: [
    CasoController,
    AtividadeController,
    DocumentoController,
    PainelController,
    ReuniaoController,
    AdminController,
  ],
  providers: [
    CasoService,
    AtividadeService,
    AvisoService,
    DocumentoService,
    PainelService,
    RelatorioService,
    ReuniaoService,
    ImportacaoService,
    AutomacaoService,
    AdminService,
    CasoRepository,
    DocumentoStorageService,
  ],
})
export class EstrategicoModule {}
