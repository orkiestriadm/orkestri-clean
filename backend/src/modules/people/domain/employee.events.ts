/**
 * Eventos de domínio do Orkiestri People.
 *
 * Publicados via EventEmitter2 para desacoplar os módulos: quem reage a uma
 * admissão (notificações, provisionamento de acessos, integrações) não precisa
 * ser conhecido por quem cria o colaborador. Ver SYSTEM_ARCHITECTURE.md §13.
 *
 * Nomes seguem PEOPLE_INTEGRATIONS.md §"Eventos padrão" — são contrato externo
 * quando expostos por webhook, então não renomear sem versionar.
 */

export const PEOPLE_EVENTS = {
  employeeCreated: "employee.created",
  employeeUpdated: "employee.updated",
  employeeStatusChanged: "employee.status.changed",
  employeeTerminated: "employee.terminated",
  employeeDepartmentChanged: "employee.department.changed",
  employeePositionChanged: "employee.position.changed",
} as const;

/** Campos presentes em todo evento — permitem rotear sem carregar o registro. */
type EventoBase = {
  organizationId: string;
  employeeId: string;
  /** Usuário que originou a ação. Nulo em rotinas automáticas. */
  atorId: string | null;
  ocorridoEm: Date;
};

export type EmployeeCreatedEvent = EventoBase & {
  nome: string;
  temAcessoAoSistema: boolean;
};

export type EmployeeUpdatedEvent = EventoBase & {
  camposAlterados: readonly string[];
};

export type EmployeeStatusChangedEvent = EventoBase & {
  statusAnterior: string;
  statusNovo: string;
};

export type EmployeeTerminatedEvent = EventoBase & {
  dataDesligamento: Date;
};

export type EmployeeDepartmentChangedEvent = EventoBase & {
  setorAnteriorId: string | null;
  setorNovoId: string | null;
};

export type EmployeePositionChangedEvent = EventoBase & {
  positionAnteriorId: string | null;
  positionNovoId: string | null;
};
