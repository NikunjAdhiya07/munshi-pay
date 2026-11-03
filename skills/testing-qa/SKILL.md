---
name: testing-qa
description: Tests Munshi Pay before a task is marked done, with extra rigor for payroll math. Use when implementing, fixing, or reviewing any feature, calculation, API, or UI flow.
version: 0.1.0
updated: 2026-10-06
---

# Testing and QA

A task is done only when it is implemented, tested, reviewed, and wired into the real flow. A file existing is not done.

## Before DONE

- The project typecheck, lint, and relevant automated tests pass.
- A passing record is added to that task's `tests` array in `board/state.json`, then `npm run board` is run.
- Failed tests move the task to TODO if the fix is known, or BLOCKED if an external dependency failed. Do not leave a failing task in REVIEW.

## By layer

- Pure domain code, especially money: unit tests, including rounding boundaries.
- Queries and permissions: integration tests against the real schema when the database exists.
- UI: cover empty, loading, error, and the primary success path. Include a narrow viewport check for screens that change layout.
- Payroll formulas: table-driven cases. Add a regression case for every bug. Do not change expected money values to make a test pass.

## Payroll changes

Any edit to gross, net, rounding, proration, or a statutory adapter requires tests and a note in `docs/decisions.md` or the payroll engine doc. Correctness outranks speed.

## What this repository runs today

`npm test` runs the execution-board tests. Application test runners are added in the foundation phase. Use the runner that exists; do not invent results for a runner that is not installed.
