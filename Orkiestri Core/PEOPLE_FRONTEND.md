# ============================================================================
# ORKIESTRI MODULE
# DOCUMENT: PEOPLE_FRONTEND.md
# ============================================================================

Version: 1.0.0
Status: Official
Category: Frontend Architecture
Owner: Orkiestri Product Engineering

===============================================================================

> ⚠️ **CORRIGIDO POR `PEOPLE_ADDENDUM_2026-07-28.md` §2**
>
> Este documento aponta `/orkiestri-design-system` como autoridade visual (§1, §3,
> §20, §25). Aquela pasta é o brand book do **site institucional** — laranja, fundo
> branco, sem componentes. Não se aplica a telas de produto.
>
> A autoridade visual do produto é `frontend/src/styles/globals.css` e
> `frontend/src/components/data-ui.tsx`. Ver `docs/people/ADR-002`.

===============================================================================

# 1. PURPOSE

This document defines the official frontend architecture for People Hub.

The objective is to create a modern enterprise experience for:

- HR administrators
- HR analysts
- Managers
- Employees

The interface must follow:

/orkiestri-design-system

and all rules defined in:

FRONTEND.md

DESIGN_SYSTEM.md

---

# 2. FRONTEND PRINCIPLES

People Hub must provide:

- Simplicity
- Productivity
- Clear information hierarchy
- Modern SaaS experience
- Consistent Orkiestri identity

---

# 3. DESIGN SYSTEM REQUIREMENT

Before creating any interface:

AI assistants and developers MUST read:

```
/orkiestri-design-system

FRONTEND.md

DESIGN_SYSTEM.md
```

No new visual patterns may be created without approval.

---

# 4. UI/UX STANDARD

Frontend development must use:

UI/UX Pro Max Skill

for:

- Layout decisions
- Component selection
- UX patterns
- Responsive behavior
- Accessibility
- Visual hierarchy

---

# 5. PEOPLE HUB NAVIGATION

Official navigation:

```
People Hub

├── Dashboard

├── Employees

├── Organization

├── Documents

├── Benefits

├── Vacations

├── Leaves

├── Performance

├── Training

├── Requests

└── Reports
```

---

# 6. PEOPLE DASHBOARD

Purpose:

Provide HR overview.

---

Required indicators:

## Workforce

- Total employees
- Active employees
- New hires
- Departures

---

## Organization

- Employees by department
- Employees by position
- Management hierarchy

---

## Compliance

- Expiring documents
- Pending approvals
- Pending requests

---

## Development

- Training status
- Performance cycles

---

# 7. EMPLOYEE LIST PAGE

Must follow:

LIST_PAGE_BLUEPRINT.md

Required features:

Search.

Filters.

Sorting.

Pagination.

Export.

Actions.

---

Filters:

Status.

Department.

Position.

Employment type.

Manager.

---

Actions:

View profile.

Edit.

Change status.

Upload document.

Create request.

---

# 8. EMPLOYEE DETAIL PAGE

Must follow:

DETAIL_PAGE_BLUEPRINT.md

The employee profile is the central workspace.

---

Structure:

```
Employee Profile

├── Overview

├── Personal Information

├── Employment

├── Documents

├── Benefits

├── Vacations

├── Leaves

├── Training

├── Performance

├── Requests

└── History
```

---

# 9. EMPLOYEE OVERVIEW

Display:

Photo.

Name.

Position.

Department.

Manager.

Status.

Contact information.

Important alerts.

---

# 10. ORGANIZATION SCREEN

Purpose:

Visualize company structure.

Capabilities:

Department tree.

Hierarchy.

Managers.

Teams.

Positions.

---

# 11. DOCUMENTS SCREEN

Must support:

Document list.

Categories.

Expiration dates.

Upload.

Preview.

Approval.

History.

---

UX requirements:

Clear expiration alerts.

Status indicators.

Quick actions.

---

# 12. BENEFITS SCREEN

Capabilities:

View benefits.

Assign benefits.

Remove benefits.

Track history.

---

# 13. VACATION SCREEN

Capabilities:

Vacation balance.

Requests.

Approvals.

Calendar view.

History.

---

# 14. LEAVE SCREEN

Capabilities:

Create request.

Review documents.

Approve.

Reject.

Track status.

---

# 15. PERFORMANCE SCREEN

Capabilities:

Evaluation cycles.

Goals.

Feedback.

Results.

Development plans.

---

# 16. TRAINING SCREEN

Capabilities:

Courses.

Certifications.

Progress.

Expiration tracking.

---

# 17. REQUEST CENTER

Employee self-service area.

Examples:

Request document.

Request vacation.

Update information.

Submit HR requests.

---

# 18. FORM IMPLEMENTATION

All forms must follow:

FORM_BLUEPRINT.md

Required:

Validation.

Error handling.

Draft support when applicable.

Permission validation.

---

# 19. WORKFLOW VISUALIZATION

Workflow-based screens must show:

Current status.

Next action.

Responsible user.

Timeline.

History.

---

# 20. COMPONENT REQUIREMENTS

Use components from:

/orkiestri-design-system

Examples:

Tables.

Cards.

Forms.

Dialogs.

Badges.

Tabs.

Timeline.

Charts.

---

# 21. RESPONSIVE DESIGN

Supported:

Desktop.

Tablet.

Mobile.

---

Mobile behavior:

Navigation adaptation.

Card-based lists.

Optimized forms.

Touch-friendly actions.

---

# 22. ACCESSIBILITY

Required:

Keyboard navigation.

Readable labels.

Proper contrast.

Screen reader support.

Clear focus states.

---

# 23. FRONTEND STATES

Every screen must implement:

Loading state.

Empty state.

Error state.

Success feedback.

Permission denied state.

---

# 24. PERFORMANCE

Frontend must consider:

Lazy loading.

Component optimization.

Pagination.

Caching.

Optimized API requests.

---

# 25. AI ASSISTED FRONTEND DEVELOPMENT

Before generating code, AI MUST:

1. Read MASTER.md

2. Read FRONTEND.md

3. Read DESIGN_SYSTEM.md

4. Read PEOPLE_HUB_BLUEPRINT.md

5. Read PEOPLE_API.md

6. Inspect:

/orkiestri-design-system

7. Apply UI/UX Pro Max Skill

---

# 26. FRONTEND QUALITY CHECKLIST

Before approval:

✔ Design System followed

✔ UX validated

✔ Responsive tested

✔ Permissions applied

✔ Accessibility considered

✔ Performance reviewed

✔ States implemented

✔ Components reused

---

# 27. FINAL PRINCIPLE

People Hub frontend must make human management simple.

The interface should transform complex HR processes into clear, intelligent and productive experiences.

===============================================================================

# END OF DOCUMENT