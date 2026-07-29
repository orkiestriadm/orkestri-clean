# ============================================================================
# ORKIESTRI MODULE
# DOCUMENT: PEOPLE_DATABASE.md
# ============================================================================

Version: 1.0.0
Status: Official
Category: Database Architecture
Owner: Orkiestri Product Engineering

===============================================================================

> ⚠️ **CORRIGIDO POR `PEOPLE_ADDENDUM_2026-07-28.md` §3, §4, §6 e §7**
>
> - §5 `employees`: não será criada. `Collaborator` já existe e é a entidade
>   Employee do módulo. Ver `docs/people/ADR-001`.
> - §3 `tenant_id`: não será criado. `Organization` **é** o tenant nesta
>   arquitetura; o isolamento é por `organizationId`.
> - §16 `vacation_requests` e §17 `leave_requests`: atendidas por `Ausencia`,
>   que já existe e já discrimina o tipo.
> - §10 `employee_assignments`: substituída por `EmployeeHistory`.

===============================================================================

# 1. PURPOSE

This document defines the official database architecture for People Hub.

The objective is to create a scalable data model for:

- Employee management
- Human resources processes
- Personnel administration
- Documents
- Benefits
- Requests
- Organizational structure

---

# 2. DATABASE PRINCIPLES

The People Hub database must follow:

- Multi-tenant architecture
- Data normalization
- Auditability
- Security
- Historical tracking
- Scalability

---

# 3. DATABASE STANDARD FIELDS

Every business table must contain:

```
id UUID

tenant_id UUID

created_at TIMESTAMP

created_by UUID

updated_at TIMESTAMP

updated_by UUID

deleted_at TIMESTAMP NULL

version INTEGER
```

---

# 4. CORE ENTITY RELATIONSHIP

Main relationship:

```
Tenant

↓

Organization

↓

Employee

↓

Employee Related Data
```

---

# 5. TABLE: employees

Purpose:

Central employee registry.

This is the main entity of People Hub.

---

## Fields

```
id

tenant_id

organization_id

employee_code

first_name

last_name

preferred_name

birth_date

gender

marital_status

nationality

email

personal_email

phone

mobile_phone

photo_url

status

hire_date

termination_date

created_at

updated_at
```

---

## Status values

```
ACTIVE

INACTIVE

ON_LEAVE

TERMINATED

SUSPENDED
```

---

# 6. TABLE: employee_personal_documents

Purpose:

Stores employee identification information.

---

Fields:

```
id

employee_id

document_type

document_number

issue_date

expiration_date

issuing_authority

file_reference

status
```

Examples:

CPF

Identity document

Passport

Certificates

---

# 7. TABLE: organizations

Purpose:

Represents companies or organizational units.

---

Fields:

```
id

tenant_id

name

legal_name

tax_identifier

type

status
```

---

# 8. TABLE: departments

Purpose:

Represents organizational areas.

---

Fields:

```
id

tenant_id

organization_id

parent_department_id

name

code

manager_employee_id

status
```

Supports hierarchy:

```
Company

↓

Department

↓

Sub Department
```

---

# 9. TABLE: positions

Purpose:

Represents job positions.

---

Fields:

```
id

tenant_id

organization_id

title

code

description

level

status
```

---

# 10. TABLE: employee_assignments

Purpose:

Stores employment relationship history.

A new record should be created whenever employment information changes.

---

Fields:

```
id

employee_id

department_id

position_id

manager_id

employment_type

start_date

end_date

status
```

Examples:

Full time

Contractor

Temporary

---

# 11. TABLE: employee_contacts

Purpose:

Stores emergency and additional contacts.

---

Fields:

```
id

employee_id

name

relationship

phone

email

is_emergency_contact
```

---

# 12. TABLE: employee_addresses

Purpose:

Stores employee addresses.

---

Fields:

```
id

employee_id

type

street

number

complement

city

state

postal_code

country

is_primary
```

---

# 13. TABLE: benefits

Purpose:

Stores available company benefits.

---

Fields:

```
id

tenant_id

name

category

description

status
```

Examples:

Health insurance

Transportation

Meal allowance

---

# 14. TABLE: employee_benefits

Purpose:

Assigns benefits to employees.

---

Fields:

```
id

employee_id

benefit_id

start_date

end_date

status

notes
```

---

# 15. TABLE: employee_documents

Purpose:

Central document management.

---

Fields:

```
id

employee_id

category

title

description

file_reference

issue_date

expiration_date

approval_status

uploaded_by
```

---

# 16. TABLE: vacation_requests

Purpose:

Vacation management.

---

Fields:

```
id

employee_id

request_date

start_date

end_date

days_requested

status

approved_by

approval_date

comments
```

---

Status:

```
DRAFT

SUBMITTED

APPROVED

REJECTED

CANCELLED

COMPLETED
```

---

# 17. TABLE: leave_requests

Purpose:

Employee leave management.

---

Fields:

```
id

employee_id

leave_type

start_date

end_date

reason

document_reference

status
```

---

# 18. TABLE: training_courses

Purpose:

Stores employee training.

---

Fields:

```
id

tenant_id

name

provider

category

duration

status
```

---

# 19. TABLE: employee_training

Purpose:

Employee training history.

---

Fields:

```
id

employee_id

training_id

start_date

completion_date

certificate_reference

status
```

---

# 20. TABLE: performance_reviews

Purpose:

Stores employee evaluations.

---

Fields:

```
id

employee_id

review_cycle

reviewer_id

score

comments

status

created_at
```

---

# 21. TABLE: employee_requests

Purpose:

Generic employee service requests.

---

Fields:

```
id

employee_id

request_type

description

priority

status

workflow_instance_id
```

---

Examples:

Document request

Information update

HR service request

---

# 22. TABLE: employee_history

Purpose:

Stores relevant employee changes.

---

Fields:

```
id

employee_id

event_type

old_value

new_value

changed_by

changed_at
```

---

Examples:

Department changed.

Position changed.

Status changed.

---

# 23. INDEX REQUIREMENTS

Required indexes:

```
tenant_id

employee_code

email

status

department_id

position_id
```

---

# 24. DATA SECURITY

Sensitive fields require:

Access control.

Audit logging.

Encryption when applicable.

Examples:

Documents.

Personal identifiers.

Employment information.

---

# 25. DATABASE EVENTS

Important events:

```
EmployeeCreated

EmployeeUpdated

EmployeeStatusChanged

EmployeeDocumentAdded

VacationRequested

VacationApproved

LeaveRequested
```

---

# 26. FUTURE EXTENSIONS

Prepared for:

Payroll module.

Time tracking module.

Government integrations.

AI analytics.

Employee self-service portal.

---

# 27. DATABASE REVIEW CHECKLIST

Before implementation:

✔ Tenant isolation verified

✔ Relationships validated

✔ Indexes defined

✔ Audit fields included

✔ Security reviewed

✔ Historical data considered

✔ Future scalability considered

---

# 28. FINAL PRINCIPLE

The People Hub database must represent the reality of organizations and people.

A strong data foundation enables reliable processes, automation and intelligence.

===============================================================================

# END OF DOCUMENT