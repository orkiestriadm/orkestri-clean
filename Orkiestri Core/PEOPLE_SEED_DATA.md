# ============================================================================
# ORKIESTRI MODULE
# DOCUMENT: PEOPLE_SEED_DATA.md
# ============================================================================

Version: 1.0.0
Status: Official
Category: Development Data Architecture
Owner: Orkiestri Product Engineering

===============================================================================

# 1. PURPOSE

This document defines the initial seed data required for People Hub development, testing and demonstration environments.

The objective is to create realistic scenarios for:

- Development.
- Quality assurance.
- Product demonstration.
- Automated testing.

---

# 2. SEED DATA PRINCIPLES

Seed data must:

- Represent realistic business scenarios.
- Respect tenant isolation.
- Follow security rules.
- Avoid real personal information.
- Support workflow testing.

---

# 3. DEMO TENANT

Create default demonstration tenant:

```
Tenant Name:

Orkiestri Demo Corporation


Industry:

Technology Services


Size:

Medium Enterprise


Employees:

150
```

---

# 4. ORGANIZATIONAL STRUCTURE

Create:

```
Executive Board

├── Technology Department

├── Human Resources Department

├── Finance Department

├── Operations Department

├── Sales Department

└── Customer Success Department
```

---

# 5. DEPARTMENTS

## Technology

Code:

TECH


Manager:

CTO


---

## Human Resources

Code:

HR


Manager:

HR Director


---

## Finance

Code:

FIN


Manager:

Finance Manager


---

## Operations

Code:

OPS


Manager:

Operations Manager


---

## Sales

Code:

SALES


Manager:

Sales Manager


---

# 6. POSITIONS

Create default positions:

## Executive

CEO

CTO

CFO

HR Director


---

## Technology

Software Engineer

Senior Software Engineer

DevOps Engineer

Systems Analyst

IT Coordinator


---

## Human Resources

HR Analyst

HR Assistant

Recruiter


---

## Finance

Financial Analyst

Accountant


---

## Sales

Sales Representative

Account Executive

---

# 7. TEST USERS

Create users:

---

## Administrator

Name:

System Administrator


Role:

TENANT_ADMIN


Email:

admin@demo.orkiestri.com


---

## HR Administrator

Name:

Maria Oliveira


Role:

HR_ADMIN


Department:

Human Resources


---

## HR Analyst

Name:

Ana Santos


Role:

HR_ANALYST


Department:

Human Resources


---

## Manager

Name:

Carlos Mendes


Role:

MANAGER


Department:

Technology


---

## Employee

Name:

João Silva


Role:

EMPLOYEE


Department:

Technology


---

# 8. EMPLOYEE DATA SET

Create employees with different scenarios:

---

## Active Employee

Status:

ACTIVE

Scenario:

Normal employee profile.


---

## New Employee

Status:

ACTIVE

Scenario:

Recently onboarded employee.


---

## Employee On Leave

Status:

ON_LEAVE

Scenario:

Testing leave workflow.


---

## Terminated Employee

Status:

TERMINATED

Scenario:

Testing historical records.


---

# 9. EMPLOYEE DOCUMENTS

Create examples:

## Valid Documents

- Identity document
- Employment contract
- Certification


---

## Expiring Documents

Expiration:

30 days


Purpose:

Test notification system.


---

## Expired Documents

Status:

Expired


Purpose:

Test compliance alerts.

---

# 10. BENEFITS DATA

Create benefits:

```
Health Insurance

Meal Allowance

Transportation Assistance

Life Insurance

Gym Partnership
```

---

# 11. EMPLOYEE BENEFIT ASSIGNMENTS

Examples:

Employee A:

Health Insurance

Meal Allowance


Employee B:

Transportation Assistance


---

# 12. VACATION DATA

Create scenarios:

---

## Pending Approval

Status:

SUBMITTED


---

## Approved Vacation

Status:

APPROVED


---

## Completed Vacation

Status:

COMPLETED


---

# 13. LEAVE DATA

Create scenarios:

```
Medical Leave

Personal Leave

Training Leave
```

---

# 14. TRAINING DATA

Create courses:

```
Leadership Development

Information Security Awareness

Cloud Fundamentals

Agile Methodology
```

---

# 15. PERFORMANCE DATA

Create:

Evaluation cycle:

2026 Annual Review


Statuses:

```
OPEN

IN_PROGRESS

COMPLETED
```

---

# 16. REQUEST CENTER DATA

Create requests:

```
Employment Declaration Request

Document Update Request

Benefit Request

Information Change Request
```

---

# 17. WORKFLOW TEST SCENARIOS

The seed environment must allow testing:

---

## Vacation Approval

Employee submits request.

Manager approves.

HR validates.

Status completed.

---

## Document Approval

Employee uploads document.

HR reviews.

Document approved.

---

## Employee Update

Employee requests change.

HR approves.

History generated.

---

# 18. REPORTING DATA

Generate enough records for testing:

```
Employees:

150


Departments:

6


Positions:

25


Documents:

300


Requests:

100
```

---

# 19. AUTOMATED TEST DATA

Create predictable identifiers:

Example:

```
EMP-00001

EMP-00002

EMP-00003
```

---

# 20. DATA PRIVACY

Seed data must:

- Never contain real personal information.
- Use fictional names.
- Use test emails.
- Never represent real individuals.

---

# 21. RESET PROCEDURE

Development environments must support:

Reset database.

Reload seed.

Recreate workflows.

Restore permissions.

---

# 22. ACCEPTANCE CRITERIA

Seed implementation is approved when:

✔ Users can login

✔ Roles work

✔ Employees exist

✔ Workflows execute

✔ Reports display data

✔ Permissions are validated

✔ Notifications can be tested

---

# 23. FINAL PRINCIPLE

Seed data transforms software into an executable product environment.

A complete module is not only code.

It is code, data, processes and realistic scenarios.

===============================================================================

# END OF DOCUMENT