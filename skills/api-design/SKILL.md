---
name: api-design
description: Designs Munshi Pay HTTP and server-action contracts. Use when adding endpoints, request or response shapes, pagination, or error formats.
version: 0.1.0
updated: 2026-10-06
---

# API design

Prefer server actions for UI mutations. Add an HTTP route when a non-UI client or a job needs it. Both paths call the same use case.

## Contracts

- Resources are nouns: `/companies/{companyId}/employees`, `/payroll-runs`.
- Lists accept pagination and return `{ items, page, pageSize, total }` or a cursor with a documented end. Pick one style per resource and keep it.
- Create and calculate operations that may be retried accept an idempotency key.
- Errors use a stable code: `validation_error`, `forbidden`, `not_found`, `conflict`. Field errors name the field.
- Responses include only fields the caller's role may see. An employee payslip is not a full run payload.

## Changes

Document a new or breaking contract in `docs/api.md` when that file exists. Until then, note the contract in the task output and add the doc as part of the task that introduces the first public route.

Do not version the URL until an external consumer exists.
