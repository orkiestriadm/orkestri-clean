import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";

import { EmployeeController } from "./presentation/employee.controller";
import { DocumentController } from "./presentation/document.controller";
import { PositionController } from "./presentation/position.controller";
import { VacationController } from "./presentation/vacation.controller";
import { BenefitController } from "./presentation/benefit.controller";
import { DevelopmentController } from "./presentation/development.controller";
import { ReportController } from "./presentation/report.controller";
import { EmployeeService } from "./application/employee.service";
import { DocumentService } from "./application/document.service";
import { PositionService } from "./application/position.service";
import { VacationService } from "./application/vacation.service";
import { BenefitService } from "./application/benefit.service";
import { DevelopmentService } from "./application/development.service";
import { ReportService } from "./application/report.service";
import { PeopleScopeService } from "./application/people-scope.service";
import { EmployeeRepository } from "./infrastructure/employee.repository";
import { EmployeeHistoryRepository } from "./infrastructure/employee-history.repository";
import { DocumentRepository } from "./infrastructure/document.repository";
import { PositionRepository } from "./infrastructure/position.repository";
import { VacationRepository } from "./infrastructure/vacation.repository";
import { BenefitRepository } from "./infrastructure/benefit.repository";
import { DevelopmentRepository } from "./infrastructure/development.repository";
import { ReportRepository } from "./infrastructure/report.repository";
import { DocumentStorageService } from "./infrastructure/document-storage.service";
import { PeopleEventsPublisher } from "./domain/people-events.publisher";

/**
 * Orkiestri People — gestão de pessoas.
 *
 * Primeiro módulo do repositório estruturado em camadas conforme BACKEND.md §4:
 *
 *   presentation/    controllers finos
 *   application/     casos de uso, DTOs, escopo
 *   infrastructure/  repositórios (único ponto que fala Prisma)
 *   domain/          regras puras, eventos
 *
 * Os demais 40 módulos seguem o padrão antigo (tudo num `*.module.ts`). Isso é
 * dívida conhecida e documentada — não será refatorada agora. Ver
 * docs/people/MIGRATION_MATRIX.md e PEOPLE_ADDENDUM_2026-07-28.md §12.
 *
 * PeopleScopeService é exportado: os próximos submódulos (documentos, férias,
 * solicitações) precisam do mesmo escopo, e duplicá-lo seria reintroduzir o
 * problema que ele resolve.
 */
@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [
    EmployeeController, DocumentController, PositionController, VacationController,
    BenefitController, DevelopmentController, ReportController,
  ],
  providers: [
    EmployeeService,
    DocumentService,
    PositionService,
    VacationService,
    BenefitService,
    DevelopmentService,
    ReportService,
    PeopleScopeService,
    EmployeeRepository,
    EmployeeHistoryRepository,
    DocumentRepository,
    PositionRepository,
    VacationRepository,
    BenefitRepository,
    DevelopmentRepository,
    ReportRepository,
    DocumentStorageService,
    PeopleEventsPublisher,
  ],
  exports: [PeopleScopeService, EmployeeRepository],
})
export class PeopleModule {}
