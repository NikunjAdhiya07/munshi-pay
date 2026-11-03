# Architecture Decisions

## DEC-001 — Execution state is the only task list

### Context
The project needs a visible board, phase progress, area progress, model workload, and status docs. Duplicating those lists by hand will drift.

### Decision
`board/state.json` stores phases, areas, models, tasks, tests, and blockers. `npm run board` generates `EXECUTION_BOARD.md`, `docs/status.md`, `docs/to-do.md`, `docs/skill-registry.md`, and `board/execution-board.html`. Phase status and every percentage are computed from tasks.

### Alternatives
Hand-maintained Markdown board. A hosted issue tracker.

### Reason
The repository should stay understandable without a third-party account, and generated views cannot disagree with the task list.

### Date
2026-10-06

### Status
Accepted

## DEC-002 — Modular monolith first

### Context
Payroll runs need one consistent write path for many employee lines. The repository is empty aside from the engineering system.

### Decision
Build one TypeScript application. Domain calculation stays pure. Server use cases authorize and persist. The UI does not own formulas. Do not split services until a later decision.

### Alternatives
Separate frontend and API repositories. Microservices per payroll concern.

### Reason
One transaction boundary is the right default for payroll correctness, and the team size does not justify operational split.

### Date
2026-10-06

### Status
Accepted

## DEC-003 — Money is integer minor units

### Context
Floating-point salary math creates rounding disputes.

### Decision
Persist and calculate money as integers in minor units. Display formatting is a UI concern. Rounding policy for a specific formula is recorded before that formula ships, with tests.

### Alternatives
Decimal libraries stored as strings. Floating point.

### Reason
Integers keep storage, comparison, and tests unambiguous. A decimal library can wrap the integer at the boundary later if a formula needs it.

### Date
2026-10-06

### Status
Accepted

## DEC-004 — Jurisdiction adapters, India planned first, formulas gated

### Context
The product name and the working timezone suggest Indian payroll, but statutory interpretation must not be invented.

### Decision
The engine will call a jurisdiction adapter. The first adapter to design is India (INR, paise). No PF, ESI, professional tax, TDS, or other statutory formula is implemented until the rule is written down and covered by tests.

### Alternatives
Hard-code one country's rules in the schema. Build a generic engine with no country in mind.

### Reason
Company data can be modeled without statutory math. Shipping guessed tax rules would be worse than omitting them.

### Date
2026-10-06

### Status
Accepted

## DEC-005 — Canonical skills in skills/

### Context
Cursor and Claude Code both need the same project skills.

### Decision
Author skills in `skills/<name>/SKILL.md`. The board generator copies them to `.claude/skills/` and `.cursor/skills/`. UI guidance adapts principles from UIX lucid-ui, saas-ui-skills, and cursor-designer. Those repositories are not vendored.

### Alternatives
Duplicate skills by hand. Install third-party skill packs wholesale.

### Reason
One editable copy stays payroll-specific, and both agents still see a skill directory they already understand.

### Date
2026-10-06

### Status
Accepted

## DEC-006 — Payroll visual system

### Context
The UI must read as enterprise payroll software rather than a generic generated dashboard.

### Decision
Use the tokens in `skills/payroll-ui-ux/tokens.md`: warm paper background, ink text, a single slate-blue accent, IBM Plex Sans and IBM Plex Mono, compact tables, and restrained radius. Status uses words plus color.

### Alternatives
Default indigo Tailwind theme. A purple-to-blue gradient marketing look.

### Reason
Payroll users scan numbers and states for long sessions. Density and a quiet palette support that better than a showcase dashboard.

### Date
2026-10-06

### Status
Accepted

## DEC-007 — Secrets stay out of git

### Context
Payroll systems accumulate database URLs, session secrets, and filing credentials.

### Decision
Commit `.env.example` with variable names only. `.gitignore` ignores `.env` and `.env.*` except the example. Logs must not contain salary, bank, or government identifier values.

### Alternatives
A shared committed env file for local development.

### Reason
Committed secrets are the most common accidental leak, and sample payroll files are still sensitive.

### Date
2026-10-06

### Status
Accepted

## DEC-008 — Consultancy, then company

