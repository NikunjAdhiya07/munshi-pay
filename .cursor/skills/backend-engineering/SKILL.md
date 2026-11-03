---
name: backend-engineering
description: Implements Munshi Pay server behavior, validation, and use cases. Use when adding server actions, route handlers, domain services, or background payroll jobs.
version: 0.1.0
updated: 2026-10-06
---

# Backend engineering

The application is a modular monolith. Domain code does not import the web framework or the database client.

## Shape

- `domain`: pure functions and types. Money in, money out.
- `server`: use cases that authorize, open a transaction, call the domain, and persist.
- Route handlers and server actions parse input, call one use case, and map the result to an HTTP or form response.

## Behavior

- Validate at the boundary. The domain may assume validated input and still reject illegal states such as a locked run.
- Return structured errors: validation, forbidden, not found, conflict. Do not leak SQL or stack traces to the client.
- Authorization happens in the use case, not only in the page.
- Writes that can be retried (create run, post calculation) have an idempotency key or a natural unique constraint.
- Long calculations go to a job once the job mechanism exists. Until then, do not pretend a synchronous loop is a background worker.

## Logging

Log the action, actor, company id, and record id. Do not log pay amounts or government identifiers.
