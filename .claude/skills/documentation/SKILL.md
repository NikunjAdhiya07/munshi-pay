---
name: documentation
description: Keeps Munshi Pay docs and decisions aligned with the task source of truth. Use when recording decisions, updating plans, or adding project documentation.
version: 0.1.0
updated: 2026-10-06
---

# Documentation

`board/state.json` is the only task list. These files are generated and must not be edited by hand:

- `EXECUTION_BOARD.md`
- `docs/status.md`
- `docs/to-do.md`
- `docs/skill-registry.md`
- `board/execution-board.html`

After a task change, run `npm run board`.

## Hand-written docs

- `docs/decisions.md` for architecture and calculation policy. Use the DEC template already in that file.
- `docs/plan.md` for the narrative plan. Do not copy the kanban into it.
- `docs/tech-stack.md` only for technologies that are selected or installed. Mark which.
- Create `docs/api.md`, `docs/database.md`, `docs/security.md`, `docs/payroll-engine.md`, or `docs/deployment.md` when that part of the system actually exists.

## Decisions

Do not silently replace an accepted decision. Add a new decision that supersedes it and point to the old id.

## Skills

Edit `skills/<name>/SKILL.md` only. The board generator copies skills to `.claude/skills` and `.cursor/skills`.