### Context
The product is a consultancy platform, not a single-employer HR app.

### Decision
An account is a consultancy. A consultancy manages many client companies. Operational data is isolated by company membership. Roles start as consultancy owner, consultant, company admin, payroll manager, HR, finance, and employee. Employees see their own payslips.

### Alternatives
One tenant per company with no consultancy parent. A single global admin.

### Reason
Consultants work across clients. Company isolation still has to hold when a consultant switches clients.

### Date
2026-10-06

### Status
Accepted. The fixed role list is replaced by named roles in DEC-017.

## DEC-009 — Observed MunshiPay is the functional reference

### Context
The product needs the workflows of the authorized Mypaybook deployment, not a generic payroll template and not a visual copy.

### Decision
`docs/munshipay-analysis.md` is the functional map. Implement the screens and workflows that were observed. Do not add modules that were not found. Do not copy branding, logos, or source. Statutory and component formulas that the UI does not show stay marked REQUIRES VALIDATION and follow DEC-004. DEC-008 still holds: our tenancy is a consultancy with company isolation, because the reference already forces company selection before data access.

### Alternatives
Invent a standard HR suite. Clone the reference interface.

### Reason
The reference is a multi-company monthly payroll system with masters, muster, process-and-lock, and a large report catalog. Guessing extra modules or formulas would drift from both the product and DEC-004.

### Date
2026-10-06

### Status
Accepted

## DEC-010 — Local JSON store until PostgreSQL is provisioned

### Context
The working app needs durable company data before a database server exists. DEC-002 still calls for one process and one write path.

### Decision
Development persistence is `data/store.json`, gitignored, behind `src/server/store.ts`. Payroll math stays in `src/domain/engine.ts` and does not read the file. PostgreSQL remains the selected production store and is not installed yet.

### Alternatives
Block the UI until Drizzle and PostgreSQL are provisioned. Keep state in memory only.

### Reason
The payroll flow can be tested and used locally without inventing a second service. The repository boundary can move to PostgreSQL without moving the engine.

### Date
2026-10-06

### Status
Accepted

## DEC-011 — Files live on Bunny Storage and are served by Bunny CDN

### Context
Employee documents and generated payroll files (slips, registers) are binary. Postgres remains the system of record for payroll rows. Those bytes should not sit in `data/store.json` or in the database.

### Decision
Upload file bytes to a Bunny Storage zone. Serve them through a Bunny CDN pull zone whose origin is that zone. The database stores the storage path and metadata (company, employee, document type), not the file. Downloads are minted on the server as short-lived token-authenticated CDN URLs after the caller’s company membership and role are checked. Zones stay private: no public directory listing and no long-lived public URL. Storage access keys and the CDN token key stay in untracked `.env`.

### Alternatives
Keep files on the app server disk. Store blobs in Postgres. Use a generic S3 bucket with a separate CDN.

### Reason
Bunny CDN is the chosen edge for file delivery. Bunny Storage is the origin that pull zone reads, so uploads have one place to go. Signed URLs keep salary and identity documents off a public cache. The app does not grow a second file service.

### Date
2026-10-07

### Status
Accepted

## DEC-012 — Board scope audited against the reference

### Context
The board mirrored the reference menu one for one, so it held 47 screen tasks beside the engineering tasks. Many screen tasks repeated engineering tasks, some described pages nobody could open, and every screen task sat under the Frontend area with no dependencies.

### Decision
Work is organized by module phase (P2 to P15), and each task has one phase. The website phase W0 no longer exists. Screens stay as tasks with their reference path so each can be traced to the observed screen.

Removed because the work is a duplicate or already covered: Confirm company (it is the step behind Enter), New employee (same form as Employee profile), Quick Entry (same data as muster, deductions, and salary entry), User Role (merged into rights), Leave Carry Forward (merged into the leave register), the employee master model, employee list and detail, versioned salary structures, payroll periods and run lifecycle, the second dashboard task, the second design-system task, and the module boundaries task (merged into bounded contexts).

