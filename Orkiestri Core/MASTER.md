# Orkiestri Core
# MASTER.md

Version: 1.0.0
Status: Official
Priority: CRITICAL

---

# Purpose

This document defines the mandatory engineering, architecture, design and development standards of the Orkiestri ecosystem.

Every AI assistant, software engineer, designer and technical contributor MUST read and understand this document before making any modification to the project.

No implementation may violate the rules defined here.

This document is the highest authority within the Orkiestri Core.

---

# Golden Rule

Never write code before understanding the project.

Before implementing any feature you MUST:

- Read the project documentation.
- Understand the current architecture.
- Identify reusable components.
- Identify reusable services.
- Identify reusable APIs.
- Identify reusable database entities.
- Identify existing design patterns.
- Identify existing workflows.
- Identify existing permissions.
- Understand module dependencies.

Only after completing this analysis may implementation begin.

---

# Engineering Philosophy

Software is a long-term asset.

Every implementation must prioritize:

- Maintainability
- Scalability
- Readability
- Performance
- Security
- Modularity
- Testability
- Documentation

Fast code that becomes technical debt is considered a failure.

---

# Product Philosophy

The Orkiestri platform exists to simplify business operations.

Every feature must solve a real business problem.

Never implement functionality because it is technically interesting.

Every screen must have a measurable business purpose.

---

# AI Development Rules

Artificial Intelligence is an engineering accelerator.

It is never allowed to:

- invent architecture
- duplicate logic
- ignore existing components
- bypass documentation
- create inconsistent interfaces
- violate naming conventions
- generate unfinished code

Whenever uncertainty exists:

Stop.

Analyze.

Document.

Then continue.

---

# Read Before Coding

Before starting any task the AI must read:

VISION.md

PROJECT_CONTEXT.md

CURRENT_STATE.md

MASTER.md

Relevant architecture documents

Relevant engineering documents

Relevant product documentation

Current module documentation

Never skip documentation.

---

# Documentation First

Documentation is part of the implementation.

Every architectural decision must update:

Documentation

Diagrams

Roadmaps

Decision records

Change logs

---

# Reuse First

Before creating:

Component

API

Service

Hook

Context

Utility

Database table

Repository

Validator

Search for an existing implementation.

Reuse whenever possible.

---

# No Duplication

Code duplication is prohibited.

Business rule duplication is prohibited.

Interface duplication is prohibited.

Database duplication is prohibited.

If duplication is detected:

Refactor first.

Implement later.

---

# Modular Architecture

Each module must be independent.

Modules communicate through services, APIs or events.

Never create tight coupling between products.

---

# Database Principles

The database is a strategic asset.

All tables must support:

Multi-tenancy

Soft Delete

Auditing

Timestamps

Versioning when necessary

Indexes

Foreign Keys

Constraints

Data consistency always has priority over convenience.

---

# API Principles

Every API must be:

Predictable

Documented

Versioned

Secure

Validated

Observable

Testable

---

# Frontend Principles

Interfaces must be:

Fast

Simple

Responsive

Accessible

Consistent

Reusable

Elegant

Use the existing Design System.

Never create isolated visual styles.

---

# UX Principles

The interface must reduce cognitive load.

Every page must answer:

What is happening?

What can I do?

What should I do next?

Good UX is invisible.

---

# Security Principles

Security is mandatory.

Every implementation must consider:

Authentication

Authorization

Encryption

Audit

Rate limiting

Validation

Input sanitization

OWASP recommendations

LGPD compliance

---

# Performance Principles

Measure before optimizing.

Optimize before scaling.

Avoid unnecessary rendering.

Avoid unnecessary database queries.

Prefer caching whenever appropriate.

Lazy load expensive resources.

---

# Logging

Every important operation must generate logs.

Logs should help answer:

Who?

When?

Where?

What changed?

Why?

---

# Auditing

Critical operations must be auditable.

Every important change should record:

User

Tenant

Timestamp

Previous value

New value

Operation

---

# Testing

Every feature should include:

Unit Tests

Integration Tests

End-to-End Tests when applicable

Regression Tests

Never release untested critical functionality.

---

# Code Review Checklist

Before considering any task complete verify:

Architecture respected

Documentation updated

No duplicated code

No duplicated components

Performance acceptable

Security validated

Permissions validated

Tests executed

Responsive interface

Accessibility respected

No TODO comments

No unfinished code

---

# Definition of Done

A feature is only complete when:

Business rules implemented

Documentation updated

Tests passing

Permissions configured

Logs implemented

Auditing implemented

Responsive layout complete

Performance validated

Accessibility verified

Integration tested

No known critical issues remain.

---

# Continuous Improvement

The Orkiestri platform is a living product.

Every implementation should leave the project better than it was before.

Whenever an improvement opportunity is identified:

Document it.

Discuss it.

Implement it when appropriate.

---

# Final Rule

Never optimize for speed at the expense of quality.

The objective is not to write more code.

The objective is to build one of the best enterprise platforms possible.