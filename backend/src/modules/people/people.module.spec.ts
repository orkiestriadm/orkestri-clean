import { Test } from "@nestjs/testing";
import { PeopleModule } from "./people.module";
import { PrismaService } from "../../prisma/prisma.service";
import { EmployeeService } from "./application/employee.service";
import { DocumentService } from "./application/document.service";
import { PeopleScopeService } from "./application/people-scope.service";
import { EmployeeController } from "./presentation/employee.controller";
import { DocumentController } from "./presentation/document.controller";
import { PositionController } from "./presentation/position.controller";

/**
 * Verifica que o módulo monta.
 *
 * Erro de injeção de dependência não aparece em `tsc` — só ao subir a
 * aplicação. Sem este teste, um provider faltando no people.module.ts só
 * apareceria em produção. É o que quebra as suítes de auth hoje.
 */
describe("PeopleModule", () => {
  const prismaFake = {
    collaborator: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    collaboratorHistory: { create: jest.fn(), createMany: jest.fn(), findMany: jest.fn() },
    collaboratorVacationPeriod: { findMany: jest.fn(), findFirst: jest.fn(), createMany: jest.fn(), update: jest.fn() },
    ausencia: { findMany: jest.fn(), create: jest.fn() },
    position: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    collaboratorDocument: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), groupBy: jest.fn() },
    auditLog: { create: jest.fn(), findMany: jest.fn() },
    user: { findFirst: jest.fn() },
  };

  async function montar() {
    return Test.createTestingModule({ imports: [PeopleModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaFake)
      .compile();
  }

  it("resolve todas as dependências declaradas", async () => {
    const modulo = await montar();
    expect(modulo.get(EmployeeService)).toBeDefined();
    expect(modulo.get(DocumentService)).toBeDefined();
    expect(modulo.get(PeopleScopeService)).toBeDefined();
    expect(modulo.get(EmployeeController)).toBeDefined();
    expect(modulo.get(DocumentController)).toBeDefined();
    expect(modulo.get(PositionController)).toBeDefined();
  });

  it("expõe PeopleScopeService para os próximos submódulos", async () => {
    const modulo = await montar();
    // Documentos, férias e solicitações vão reutilizar este escopo em vez de
    // reimplementá-lo. Ver docs/people/ADR-003.
    expect(modulo.get(PeopleScopeService)).toBeInstanceOf(PeopleScopeService);
  });
});