Removed because it is outside what this product needs: Task entry, News entry, Thought entry, Flow Entry and the leave-flow import, ESS lock, Leave Master, IT Master, Retrieve Password (a password is never shown, and reset lives in User master), pending-application counts, the news panel, and Transfer to Mobile App. The reference has no separate approval step, so the approval task was removed too. Locking is the control.

Not planned: labour-contract and Factory Act forms, PF forms 2, 3A, 5, 6A, 9, 10, and 11, inspection and cover reports, ID-card, medical, and loss-and-damages forms. They are stationery. Add a task when a client asks for one and the layout is captured.

Added because the code or our own decisions need it: stored users, rights on every page, company membership checks, PostgreSQL moves, Bunny storage (DEC-011 had no task), the lock on muster and deductions, loan installment posting, report tasks split by group, import tasks split by import, and three human decisions (T-210, T-211, T-217).

### Alternatives
Keep the menu-order phase and tag modules instead. Keep every observed screen as a task.

### Reason
A task should say what is left to build in one module. Tasks that wait on a business rule or an unobserved screen depend on a human-review task, so the queue never starts them early.

### Date
2026-10-07

### Status
Accepted

## DEC-013 — Professional tax uses the latest slab set, and an overlap charges nothing yet

### Context
DEC-004 withholds a statutory formula until the rule is written and tested. PT Master stores an as-on date, a state, an inclusive rupee range, and an amount. The reference does not say which slab wins when ranges overlap. T-210 still owns that choice. Without an as-on rule, two sets for the same state both match and the charge falls to zero.

### Decision
Professional tax is charged only when the company switch is on. For a payroll month, the set in force is the company's slabs for the company state whose as-on date is the latest date on or before the month end. A gross is inside a slab when it is greater than or equal to the lower limit and less than or equal to the upper limit. If exactly one in-force slab contains the gross, that slab's amount is the PT. If none do, or more than one do, PT is zero until T-210 names the overlap winner. The screen warns when two slabs for the same state and as-on date overlap. Editing or deleting a slab does not change PT already stored on a locked run. Amounts stay in integer paise and are not written into the audit text.

### Alternatives
Charge every matching slab. Pick the higher amount when ranges overlap. Ignore the as-on date and use every slab for the state.

### Reason
The as-on date is how a revised table replaces an older one without deleting history. Leaving overlaps at zero avoids inventing a winner the reference did not show.

### Date
2026-10-07

### Status
Accepted

## DEC-014 — A loan installment is posted when the month is locked

### Context
Processing deducts the smaller of the monthly installment and the remaining balance, then stops. The loan's cash received never changed, so the same installment was deducted every month and the balance never reached zero. T-219 records the rule for when that balance moves.

### Decision
Processing reads the balance and does not change the loan. Locking the month adds each loan's deduction for that month to cash received and to the paid-installment count, once. Unlocking that month removes only that posting. A later month then deducts the smaller of the installment and whatever balance remains, and deducts nothing once the balance is zero. A loan with a posted installment cannot be deleted, and its employee cannot be changed, until those months are unlocked. Amounts stay in integer paise. The audit names the employee code, the loan date, and the month, and does not include the amount.

### Alternatives
Reduce the balance during processing, before the month is locked. Leave the balance unchanged and deduct the installment forever.

### Reason
A processed month can still be opened and calculated again. The installment becomes part of the loan only when the month is locked, and it comes back if that lock is removed.

### Date
2026-10-07

### Status
Accepted

## DEC-015 — Nine bounded contexts with one-way import rules

### Context
DEC-002 chose a modular monolith, and the code already splits `src/domain`, `src/server`, and the screens. The contexts and the rules between them were not written down, so each screen task decided for itself where its rules lived.

### Decision
The application has nine contexts: access, company and masters, workforce, compensation, attendance and leave, loans and deductions, payroll, reporting, and data exchange. `docs/architecture.md` lists the files each one owns.

Layers import in one direction. Domain modules import only other domain modules. Context modules in `src/server` take the store as an argument, check the company id, and do not import the web framework. Only `actions.ts` and `auth.ts` import it. Only `actions.ts` writes the store. Screens read the store and call context helpers, and they write only through server actions. Client components import nothing from `src/server`. Only `payroll.ts` calls the pay engine. Only the store and the import file area touch the file system.

