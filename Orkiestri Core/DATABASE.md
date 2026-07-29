# ============================================================================
# ORKIESTRI CORE
# DOCUMENT: DATABASE.md
# ============================================================================

Version: 1.0.0
Status: Official
Category: Architecture
Owner: Orkiestri Engineering

---

# 1. PURPOSE

This document defines the official database architecture standards for the Orkiestri ecosystem.

Every entity, migration, relationship and query MUST follow this specification.

No database implementation may violate this document.

---

# 2. DATABASE PHILOSOPHY

The database is a strategic asset.

Business rules belong to the application layer.

The database guarantees:

- Data consistency
- Referential integrity
- Performance
- Auditability
- Recoverability

Never duplicate business information.

Every piece of data must have a single source of truth.

---

# 3. DATABASE ENGINE

Current Standard

PostgreSQL

ORM

Prisma ORM

Future compatibility:

- PostgreSQL Cluster
- Amazon Aurora PostgreSQL
- Azure PostgreSQL
- Google Cloud SQL

No database-specific feature should prevent migration between PostgreSQL-compatible providers.

---

# 4. NAMING CONVENTIONS

Tables

snake_case

Examples

employees

employee_documents

vacation_requests

workflow_instances

Columns

snake_case

Examples

created_at

updated_at

tenant_id

first_name

Indexes

idx_<table>_<column>

Example

idx_employee_email

Unique Indexes

uq_<table>_<column>

Foreign Keys

fk_<table>_<reference>

Primary Keys

pk_<table>

---

# 5. PRIMARY KEYS

Every table MUST use UUID.

Never use auto increment identifiers.

Pattern

id UUID PRIMARY KEY

---

# 6. REQUIRED COLUMNS

Every business table MUST contain:

id

tenant_id

created_at

updated_at

deleted_at

created_by

updated_by

version

status

If applicable:

deleted_by

archived_at

---

# 7. MULTI TENANCY

Every business entity belongs to exactly one tenant.

No shared business data.

Every query MUST filter by tenant.

Cross-tenant access is forbidden.

---

# 8. SOFT DELETE

Physical deletion is prohibited.

Records must use:

deleted_at

deleted_by

Application logic determines visibility.

---

# 9. AUDIT

Critical entities must support auditing.

Track:

Old Value

New Value

User

Timestamp

Tenant

Operation

Reason (optional)

---

# 10. VERSIONING

Entities requiring history must implement optimistic versioning.

Column:

version

Increment on every update.

---

# 11. ENUMS

Use PostgreSQL enums only for stable values.

Examples

EmployeeStatus

TicketPriority

TicketStatus

InvoiceStatus

Avoid enums for values frequently modified by customers.

---

# 12. FOREIGN KEYS

Always create explicit foreign keys.

Never rely on application logic only.

Relationships must guarantee integrity.

---

# 13. INDEXES

Every foreign key must be indexed.

Every search field must be indexed.

Every unique field must be indexed.

Composite indexes should support common queries.

---

# 14. UNIQUE CONSTRAINTS

Examples

Email

CPF

Document Number

Registration Number

Only when uniqueness is required within the tenant.

---

# 15. JSON COLUMNS

JSON is allowed only when:

Structure changes frequently.

Data is not relational.

Configuration storage.

Metadata.

Never replace relational modeling with JSON.

---

# 16. FILE STORAGE

Never store files inside the database.

Store only metadata.

Example

document_id

file_name

mime_type

extension

size

checksum

storage_provider

storage_key

url

---

# 17. HISTORY TABLES

Important entities may have history tables.

Example

employee_history

salary_history

permission_history

workflow_history

---

# 18. QUERY STANDARDS

Queries must:

Use indexes.

Avoid SELECT *.

Support pagination.

Support ordering.

Support filtering.

Avoid N+1 queries.

Prefer joins over repetitive queries.

---

# 19. PAGINATION

Default pagination:

Limit

Offset

Future support:

Cursor Pagination

---

# 20. MIGRATIONS

Every migration must be:

Atomic

Reversible whenever possible

Documented

Reviewed

Never modify production data manually.

---

# 21. SEEDS

Seed files must create:

Default Roles

Permissions

System Settings

Default Modules

Initial Configuration

Never include customer data.

---

# 22. BACKUP

Support:

Daily backup

Point-in-Time Recovery

Disaster Recovery

Integrity verification

---

# 23. PERFORMANCE

Avoid:

Long transactions

Full table scans

Repeated joins

Duplicate indexes

Unused indexes

Measure before optimization.

---

# 24. SECURITY

Sensitive fields should support encryption.

Passwords are never stored.

Only hashes.

Secrets must never be stored in plaintext.

---

# 25. LGPD

Personal data must support:

Export

Anonymization

Retention policy

Deletion workflow

Audit

Consent when applicable.

---

# 26. DOCUMENTATION

Every table must contain:

Purpose

Relationships

Business owner

Lifecycle

Dependencies

Indexes

Constraints

---

# 27. DATABASE REVIEW CHECKLIST

Before approval verify:

✔ Naming standard

✔ UUID

✔ Multi Tenant

✔ Soft Delete

✔ Audit

✔ Indexes

✔ Foreign Keys

✔ Constraints

✔ Documentation

✔ Performance

✔ Security

✔ LGPD

---

# END OF DOCUMENT