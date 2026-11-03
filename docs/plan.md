# Implementation plan

## Objective

Build a production payroll platform whose workflows come from the authorized Mypaybook deployment, recorded in `docs/munshipay-analysis.md`. The interface is our own. Calculation correctness, tenant isolation, and a calm enterprise interface outrank speed of feature count.

The reference is multi-company monthly payroll: company setup, employees, muster, salary processing, lock, and reports. Modules that were not found are not added. Formulas the reference does not show stay unbuilt until they are written down and tested.

The engineering operating system in `board/state.json` is how work is tracked. This document is the narrative. It does not duplicate the kanban.

## Architecture

Modular monolith (DEC-002):

- Domain types and payroll math stay pure (DEC-003, DEC-004).
- Server use cases authorize against consultancy and company membership (DEC-008).
- PostgreSQL is the system of record once persistence starts.
- The UI follows `skills/payroll-ui-ux` and does not invent statutory screens early.

```text
Consultancy
  └── Company
        ├── Memberships and roles
        ├── Employees
        ├── Salary structures
        └── Payroll runs
              └── Lines and payslips
```

## Phases

Phases and their tasks live in `board/state.json`. The sequence is:

1. P0 Engineering operating system
2. P1 Product foundation
3. P2 Domain architecture, in parallel with the rest of foundation once P0 is done
4. P3 Identity and access
5. P4 Persistence and file storage
6. P5 Design system and shell
7. P6 Company and masters
8. P7 Workforce records
9. P8 Compensation structures
10. P9 Attendance, leave, and deductions
11. P10 Payroll engine
12. P11 Payroll operations
13. P12 Payslips, reports, and dashboard
14. P13 Data exchange
15. P14 Hardening
16. P15 Release readiness

D0 holds discovery, including the capture of screens the first pass could not open. Each phase is a module. A task belongs to one phase. See DEC-012 for what was removed and why.
## Areas

Engineering OS, foundation, architecture, authentication, database, design system, frontend, backend, payroll engine, reports, security, testing, devops, and documentation. Area progress is computed from tasks.

## Dependencies

A task lists the tasks it needs. The generator's "Next automatic actions" list includes only TODO or IN PROGRESS tasks whose dependencies are done. Payroll math depends on the money model and on tests. Payslips depend on a processed run, and statutory reports depend on the confirmed rules (T-210). Work that needs a business rule or an unobserved screen depends on a human-review task. The shell can proceed beside identity work after the application skeleton exists.

## Milestones

| Milestone | Means |
| --- | --- |
| Operating system | Board generates from state and tests pass |
| Skeleton | App boots, typecheck and unit tests run, no secrets in git |
| Trusted identity | A user can sign in and can only see allowed companies |
| First master data | Employees persist per company |
| First calculation | Gross-to-net runs from a structure with rounding tests, without guessed statutory rules |
| First operated payroll | A run can be reviewed, edited, and locked. The reference has no approval step |
| Release candidate | CI, isolation review, and deployment checklist exist |

## Testing strategy

`npm test` covers the board math now. Application unit tests arrive with the skeleton. Domain tests must cover money rounding. Permission tests must cover company isolation once queries exist. UI work checks empty, loading, error, desktop, and a phone width. A task cannot be marked done without a passing test record.

## Deployment strategy

Not selected. P15 writes the checklist after the app and the security review exist. No production deploy happens from the engineering-system work.

## Human decisions still open

Three tasks wait on the owner: T-210 (PF, ESI, PT, and which other statutory rules are in scope), T-217 (salary breakup and how attendance affects pay), and T-211 (screens the first discovery pass could not open). Foundation, access, persistence, masters, workforce, and most operations work do not wait on them. The authentication library is chosen at the start of P3.