---
name: architecture
description: Preserves Munshi Pay module boundaries and records structural decisions. Use when adding a module, choosing a library, or changing how payroll data flows.
version: 0.2.0
updated: 2026-10-07
---

# Architecture

Read `docs/architecture.md` and `docs/decisions.md` before changing structure.

## Current shape

Modular monolith on Next.js with nine bounded contexts (DEC-015). `docs/architecture.md` lists the modules each context owns.

- Domain logic in `src/domain` stays pure and imports only other domain modules.
- Each context has a module in `src/server` that takes the store and the company id, validates, and enforces the lock. Server actions call one of these functions and redirect.
- Screens read and display. They write only through server actions. Client components import nothing from `src/server`.
- Only `payroll.ts` calls the pay engine, and payroll owns the month lock. Other contexts ask `isLocked` before writing month data.
- Company id is the isolation key inside a consultancy account.

`src/server/architecture.test.ts` checks the layer rules. A new module that needs an exception changes that test and DEC-015 together.

## Rules

- Do not add a service, queue, or second application until a decision explains the operational need.
- Do not put calculation formulas in React components or SQL.
- Put a new rule in the owning context's server module, not in `actions.ts` or a page.
- A new library requires a decision or a one-line note in `docs/tech-stack.md` with status Selected or Installed.
- Statutory behavior is a jurisdiction adapter. The first planned adapter is India, and its formulas are not written until policy and tests exist.

## Dependencies

Do not start a task whose `dependencies` in `board/state.json` are incomplete, unless the work can be tested without those dependencies and the shortcut is written into the task output.
