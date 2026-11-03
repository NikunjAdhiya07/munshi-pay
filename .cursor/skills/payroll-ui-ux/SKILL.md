---
name: payroll-ui-ux
description: Designs the Munshi Pay payroll product as a dense, trustworthy enterprise interface. Use when creating or changing pages, layouts, visual design, dashboards, tables, forms, status indicators, or design tokens.
version: 0.1.0
updated: 2026-10-06
---

# Payroll UI

The product should feel like payroll software used by consultants, HR, and finance: accurate, quiet, and fast to scan. Clarity over decoration.

Read [tokens.md](tokens.md) before inventing color, type, or spacing.

## Adapted from

Principles were adapted for payroll, not copied, from UIX `lucid-ui` (restraint, one accent, borders over decoration), saas-ui-skills (tables, forms, and explicit states), and cursor-designer (hierarchy, stable noun labels, WCAG as a default).

## Hierarchy

- One primary action per view. Secondary actions are quiet.
- Page title, then context (company, period), then the working surface.
- Numbers align right. Labels and names align left. Status is a word plus a color, never color alone.
- Prefer a table or definition list over a card grid when the user is comparing records.

## Density

- Table row height about 36–40px on desktop. Do not pad operational screens like a marketing page.
- Section gaps inside the app shell are 16–24px, not 96px.
- Cards are for a single object (one employee, one run). A list of employees is a table.

## Money and status

- Format money with the locale recorded for that company. Align on the decimal. Use tabular numerals.
- Show gross, deductions, and net as separate labeled figures. Do not rely on red to mean "deduction."
- Payroll run states use the words in `payroll-domain-ux`: Draft, Calculated, In review, Approved, Locked, Paid, Void.
- Every screen that can show sample numbers must label the data origin: Real, Demo, or Mock. Never present mock payroll figures as real.

## States

Every data view ships with empty, loading, error, and success behavior:

- Empty: say what is missing and the one action that creates it.
- Loading: reserve the same layout the data will occupy.
- Error: name the failure and the recovery. Keep entered form data.
- Success: confirm the completed action in text. Do not celebrate with a full-screen animation.

## Forbidden

- Purple, violet, or fuchsia as a brand color. Gradient buttons. Glassmorphism. Decorative blobs.
- `rounded-3xl` on panels. More than one accent hue. Animation longer than 200ms on operational UI.
- Giant KPI tiles with no period, company, or data-origin label.
- Icon-only primary actions without an accessible name.

## Forms

- Label above the control. Helper text under the label or under the field, error under the field.
- Group compensation fields in the order users calculate: earnings, deductions, gross, net.
- Destructive actions (void, unlock) require a named confirmation that states the consequence.
