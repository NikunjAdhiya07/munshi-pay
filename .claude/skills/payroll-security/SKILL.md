---
name: payroll-security
description: Protects salary, identity, and tenant data in Munshi Pay. Use when adding authentication, authorization, APIs, exports, file uploads, logging, environment variables, or any employee or pay data.
version: 0.1.0
updated: 2026-10-06
---

# Payroll security

Salary data is confidential. Treat every new path as closed until a server-side check opens it.

## Access

- Authenticate with server-side sessions. Do not store access tokens in localStorage.
- Authorize on the server for every read and mutation. Hiding a button is not authorization.
- Scope every company-owned query by the active company membership. Never trust a company id from the client without that check.
- Employees can read their own payslips. They cannot read other employees' pay.
- Consultancy-level roles do not bypass company scope unless the role matrix says so.

Initial roles, to be enforced when identity work starts: consultancy owner, consultant, company admin, payroll manager, HR, finance, employee. Record changes in `docs/decisions.md`.

## Secrets and input

- Do not commit `.env`, credentials, keys, or private certificates. Commit `.env.example` with names only.
- Do not log salary figures, government identifiers, bank account numbers, or session tokens.
- Validate and constrain inputs at the boundary. Reject unexpected fields.
- Rate-limit authentication and export endpoints when those endpoints exist.

## Payroll integrity

- Locking a run is an audited action: who, when, and the run id.
- Exports require the same permission as viewing the underlying pay data.
- Uploaded files stay outside the public web root. Validate type and size.

## Review

A security-sensitive task is not done until tenant isolation and the relevant role checks have a test, or the task is explicitly blocked on missing infrastructure.
