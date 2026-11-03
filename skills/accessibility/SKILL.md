---
name: accessibility
description: Builds Munshi Pay to WCAG 2.2 AA. Use when creating UI, forms, dialogs, tables, charts, navigation, or focus behavior.
version: 0.1.0
updated: 2026-10-06
---

# Accessibility

Target WCAG 2.2 AA while building, not as a later pass.

## Required

- Use semantic elements: `button`, `a`, `nav`, `main`, `table`, `label`, headings in order.
- Every input has a visible label associated with it. Placeholder text is not a label.
- Errors are text tied to the field with `aria-describedby` or the equivalent, and the form summary is reachable.
- Focus is visible on the accent or ink outline. Do not remove outlines without a replacement.
- Keyboard order matches the visual order. Dialogs trap focus and restore it to the opener. Escape closes non-destructive dialogs.
- Status is not color alone. Include the status word.
- Tables have a caption or an accessible name, and header cells use `scope` or `th`.
- Charts have a text alternative: a table or a one-sentence summary of the figures.
- Contrast for text and for meaningful UI boundaries meets AA. Check muted ink on paper before using it at small sizes.
- Respect `prefers-reduced-motion`. Operational UI should already avoid motion beyond 200ms.

## Payroll specifics

- Money figures are text, not images.
- Icon-only controls have an accessible name ("Void run", not "times icon").
- The company and period switchers are reachable by keyboard and announce the current value.
