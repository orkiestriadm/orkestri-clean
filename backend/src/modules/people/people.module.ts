import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";

import { EmployeeController } from "./presentation/employee.controller";
import { DocumentController } from "./presentation/document.controller";
import { PositionController } from "./presentation/position.controller";
import { VacationController } from "./presentation/vacation.controller";
import { EmployeeService } from "./application/employee.service";
import { DocumentService } from "./application/document.service";
import { PositionService } from "./application/position.service";
import { VacationService } from "./application/vacation.service";
import { PeopleScopeService } from "./application/people-scope.service";
import { EmployeeRepository } from "./infrastructure/employee.repository";
import { EmployeeHistoryRepository } from "./infrastructure/employee-history.repository";
import { DocumentRepository } from "./infrastructure/document.repository";
import { PositionRepository } from "./infrastructure/position.repository";
import { VacationRepository } from "./infrastructure/vacation.repository";
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
  controllers: [EmployeeController, DocumentController, PositionController, VacationController],
  providers: [
    EmployeeService,
    DocumentService,
    PositionService,
    VacationService,
    PeopleScopeService,
    EmployeeRepository,
    EmployeeHistoryRepository,
    DocumentRepository,
    PositionRepository,
    VacationRepository,
    DocumentStorageService,
    PeopleEventsPublisher,
  ],
  exports: [PeopleScopeService, EmployeeRepository],
})
export class PeopleModule {}