Between contexts, payroll reads the records of the others to build engine input and owns the month lock. A context that writes month data asks payroll whether the month is locked before it writes. A rename or a delete that must reach another context's rows is done by the module that owns the renamed record, and that module's tests cover the cascade. Reporting reads payroll runs and never writes them.

`src/server/architecture.test.ts` checks the layer rules against the source tree.

### Alternatives
One folder per context with its own domain, server, and screens. No written rules, and a review at each change.

### Reason
The current folders already follow the layer rules, so writing them down and testing them costs little. Context folders can come with PostgreSQL (T-215), when each context gains its own queries.

### Date
2026-10-07

### Status
Accepted

## DEC-016 — Percents round half away from zero to the paisa

### Context
DEC-003 asks for a rounding policy before a formula ships. The engine already takes percents of gross for Basic, DA, PF, and ESI. `percentOf` used `Math.round(amount * percent / 100)` in floating point, which rounds some exact half paise down: 1.15 percent of 3000 paise is 34.5 and came out 34. Forms converted rupees with `Number(text) * 100`, and company percents were stored from `Number(text)` with no range check.

### Decision
A percent is a number from 0 to 100 with at most two decimals. `percentOf` turns it into hundredths of a percent and multiplies in integers. The result rounds half away from zero to the nearest paisa: 0.5 paise becomes 1, and −0.5 becomes −1. An amount that is not whole paise, a percent outside the range or with more decimals, or a product too large for exact integers is refused with an error, not rounded.

Typed rupees are parsed by `parseRupeeText` and typed percents by `parsePercentText`. Neither goes through a float. A form value either of them refuses produces an error message, and nothing is stored.

This sets the default for engine percents. A statutory rule that rounds differently, such as to the whole rupee, is recorded with its formula under DEC-004 and T-210.

### Alternatives
Banker's rounding (half to even). Truncating to the paisa. Keeping floating point with an epsilon.

### Reason
Half away from zero is what people check by hand and what spreadsheets do with ROUND, so slips match a manual check. Integer arithmetic makes the same input give the same paise on every machine.

### Date
2026-10-07

### Status
Accepted

## DEC-017 — Named roles, one role per company membership, and the rights matrix

### Context
DEC-008 lists seven fixed roles. The reference instead has a User Role screen where an administrator names roles and gives each a status, a User Rights grid with view, add, edit, and delete per role and menu, and a User Master that ties a user to a role and a selected company. The code has two seeded roles, owner and viewer, eleven menus, one environment login that is always owner of the first company, and a company switch that accepts any company id.

### Decision
Roles. A role is a named record that belongs to the consultancy, with an active or inactive status, as in the reference. Its rights are the reference grid: view, add, edit, and delete per menu. One built-in role, Owner, has every right and cannot be renamed, edited, deactivated, or deleted, so an account cannot lock itself out. The DEC-008 names (consultant, company admin, payroll manager, HR, finance) are roles an administrator can create. They are not seeded, because the reference does not show what each may do. The seeded viewer role stays as a read-only example. Employee self-service is not a menu role and comes with its own task.

Users and companies. A user belongs to one consultancy. A user has memberships, and each membership pairs one company with one role, so the same person can run payroll for one client and only read another. The session carries the user id and the active company. Each request resolves the role from the membership for that company. A company without a membership cannot be selected and its data cannot be read. Consultancy-level users do not bypass this: an account owner is a user flagged as owner of the account, and it receives an Owner membership in every company the consultancy creates. A user who creates a company or site receives a membership in it with the role they hold in the company they created it from, so creating a company never raises a user's rights.

Menus. The menus are company, employees, masters, muster, loans, deductions, leave, payroll, reports, control, import, export, users, and one menu per report group: salary, provident fund, ESI, professional tax and income tax, general, and attendance with bonus and gratuity. Opening a report needs view on reports and on the report's group.

Rights for sensitive actions:

