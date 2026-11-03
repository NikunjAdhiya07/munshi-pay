---
name: code-review
description: Reviews Munshi Pay changes for correctness, tenant safety, payroll risk, and tests. Use when reviewing a task before marking it done or when asked for a code review.
version: 0.1.0
updated: 2026-10-06
---

# Code review

Review the diff against the task, not against a generic checklist only.

## Blockers

- Pay math changed without tests or a decision note.
- A query can return another company's rows.
- Authorization exists only in the UI.
- Secrets, `.env`, or sample salary data presented as real.
- A task marked done with no passing test record.
- Generated board files edited by hand.

## Also check

- Inputs validated at the boundary.
- Empty, error, and loading states for new UI.
- Focus, labels, and status text for new controls.
- Migrations are forward-only and money columns are integers.
- The change matches the task and does not pull the next phase forward without a reason.

Write review notes in the task `output` field. If the review fails, set the task back to TODO or BLOCKED and say why.
