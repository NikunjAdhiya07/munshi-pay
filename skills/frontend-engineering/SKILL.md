---
name: frontend-engineering
description: Builds Munshi Pay screens with the design system and real data states. Use when adding or changing React pages, components, forms, or client data loading.
version: 0.1.0
updated: 2026-10-06
---

# Frontend engineering

Follow `payroll-ui-ux`, `responsive-mobile-ux`, `accessibility`, and `payroll-domain-ux`. This skill covers how the code is structured.

## Structure

- Routes compose screens. Screens load data and render states. Reusable controls stay in the design-system area once it exists.
- Do not fetch company data from a client component when a server component can load it.
- Keep server state in the server. Use client state for the open dialog, the filter draft, and the current input.
- Display values come from the server response. Do not recompute net pay in the browser except as a clearly labeled preview that the server will recalculate.

## Quality

- Every list has empty, loading, and error UI before it is considered done.
- Forms keep user input when validation fails.
- No mock payroll rows in a production path. A demo mode, if added later, must set the data-origin label from `payroll-domain-ux`.
- Match tokens in `skills/payroll-ui-ux/tokens.md`. Do not add one-off hex values in a component.

## Verification

For a changed screen, exercise the main path and one failure path. Check a phone width and a desktop width when layout is part of the change.
