---
name: database-engineering
description: Designs Munshi Pay persistence for tenant isolation, money integrity, and migrations. Use when changing schema, queries, indexes, or migrations.
version: 0.1.0
updated: 2026-10-06
---

# Database engineering

PostgreSQL is the selected database. Drizzle is the selected schema and migration tool. Neither is installed until the persistence phase.

## Rules

- Money is `bigint` minor units. Never `float` or `double precision` for pay.
- Every company-owned table includes `company_id` and is queried with it.
- Unique keys include `company_id` when the natural key (employee code, period) is unique per company.
- Payroll run lines snapshot the inputs used. Later edits to a salary structure do not rewrite a locked run.
- Migrations are forward-only and reviewed. Do not edit a migration that has been applied anywhere shared.
- Add the index that matches the list query before building a screen that will page through employees or runs.

## Integrity

- Use a transaction for a run that writes many lines.
- Foreign keys point at the parent inside the same company. Do not cascade-delete a locked payroll run.
- Soft-delete people if they have payroll history. Hard-delete is for records that were never used.

## Local development

Do not invent a hosted database URL. When persistence starts, document the local connection in `.env.example` and keep real URLs in untracked `.env`.
