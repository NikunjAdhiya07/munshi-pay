# Munshi Pay — agent instructions

Read `EXECUTION_BOARD.md` before substantial work. Task status lives only in `board/state.json`.

After any task change, run `npm run board`, then `npm test` and `npm run board:check`.

Do not hand-edit `EXECUTION_BOARD.md`, `docs/status.md`, `docs/to-do.md`, `docs/skill-registry.md`, or `board/execution-board.html`.

Author skills in `skills/<name>/SKILL.md`. The generator copies them to `.claude/skills/` and `.cursor/skills/`.

Product constraints:

- Money is integer minor units.
- Do not invent statutory formulas. Follow DEC-004.
- Do not commit secrets or present mock payroll figures as real.
- Do not mark a task done without a passing test record.
- Continue to the next unblocked task unless a real blocker or human decision is required.

Follow the skill that matches the work: execution, architecture, security, payroll UI, and testing are the usual set.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
