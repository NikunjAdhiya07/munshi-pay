# Local data

Development data lives in `data/store.json` (DEC-010). The file is gitignored. The first read seeds two demo companies and six employees for Northwind Components.

Company-owned records carry `companyId`. Actions check that the signed-in session company matches the record before writing.

PostgreSQL is still the selected production database and is not installed. The payroll engine does not query this file. `src/server/payroll.ts` loads inputs and calls `calculatePayroll`.

Amounts are integer paise.

Employee documents and generated slips store metadata only. The file bytes belong to Bunny Storage (DEC-011).
