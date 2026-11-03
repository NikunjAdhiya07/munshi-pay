---
name: execution-system
description: Updates the Munshi Pay execution board from board/state.json and continues the next unblocked task. Use when starting work, finishing a task, changing phase scope, or refreshing project status.
version: 0.1.1
updated: 2026-10-07
---

# Execution system

`board/state.json` is the source of truth for phases, areas, tasks, models, tests, and blockers. The board, status, to-do list, and skill registry are generated.

## Update a task

1. Edit the task in `board/state.json` only.
2. Set `startedAt` when status becomes `IN_PROGRESS`.
3. When implementation and tests pass, add a `tests` entry with `status: "PASS"` and set status to `DONE`.
4. Set `project.updatedAt` to the current date.
5. Run `npm run board`.
6. Run `npm run board:check` and `npm test`.

`npm run board:live` serves the HTML board at http://127.0.0.1:4317. The board shows overall progress, phase bars, the testing queue, model assignment, recent activity, and the kanban. Click a card to open its ticket. Website tickets list what is already done and what is still to do. Run queue assigns a model when one is missing, moves ready backlog into To do, and starts the next task. Done still needs a passing test. Backlog cards for website screens follow the munshipay.com menu order. Dragging a card posts the new column to `/move`. Adding a task posts to `/add`.

`DONE` is rejected by validation if the task has no passing test.

## Status values

Tasks: `BACKLOG`, `TODO`, `IN_PROGRESS`, `REVIEW`, `BLOCKED`, `HUMAN_REVIEW`, `DONE`.

Phase status is derived. Do not store it.

Use `HUMAN_REVIEW` only when the user must supply a secret, approve a destructive migration, resolve a business rule, or confirm something the agent cannot verify. Fill `humanReview.why`, `unknown`, `action`, and `after`.

Use `BLOCKED` with a `blocker` string when work cannot continue.

## Models

Assign `modelId` from the `models` array based on the task. Simple edits use `cursor-fast`. Domain, security, and payroll math use `claude-opus` or `cursor-grok`. Do not add a model name in prose only; add it to `models` first.

## Next task

After a task is done, take the first item under "Next automatic actions" whose dependencies are done. Do not ask whether to continue.

## Skills

Edit files under `skills/`. Regeneration copies them to `.claude/skills/` and `.cursor/skills/`.
