---
name: payroll-domain-ux
description: Uses payroll language and run states correctly in the Munshi Pay interface. Use when naming screens, fields, statuses, payslips, salary structures, or any compensation workflow.
version: 0.1.0
updated: 2026-10-06
---

# Payroll domain UX

Build only the modules that exist in the current phase. Do not add statutory fields, tax forms, or attendance grids because they are common in payroll products.

## Vocabulary

Use these nouns in navigation and labels. Prefer the plain term.

| Term | Meaning in this product |
| --- | --- |
| Consultancy | The firm using Munshi Pay |
| Company | A client whose payroll the consultancy runs |
| Employee | A person paid by that company |
| Salary structure | Versioned earnings and deductions for one employee |
| Earning | An amount that increases gross pay |
| Deduction | An amount withheld from gross pay |
| Gross | Earnings after structure rules, before employee deductions |
| Net | Amount payable to the employee for the period |
| CTC | Annual cost to company. Show it only where the structure defines it. Do not invent a CTC formula in the UI. |
| Payroll period | The dated interval being paid, shown as dates |
| Payroll run | One calculation of a period for a company |
| Payslip | The employee-facing result of a run line |

Say "1 Apr 2026 – 30 Apr 2026", not "Period 4".

## Run states

Draft → Calculated → In review → Approved → Locked → Paid, or Void from Draft, Calculated, or In review.

- Locked and Paid figures are read-only in the UI.
- Void states the reason and who voided it.
- Do not offer a delete action for a locked run.

## Money display

- Store and calculate in integer minor units. The UI converts for display.
- Show the currency code when more than one currency could appear.
- Line items list earnings, then deductions, then gross and net.
- A negative earning is an adjustment and is labeled Adjustment. Do not silently fold it into deductions.

## Data origin

If a figure is not from a persisted payroll run, badge it Demo or Mock. Real data has no badge, or the word Real in audit and export views.

## What not to assume

Attendance, leave, overtime, bonuses, incentives, declarations, and statutory schemes (for example PF, ESI, professional tax, TDS) appear in the UI only after that module is in `board/state.json` and its formula is covered by tests. Until then, omit the fields.
