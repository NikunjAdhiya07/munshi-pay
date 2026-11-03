<!-- Generated from board/state.json. Do not edit by hand. -->

# To do

Completed tasks are omitted. Change status in `board/state.json`, then run `npm run board`.

## D0 — MunshiPay discovery

### HUMAN REVIEW

- `T-211` Capture the reference screens the first pass could not open · Cursor Grok · depends on T-002

## P3 — Identity and access

### BACKLOG

- `S-041` User master · Cursor Grok · depends on T-031, S-042
- `S-042` User roles and menu rights · Cursor Grok · depends on T-030, T-032

## P4 — Persistence and file storage

### BACKLOG

- `T-040` Add organization, company, and membership schema · Claude Sonnet · depends on T-030
- `T-041` Add the forward-only migration workflow · Cursor Grok · depends on T-040, T-012
- `T-213` Move company, employee, and master records to PostgreSQL · Claude Sonnet · depends on T-041
- `T-214` Move attendance, leave, loan, and deduction records to PostgreSQL · Claude Sonnet · depends on T-213
- `T-215` Move payroll runs, locks, and audit to PostgreSQL with an input snapshot · Claude Opus · depends on T-213
- `T-216` Store employee documents on Bunny Storage · Claude Opus · depends on T-032, T-213

## P6 — Company and masters

### BACKLOG

- `T-231` Company owners, salary-slip email sender, and document bucket · Claude Sonnet · depends on T-212

## P7 — Workforce records

### BACKLOG

- `S-009` Employee other details · Cursor Grok · depends on S-008, S-024
- `S-011` Nominees · Cursor Grok · depends on S-008
- `S-012` Documents · Cursor Grok · depends on S-008, T-216
- `S-046` Transfer employee · Cursor Grok · depends on T-211, T-213, T-032, S-008
- `S-047` Merge employee code · Cursor Grok · depends on T-211, T-213, S-008

## P8 — Compensation structures

### HUMAN REVIEW

- `T-217` Confirm salary breakup and attendance pay rules · Claude Opus · depends on T-002

### BACKLOG

- `S-010` Employee salary history · Cursor Grok · depends on S-008
- `T-071` Configurable earning and deduction heads · Claude Opus · depends on T-217, T-212, S-015
- `T-230` Break an employee's salary into the configured heads · Claude Opus · depends on S-010, T-071, T-217
- `S-023` Rate change · Cursor Grok · depends on T-217, S-010, T-071

## P9 — Attendance, leave, and deductions

### REVIEW

- `S-018` Holiday entry · Cursor Grok · depends on T-202
- `S-027` Deduction entry · Cursor Grok · depends on T-202
- `S-035` Leave register and carry forward · Cursor Grok · depends on T-202

### BACKLOG

- `S-025` Monthly muster · Cursor Grok · depends on T-211, T-217, T-218
- `S-037` Leave encashment · Cursor Grok · depends on S-035

## P10 — Payroll engine

### HUMAN REVIEW

- `T-210` Confirm statutory contribution rules · Claude Opus · depends on T-200

### BACKLOG

- `T-081` Calculate PF, ESI, and PT from the confirmed rules · Claude Opus · depends on T-210, T-080, T-071

## P11 — Payroll operations

### BACKLOG

- `S-029` Process salary · Cursor Grok · depends on T-201, T-218
- `S-028` Salary summary · Cursor Grok · depends on S-029
- `S-030` Salary entry · Cursor Grok · depends on S-029
- `S-044` Data lock · Cursor Grok · depends on T-218, S-029
- `S-032` F&F settlement · Cursor Grok · depends on T-211, T-219, S-029

## P12 — Payslips, reports, and dashboard

### REVIEW

- `T-100` Salary slip · Claude Sonnet · depends on T-201

### BACKLOG

- `T-220` Salary reports beyond the register · Claude Sonnet · depends on S-039, S-028
- `T-221` PF reports · Claude Sonnet · depends on S-039, T-081, T-211
- `T-222` ESI reports · Claude Sonnet · depends on S-039, T-081, T-211
- `T-223` Professional tax and income-tax reports · Claude Sonnet · depends on S-039, T-081, T-211
- `T-224` Workforce, attendance, and leave reports · Claude Sonnet · depends on S-039, S-008, S-025, S-035
- `T-225` Email payslips · Claude Sonnet · depends on T-100, T-212

## P13 — Data exchange

### REVIEW

- `S-014` Export Excel · Cursor Grok · depends on S-013

### BACKLOG

- `T-226` Import employees · Claude Sonnet · depends on S-013, S-008
- `T-227` Import salary rates · Claude Sonnet · depends on S-013, S-010
- `T-228` Import monthly attendance · Claude Sonnet · depends on S-013, S-025
- `T-229` Import deductions, nominees, and leave opening balances · Claude Sonnet · depends on S-013, S-027, S-011, S-035

## P14 — Hardening

### BACKLOG

- `T-110` Review tenant isolation, authorization, and sensitive-data handling · Claude Opus · depends on T-032, T-215
- `T-111` Pass responsive and accessibility checks on built screens · Cursor Grok · depends on S-004, S-008, S-029
- `T-112` Review pagination and indexes · Claude Sonnet · depends on T-213, T-214

## P15 — Release readiness

### BACKLOG

- `T-120` Write the deployment checklist · Cursor Fast · depends on T-110, T-121