| Action | Right needed |
| --- | --- |
| Lock a month | Edit on control |
| Unlock a month | Delete on control, because it reopens closed pay and reverses posted loan installments |
| Delete any record | Delete on that record's menu |
| Stage or commit an import | Add on import |
| Download an import sample | View on import |
| Export or download a file | View on export and view on the menu whose screen shows the same data |
| Create a company or site | Add on company |
| List users, create, edit, delete, reset a password | View, add, edit, or delete on users |
| Edit roles and their rights | Edit on users |

A user can give another user, or a role, only rights the giver holds in that company, and only in companies the giver belongs to. Nobody can change their own memberships or role. Role and right changes are audited and apply on the next request.

### Alternatives
Keep the seven DEC-008 roles fixed and hard-code their rights. One role per user for all companies, as the reference User Master suggests. Let consultancy owners read every company without a membership.

### Reason
The reference lets administrators name roles, so fixed roles would lose a feature people use. Guessing the rights of five named roles would be inventing a rule. A role per membership is the only way to handle a consultant who has different duties at different clients, and the reference's single role is the case where every membership has the same role. Requiring a membership for every read keeps company isolation testable in one place.

### Date
2026-10-07

### Status
Accepted. Stored users and memberships are T-031. Enforcing view rights and membership is T-032. Role and user screens are S-041 and S-042.

## DEC-018 — Stored users, scrypt passwords, and session versions

### Context
DEC-017 says a session carries a user id and the active company, and that the role comes from that company's membership. Sign-in still compared one username and password from the environment and then opened company c1 as owner. Failed attempts lived in process memory, so a restart cleared the lockout.

### Decision
Users live in the store. Each user has a scrypt password hash (salted, Node `scrypt`), an account-owner flag, a session version, and memberships of company id plus role. The hash is not the typed password, and audit entries for a password change do not include it.

When the store has no users, the first successful sign-in with `AUTH_USERNAME` and `AUTH_PASSWORD` creates the account owner and an Owner membership in every company that exists then. After that, sign-in checks the stored hash. Changing the environment password does not change the stored hash.

The session cookie holds the user id, the selected company id (empty until Enter), and the session version. Each request loads the user, rejects the cookie when the version does not match, and reads the role from the membership for the selected company. A password change increments the version, which ends every existing session. `replacePassword` also deletes the current cookie. The form that calls it is S-041. Sign-out deletes the cookie.

Failed sign-ins are rows in the store: eight failures for a username inside ten minutes refuse the next attempt until that window passes. A successful sign-in clears that username's failures.

Select Company lists only membership companies. The header company switch lists only membership companies, and switching to any other company id is refused (T-032). A session whose company is no longer a membership company is sent back to Select Company.

### Alternatives
Keep the environment password as the only check. Store failures in memory. Put the role in the cookie and trust it.

### Reason
A stored hash lets a viewer sign in as a viewer, and a second process sees the same lockout. The version in the cookie is how a password change ends sessions that this server did not itself delete.

### Date
2026-10-07

### Status
Accepted

## DEC-019 — Employee code assigned by the server, PF and ESI on by default, identity numbers masked

### Context
Create posted a code typed by the person, so two people could pick the same one and a duplicate was never checked. Create set ESI deduction off while the reference sets it on. Aadhaar, PAN, and account numbers were shown in full in the edit form, so they sat in the page HTML.

### Decision
The server assigns the employee code when it saves: the highest number at the end of a code in that company, plus one, keeping the prefix and zero padding. A posted code is ignored. A code another employee of the company already uses is refused.

A new employee has PF deduction and ESI deduction on, and the person can untick either. Deduction still happens only when the company has the percent set. The bonus and leave-encashment flags default on and ABRY off. These flags and the PF and ESI join and leave dates are recorded only and do not change pay.

The edit form shows Aadhaar, PAN, and account numbers masked to their last four characters. A value that comes back unchanged keeps the saved number. A typed value replaces it, and an empty value clears it. The audit entry names the employee code and holds no values.

### Alternatives
Let the person type the code. Keep ESI off on create. Show the full number with a reveal button.

### Reason
A server-made code cannot collide when two people add at once. The reference default is that employees are covered unless said otherwise, and the amount still depends on the company setup. Masking keeps full identity numbers out of the page, and the unchanged-value rule means an ordinary save does not erase them.

### Date
2026-10-07

### Status
Accepted
