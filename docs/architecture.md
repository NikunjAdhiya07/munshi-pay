# Architecture

## Baseline

The repository started empty on 2026-10-06. The first code was the engineering operating system: task state, a generator, skills, and these documents. The application followed in P1.

## Runtime shape

One deployable TypeScript application on Next.js (DEC-002).

| Layer | Folder | Responsibility |
| --- | --- | --- |
| Domain | `src/domain` | Pure money math, the pay engine, report and import definitions. No framework, file system, or store imports. |
| Server | `src/server` | One module per context. Validates input, checks the company id, enforces the lock, and changes the store passed to it. |
| Boundary | `src/server/actions.ts`, `src/server/auth.ts` | Server actions parse form input, call one context function inside `updateStore`, and redirect. Auth owns the session cookie. |
| UI | `src/app`, `src/components` | Server components read the store and display results. Client components hold only UI state. No formulas. |
| Persistence | `src/server/store.ts` | Local JSON store now (DEC-010). PostgreSQL via Drizzle remains the production target (T-215). |

## Bounded contexts

DEC-015 names nine contexts. Shared pieces are `src/domain/money.ts`, the types in `src/server/model.ts`, the store, and the UI primitives in `src/components`.

| Context | Owns | Server modules | Screens |
| --- | --- | --- | --- |
| Access | Sessions, roles, menu rights | `auth.ts`, `access.ts` | Sign-in, rights on Locks and access |
| Company and masters | Company settings, lookup lists, holidays, PT slabs | `misc.ts`, `holidays.ts`, `slabs.ts` | Company, Lists and rules, Misc. entry, Holiday entry |
| Workforce | Employee records and their deletion | `employees.ts`, `domain/employees.ts` | Employees |
| Compensation | Categories and their percents, dated salary rows | `categories.ts` | Set percentage, the salary tab of an employee |
| Attendance and leave | Monthly muster, shifts, leave policy, leave register | `muster.ts`, `shifts.ts`, `leavePolicy.ts`, `leaveRegister.ts` | Monthly muster, Shift master, Leave policy, Leave register |
| Loans and deductions | Loans, installment posting, one-time deductions | `loans.ts`, `deductions.ts` | Loans, Deduction entry |
| Payroll | Runs, lines, exceptions, the month lock | `payroll.ts`, `domain/engine.ts` | Process salary, Salary entry, the lock on Locks and access |
| Reporting | Report catalog, report rows, dashboard figures | `reports.ts`, `domain/reports.ts`, `domain/dashboard.ts` | Dashboard, Reports, Salary summary, register, and slips |
| Data exchange | Workbook import, CSV export | `import.ts`, `xlsx.ts`, `domain/import.ts` | Import Excel, the export route |

## Import rules

Checked by `src/server/architecture.test.ts`:

- Domain modules import only other domain modules.
- Server modules other than `actions.ts` and `auth.ts` do not import `next` or `react`.
- Server and domain code never import from `src/app` or `src/components`.
- Client components (`"use client"`) import nothing from `src/server`.
- Screens and components never call `updateStore` or `writeStore`. Writes go through server actions.
- Only `payroll.ts` imports the pay engine.
- Only `store.ts` and `import.ts` import `node:fs`.

Followed by convention and covered by each module's tests:

- Every context function takes the company id and refuses a record or employee outside that company.
- Payroll reads the other contexts' records to build engine input. Muster and deductions ask `isLocked` before writing a month, and edits refuse a locked month. Payroll calls loans to post and reverse installments on lock and unlock (DEC-014).
- A rename or delete that reaches another context's rows is done by the owning module: `misc.ts` renames employee department, designation, and bank text, `leavePolicy.ts` renames register and encashment rows, and `employees.ts` removes a deleted person's rows everywhere.
- Reporting reads runs and never writes them.
- Audit text names the record and the actor. It does not carry pay amounts or identity numbers.

## Tenancy

A consultancy owns the account. Client companies sit under that consultancy. Operational data carries the company id, and each context function filters by the company in the session (DEC-008). Stored users and memberships exist (DEC-018). A page checks the view right for its menu, and the header switch accepts only a company this login belongs to.

## Payroll flow

The reference flow is documented in `docs/munshipay-analysis.md` (DEC-009): company selection, masters, monthly muster, deductions, Process Salary with exception lists, salary-entry edits, slips and registers, then a salary and attendance lock. There is no separate approval screen.

```text
Company settings, salary rows, muster, leave, loans, deductions, PT slabs
        ↓
Process salary for a month (payroll.ts builds engine input)
        ↓
Pure engine returns lines (earnings, deductions, net, exceptions)
        ↓
Review exceptions → adjust lines → lock
        ↓
Slips, registers, and reports read the stored run
```

Run lines store the computed outputs and the two manual adjustments. They do not store the inputs that produced them. A locked month cannot be processed again and its muster and deductions cannot change, so its stored lines stay as they were. Edits to shared inputs, such as a salary row, a category, or a PT slab, do not reach a locked month but are visible when an open month is processed. T-215 adds an input snapshot with the PostgreSQL move.

Statutory rules stay behind DEC-004. PT follows DEC-013. Formulas the reference does not reveal are not invented here.

## Files

Uploaded import workbooks are written to `data/imports` on the server disk, or to `IMPORT_DIR` when set. DEC-011 places file bytes on Bunny Storage served by a Bunny CDN pull zone. That move has a task and is not built yet.

## Known gaps

- `actions.ts` holds every server action. Company settings, employee create and save, and leave encashment still change the store inline instead of calling a context module. Move each when its task runs.
- The dashboard, Process salary, and Salary entry screens check the lock with `store.locks` directly instead of `isLocked`.
- Run lines have no input snapshot until T-215.

## Boundaries

- The UI may preview, but the stored result comes from the engine.
- SQL, when it arrives, does not contain salary policy.
- Jobs, if added for large runs, call the same use case as the interactive path.

## Decisions

See `docs/decisions.md`.
