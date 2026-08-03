# ============================================================================
# ORKIESTRI MODULE
# DOCUMENT: PEOPLE_PERMISSIONS.md
# ============================================================================

Version: 1.0.0
Status: Official
Category: Security and Authorization Architecture
Owner: Orkiestri Product Engineering

===============================================================================

# 1. PURPOSE

This document defines the authorization model for People Hub.

The objective is to guarantee:

- Secure access.
- Data privacy.
- Business segregation.
- LGPD compliance.
- Controlled operations.

---

# 2. SECURITY MODEL

People Hub uses:

RBAC (Role Based Access Control)

combined with:

ABAC (Attribute Based Access Control)

---

# 3. ACCESS PRINCIPLE

Every request must validate:

```
WHO

+

WHAT

+

WHERE

+

WHICH DATA
```

---

Example:

A manager can:

View employees.

Approve vacations.

But only for:

Employees belonging to their management scope.

---

# 4. STANDARD ROLES

Initial roles:

```
SYSTEM_ADMIN

TENANT_ADMIN

HR_ADMIN

HR_ANALYST

MANAGER

EMPLOYEE

AUDITOR
```

---

# 5. SYSTEM ADMIN

Purpose:

Platform administration.

Permissions:

Full technical access.

Restrictions:

Should not access business data without explicit authorization.

---

# 6. TENANT ADMIN

Purpose:

Company administrator.

Permissions:

Manage company configuration.

Manage users.

Configure module settings.

---

# 7. HR ADMIN

Purpose:

Complete People Hub administrator.

Permissions:

Employee management.

Documents.

Benefits.

Requests.

Reports.

Workflows.

---

# 8. HR ANALYST

Purpose:

Operational HR user.

Permissions:

Employee registration.

Document management.

Request processing.

Reports.

Restrictions:

Limited configuration access.

---

# 9. MANAGER

Purpose:

Leadership user.

Permissions:

View team members.

Approve workflows.

Access team indicators.

Create evaluations.

Restrictions:

No access to unrelated departments.

---

# 10. EMPLOYEE

Purpose:

Self-service user.

Permissions:

View own profile.

Request services.

Upload allowed documents.

View own history.

Restrictions:

Cannot view other employees.

---

# 11. AUDITOR

Purpose:

Compliance and review.

Permissions:

Read-only access.

Audit visibility.

Reports.

Restrictions:

No modification.

---

# 12. PERMISSION NAMING STANDARD

Format:

```
module.entity.action
```

Example:

```
people.employee.view

people.employee.create

people.employee.update

people.employee.delete
```

---

# 13. EMPLOYEE PERMISSIONS

Available permissions:

```
people.employee.view

people.employee.create

people.employee.update

people.employee.delete

people.employee.export

people.employee.status.update
```

---

# 14. DOCUMENT PERMISSIONS

```
people.document.view

people.document.upload

people.document.update

people.document.delete

people.document.approve

people.document.export
```

---

# 15. BENEFIT PERMISSIONS

```
people.benefit.view

people.benefit.create

people.benefit.assign

people.benefit.remove
```

---

# 16. VACATION PERMISSIONS

```
people.vacation.view

people.vacation.request

people.vacation.approve

people.vacation.reject

people.vacation.cancel
```

---

# 17. PERFORMANCE PERMISSIONS

```
people.performance.view

people.performance.create

people.performance.evaluate

people.performance.approve
```

---

# 18. REQUEST CENTER PERMISSIONS

```
people.request.create

people.request.view

people.request.process

people.request.close
```

---

# 19. FIELD LEVEL SECURITY

Sensitive fields must support field permissions.

Examples:

Salary information.

Personal documents.

Medical information.

Performance scores.

---

# 20. DATA VISIBILITY RULES

## HR Admin

Can view:

All employees.

---

## HR Analyst

Can view:

Configured organizational scope.

---

## Manager

Can view:

Direct and indirect reports.

---

## Employee

Can view:

Own information only.

---

# 21. LGPD DATA CLASSIFICATION

Information categories:

## Public

Example:

Name.

Position.

Department.

---

## Internal

Example:

Employee code.

Organization data.

---

## Confidential

Example:

Benefits.

Employment information.

---

## Restricted

Example:

Documents.

Personal identifiers.

Medical information.

---

# 22. AUDIT REQUIREMENTS

Every sensitive action must generate audit:

User.

Action.

Date.

Entity.

Field changed.

Previous value.

New value.

---

# 23. EXPORT CONTROL

Exports require:

Permission.

Audit.

Reason.

Tenant validation.

---

# 24. IMPERSONATION RULES

Administrators may impersonate users only when:

- Explicitly authorized.
- Logged.
- Audited.

---

# 25. API SECURITY

Every API request must validate:

Authentication.

Authorization.

Tenant.

Resource ownership.

Field permissions.

---

# 26. FRONTEND SECURITY

The frontend must:

Hide unavailable actions.

Protect restricted fields.

Display permission errors.

Never rely only on UI restrictions.

---

# 27. DEFAULT ROLE MATRIX

| Permission | HR Admin | HR Analyst | Manager | Employee |
|---|---|---|---|---|
| View Employees | Full | Limited | Team | Own |
| Edit Employees | Yes | Limited | No | Own Requests |
| Documents | Full | Operational | Team Docs | Own |
| Vacation Approval | Yes | Yes | Team | Request |
| Reports | Full | Limited | Team | Own |

---

# 28. FUTURE EVOLUTION

Prepared for:

Custom roles.

Dynamic policies.

AI access assistant.

Advanced compliance.

---

# 29. REVIEW CHECKLIST

Before production:

✔ Roles created

✔ Permissions mapped

✔ Sensitive fields classified

✔ Audit implemented

✔ LGPD reviewed

✔ Tenant isolation validated

✔ API protection validated

---

# 30. FINAL PRINCIPLE

Security in People Hub is not about blocking access.

It is about providing the right information to the right person at the right moment.

===============================================================================

# END OF DOCUMENT