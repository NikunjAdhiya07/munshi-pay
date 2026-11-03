---
name: performance-engineering
description: Keeps Munshi Pay responsive with large employee and payroll datasets. Use when writing queries, APIs, tables, reports, payroll runs, or client rendering.
version: 0.1.0
updated: 2026-10-06
---

# Performance

Do not hide a slow query behind a loading animation and call it done.

## Data access

- List endpoints are paginated. Default page size is bounded (25–50). Reject unbounded exports on the interactive request path.
- Filter and search in the database, not by loading a company into memory.
- Index the access path you actually query, typically company id plus the record's natural key or period.
- Select the columns the screen needs. Salary history does not belong on an employee name search.

## Payroll runs

- A run over many employees is a job with visible progress, not a single request that holds the page open until completion.
- Calculation stays in the pure engine. Persistence is batched.
- Re-running a draft replaces that draft's results. It does not rewrite a locked run.

## Client

- Code-split route-level screens.
- Virtualize or paginate tables past a short page. Do not mount thousands of rows.
- Charts plot aggregated points, not one mark per employee, unless the user drilled into a small set.

## Evidence

Record the query shape or the page size in the task output when a change is specifically about performance. Guessing that an index "might help" is not a completed optimization.
