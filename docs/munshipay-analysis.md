# MunshiPay Functional Analysis

Observed on 2026-10-06 against the authorized Mypaybook deployment at `https://munshipay.com/`. The product chrome says Mypaybook and credits Munshi Consultancy Services. This document records screens, fields, and workflows that were visible after login. It does not copy branding, assets, or source code.

Live data was not changed. Process Salary, Delete, Lock, Save, and password reset were not submitted.

Personal records, government identifiers, bank accounts, and the sign-in secret are omitted. Dropdown lists that are clearly this company's own master data (bank names, departments, designations) are described as company lists, not as fixed product enums.

Where a formula is not shown in the interface, it is marked **REQUIRES VALIDATION**.

## Authentication

### Purpose

Identify the user, then require an explicit company selection before payroll data is shown.

### Navigation path

`/` Sign In → `/CompanyList/CmpList` Select Company → `/CompanyList/SelectCompany` → `/Home/Index`.

### Screens

| Screen | What was observed |
| --- | --- |
| Sign In | User Id, Password, Submit. No forgot-password, OTP, or self-registration link. |
| Select Company | One company row for this login. Logout returns to `/`. |
| Header session | Shows the signed-in user, Company Selection, and Logout. Welcome line names the active company. |

### Workflow

```text
Open sign-in
↓
Enter User Id and Password
↓
Submit
↓
Select Company
↓
Enter
↓
Home
```

Logout is a header action and returns to the sign-in page. Password change for an employee exists later as Control Panel → Retrieve Password. That screen was opened only far enough to read its fields. It was not used.

### Validation

Empty submit was not tested. A valid User Id and Password reaches company selection. Session survives navigation across modules until Logout.

### Role behavior observed for this login

Create was refused with "Un Authorize Access" on: new company, task entry, news entry, leave master, shift create, loan create, leave-policy create, and deduction-head create. List and edit surfaces for several of those modules were still visible. IT Master's menu target `/ITMaster/Index` returns "The resource cannot be found." That module is in the menu and is not a working screen in this deployment.

## Navigation

Sidebar groups, in order:

| Group | Items |
| --- | --- |
| Home | Home |
| Master | Company, Employee, Import Excel, Export Excel, Set Percentage, PT Master, Misc. Entry, Holiday Entry, Task Entry, News Entry, Thought Entry, Flow Entry, Rate Change |
| Time Management | Shift Master, Monthly Muster |
| Deduction/Loan | Loan Entry, Deduction Entry |
| Transaction | Salary Summary, Process Salary, Salary Entry, Quick Entry New, F&F Settlement |
| Leave Management | Leave Master, Leave Policy, Leave Register, Leave Carry Forward, Leave Encashment |
| IT Master | Menu item only. Target page is missing. |
| Report | Report list |
| Control Panel | User Role, User Master, User Rights, ESS Lock/Unlock, Data Lock/Unlock, Retrieve Password, Transfer Employee, Merge Empl. Code |

Header: company welcome, recent-task count, user menu (Company Selection, Logout). Breadcrumbs appear as the screen title plus a back link on forms. A search drawer contains template sample links (people and UI demos). Those links are not payroll modules.

Tables across the app use the same grid pattern: page size 10, 25, 50, 100, or 500, a search box, sortable headers, and Previous / numbered / Next paging.

## Dashboard

Path: `/Home/Index`.

| Widget | Observed content |
| --- | --- |
| Pending applications | Counts, all zero for this company: Leave, C-off, Mispunch, Outduty, Resignation, IT Investment. No admin screen for these queues was found in the sidebar. |
| Active Employee | Count of active employees. |
| Active Company / Total Company | Both 1 for this login. |
| Salary process | Shows the current process month-year. |
| Total Payroll Run | Count labeled for that month-year. |
| Month / Year filters | Jan–Dec and years 2021–2031, plus company short-name filter and "See Full Detail". |
| Pending Data | Employees missing Aadhaar, UAN, PAN, mobile, birth date, join date, PF bank detail, or salary bank detail. Each count links to an employee list. |
| Latest News | News panel. Creating news was unauthorized. |
| Employee activity | Document list count and helpdesk application count. |
| Events | Today birthday, upcoming birthday, new joining, left employee. Each count is a link. |

## Masters

### Company

Purpose: the legal entity and the payroll rules stored on it.

Path: Master → Company → `/Company/Index`.

List columns: Edit, Company View, Company No, Short Name, Company Name, Location, City, State. Actions: Create New Site/Unit, Create New Company. Create New Company was unauthorized. Edit of the current company and Create New Site/Unit open the same profile form.

Tabs: Company Details, Allowance Details, Other Details.

Sections and fields:

| Section | Fields |
| --- | --- |
| Identity | Short Name (required), Company Name (required), Est Type, Company View, Company Status |
| Address | Address, Email, Phone, Branch/Location, City, District, State (marked required on the label), Pin code |
| Company bank | Bank Name, IFSC, Account No, Bank Address |
| Unit / contractor | Est Type, Unit/Contractor Name, Address |
| Statutory switches | PT as per employee state, Professional Tax, a second professional-tax checkbox bound as income-tax in the form name, PT Number, PAN, TAN |
| Pay rules | Pay Scale On, Leave Method, Leave Cal. On, Minimum wage limit, Bonus %, Bonus Limit, OT On, OT Ratio, OT-on-ESI checkbox |
| PF | PF No, PF Start Date, PF Limit (two fields), Diff EPF (two fields), A/C-2, A/C-21, A/C-22 (each with a second amount), PF Group (two fields), PF Office, PF Cal. radio, and twelve earning-head checkboxes for the PF base |
| ESI | ESI Start Date, ESI No, ESI Limit (two fields), Employee %, a second employee percent, Local Office, ESI Cal. radio, twelve earning-head checkboxes for the ESI base |
| Allowance heads | Head 1–12, each with a second field |
| Deduction heads | Deduction Head 1–4 |
| Owners | Two owners: Name, Designation, Phone, Address |
| Other | Reimbursement heads, salary-slip email detail, company manager details, document bucket |

The exact meaning of Pay Scale On, Leave Method, PF Cal., and ESI Cal. option values was not captured because those selects are filled after load. **REQUIRES VALIDATION** before those rules are implemented.

### Employee

Purpose: the person who is paid, including identity, job, bank, PF/ESI flags, salary history, nominees, and documents.

Path: Master → Employee → `/Employee/Index`.

List columns: Edit, Code, Name, Designation, Department, Join Date, Birth Date, Left Date, UAN No, PF No, ESI No, Site, Delete.

List filters: a site flag select and two radio pairs (`Ctypeflag`). Actions: Create New Employee. Search, sort, and paging match the shared grid.

Create path: `/Employee/Create`. Edit path: `/Employee/Edit`. Edit adds a sub-navigation:

| Tab | Path | Purpose |
| --- | --- | --- |
| Profile | `/Employee/Edit` | Identity, job, bank, PF, ESI |
| Other | `/Employee/OtherDtl` | Category, shift, contacts, PF bank |
| Salary | `/Employee/SalaryDtl` | Gross / CTC increments and component breakup |
| Nominee | `/Employee/NomineeDtl` | Nominees and family list |
| Document | `/Employee/DocumentDtl` | Uploaded identity documents |

#### Profile fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| Emp. Code | text | yes | Prefilled on create. Treated as assigned, not typed policy. |
| Emp. Name | text | yes | |
| Middle Name, Last Name | text | no | |
| Full Name | text | no | Read-only on create. |
| Local Address, Permanent Address | textarea | no | |
| Mobile No, Email | text | no | |
| Payment By | select | no | Bank, Cash, Cheque |
| Bank Name | select | no | Company bank list |
| IFSC, Account No, Payee Name | text | no | Salary bank |
| Salary Base | radio | no | `S` labeled Salary, `W` labeled Per Day. Salary is the default. |
| Gender | radio | no | Male (default), Female |
| Unit/Site | text | no | Read-only company name on create |
| Department, Designation | select | no | Company lists from Misc. Entry |
| Location | select | no | Empty for this company |
| Marital Status | select | no | UnMarried, Married, Divorcee |
| Birth Date | date text | no | |
| Join Date | date text | yes | |
| Left Date, Left Reason | edit only | no | |
| PAN, Aadhaar, Name as per Aadhaar | text | no | |
| Leave Encash., Bonus | checkbox | no | Both checked by default on create |
| ABRY | checkbox | no | Unchecked by default |
| PF deduction | checkbox | no | Checked by default |
| Voluntary PF | checkbox | no | Unchecked by default |
| PF No, UAN, PF Join Date | text | no | |
| EPF Diff On | select | no | Full Basic, PF Max Limit Basic, Full Gross, PF Max Limit Gross |
| PF leave reason, PF leave date | edit only | no | |
| ESI deduction | checkbox | no | Checked by default |
| ESI No, ESI Dispensary, ESI Join Date | text | no | |
| ESI leave reason, ESI leave date | edit only | no | |
| Photo | file | no | |

#### Other details

Blood Group, Employee Category, Gujarati / Non-Gujarati, Pay Cadre, Worker Type, Cast Type, State (for PT), IT Location, Head Code, Head Name, Physical Handicap, Language, WHRS, Shift, Week Off, Nationality, Employee Role, Probation Date, Notice Days, Gross Salary, Last Education.

PF bank: Bank, IFSC, Account No (separate from the salary bank on the profile).

Reference: Name, Contact, Relation, Address.

Emergency contact: Name, Relation, two contact numbers.

A side summary repeats birth date, join date, email, mobile, department, designation, PF, UAN, ESI, Aadhaar, and PAN.

#### Salary details

Inputs: Salary Category, As-on Date, Gross Salary, Total CTC.

Earning grid columns: Head, Type, %, Amount, Fix. Named heads shown: Con. Basic, DA, HRA, Medical, Conveyance, Edu, Uniform, Special, LTA, Other, Total.

Employer side: PF, ESI, Gratuity, Bonus, Leave, with percent.

Employee side: PF, ESI, PT, then Take Home.

History table: Edit, Group, As-on Date, Basic, DA, Gross, Take Home, CTC, Delete.

How Gross and CTC split into those heads is **REQUIRES VALIDATION**. The screen shows percents and amounts together. It does not show the formula.

#### Nominee and family

Nominee: Name, Birth Date, Percentage, Aadhaar, Occupation, Residing, Sex, Relation, Blood Group, Education.

Nominee list: Edit, Name, Birth Date, Relation, Percentage, Delete.

A Family List heading is on the same page. Its columns were not in the initial table markup.

#### Documents

Upload, Document Type, Document No, Name as per document, Remark. List: Edit, Document Type, Document No, Name as per document, File, Delete.

#### Employee workflow

```text
Employee list
↓
Create New Employee
↓
Profile (code, name, job, bank, PF, ESI)
↓
Submit
↓
Edit
↓
Other, Salary, Nominee, Document
```

### Import Excel

Path: `/ImportData/Index`.

| Import | Path |
| --- | --- |
| Employee | `/ImportData/ImportEmployee` |
| Salary rate | `/ImportData/ImportINCR_Normal` |
| Nominee | `/ImportData/ImportNominee` |
| Monthly deduction | `/ImportData/ImportDeductionhead` |
| Yearly leave opening | `/ImportData/ImportLeaveOpeningBal` |
| Leave flow master | `/ImportData/ImportLeave_FlowMaster` |
| Monthly attendance | `/ImportData/ImportAttendance` |
| Monthly attendance summary with deduction | `/ImportData/ImportAttendanceSummaryWithDeduction` |

### Export Excel

Path: `/ExportData/Index`.

Exports: employee, salary rate master, month-wise salary, month-wise deduction, custom employee, custom salary.

A second group, Transfer To Mobile App, sends company, employee, or salary data to a mobile app. Those transfer screens were not opened.

### Set Percentage

Path: `/SETPercentage/Index`, then Gross or CTC.

Both lists use columns: Edit, Category, Basic %, DA %, PF %, ESI %, Leave %, Delete, plus Create New. This is a category-level split, separate from an employee's own salary history.

### PT Master

Path: `/PT/Create`.

Fields: As On Date, State, PT Lower Limit (required), PT Upper Limit (required), PT Amount (required). Save, Cancel.

List: Edit, As On Date, State, PT Lower Limit, PT Upper Limit, PT Amount, Delete.

This is a slab table. Which slab wins when ranges overlap is **REQUIRES VALIDATION**.

### Misc. Entry

Path: `/Dmast/Create`.

Fields: Type (required select), Description (required). List: Edit, Type, Description, Delete. Department and designation options on the employee form come from this kind of list. The type option labels were not captured.

### Holiday Entry

Path: `/HolidayMaster/Create`.

Fields: Date (required), Description, Year (required). List: Delete, Year, Date, Description. Search and Save.

### Task Entry and News Entry

Menu items exist. Both create pages returned unauthorized for this login. Dashboard still shows a task counter and a news panel.

### Thought Entry

Path: `/ThoughtMaster/Create`. Date (required), Thought. List: Edit, Date, Thought, Delete.

### Flow Entry

Path: `/FlowMaster/Create`.

Fields: Flow Category, then four pairs of Flow Code and Flow Name. List: Edit, Category, Flow1–Flow4, Delete. Used by the leave-flow import. The runtime effect on leave approval was not visible. **REQUIRES VALIDATION**.

### Rate Change

Path: `/RateChange/Create`.

As-on Date (required), then a current and a new amount for Basic, DA, HRA, Medical, Conveyance, Edu, Uniform, Special, LTA, Other, and three unlabeled allowance heads. A company picker table: Company No, Short Name, Company Name, Location, State. This is a bulk rate change, not an employee increment. The employee increment history lives on Employee → Salary.

## Time Management

### Shift Master

Path: `/ShiftMaster/Index_ShiftMaster`.

List: Edit, Shift, In Time, Out Time, In Time2, Out Time2, Total Hours, Present Hours, Half-day Hours, Night-off Shift, Night-duty Punch, Delete. Create New exists and was unauthorized.

### Monthly Muster

Path: `/MusterNew/Index`. This is the attendance screen. There is no separate daily-attendance menu.

Filters: Month, employee code, employee name, and five public-holiday dates.

Grid columns: Delete, Id, Month, Year, Code, Name, days 1–31, PDay, Woff, PH, Coff, Od.

Actions: Search, Delete All, Export, Add Data, Add Data (As Per Salary Entry), Save Changes.

Day-cell status codes were not opened. **REQUIRES VALIDATION**.

## Deduction and loan

### Loan list

Path: `/Loan/Index`.

Columns: Edit, Date, Code, Name, Loan Amount, Monthly Installment, Received Cash, Paid Installments, Balance Amount. Create New was unauthorized, so the create-form fields were not visible.

### Deduction entry

Path: `/Deductionhead/Index`.

Filters: Month-Year (required), Type. List: Delete, Month, Year, Emp. Code, Emp. Name, Type, Amount. Create New was unauthorized.

Quick salary entry later shows deduction columns named Conven, Other, IT, Loan, Adv, Food, Ebill, Oth_D, so those names are used in the pay grid even though the deduction-type list itself was not opened.

## Transaction

This is the payroll run area. There is no separate "approve" step in the menu. Locking is under Control Panel → Data Lock.

### Salary Summary

Path: `/Transaction/Index`. Filter: accounting year.

Columns: Year, Month, Strength, Basic, DA, Others, Gross Salary, PF, ESI, PT, IT, Others, Gross Deduction, Net Amount.

### Process Salary

Path: `/SalaryProcess/SalaryProcess`.

```text
Choose month-year
↓
Search
↓
Review exception lists
↓
Process Salary
↓
Result grid: Year, Month, Code, Name, Basic, DA, Gross, PF, ESI, PT, IT, Gross Deduction, Net
↓
Optional Delete All or Export This Data
```

Exception lists shown on the page, each with the same amount columns:

- Empty Salary Rate
- Left Employee
- Empty Salary Category
- ESI Salary > 21000

The last item is the only numeric statutory threshold printed on the screen. How "ESI salary" is summed, and whether 21000 is a wage ceiling, is **REQUIRES VALIDATION**.

Process Salary was not clicked.

### Salary Entry

Path: `/SalaryEntry/SalaryEntryList`.

Month filter, Delete All, and a row grid: Edit, Year, Month, Code, Name, Basic, DA, Gross, PF, ESI, PT, IT, Gross Deduction, Net, Delete. This is the edited result of a processed month. The edit form was not opened, so per-line override fields are **REQUIRES VALIDATION**.

### Quick Entry

Path: `/QuickSalaryProcess/Index`.

Month filter and one grid: Id, Month, Year, Code, Name, MD, WO, PH, WD, PD, CF, OD, Conven, Other, IT, Loan, Adv, Food, Ebill, Oth_D, PF, ESI, PT, Gross, Deduc, Amount, Last_GROSS.

Column meanings that are explicit from the labels: month days, week off, public holiday, and the deduction names. MD, WD, PD, CF, and OD are abbreviations on the grid. **REQUIRES VALIDATION** before they are treated as paid days or overtime.

### Full and final

Path: `/FullAndFinal/FullAndFinalList`.

Date filter, export, and entry link `/FullAndFinal/FullAndFinalView`. List: Select, Month, Year, Code, Name, Amount, Status. The settlement worksheet was not opened.

## Leave

| Screen | Path | What was visible | Create |
| --- | --- | --- | --- |
| Leave Master | `/LeaveMaster/Create` | Unauthorized | Denied |
| Leave Policy | `/LeavePolicy/Index` | Edit, Pay Cadre, Leave Name, Leave Duration, Leave Ratio, Delete | Create denied |
| Leave Register | `/LeaveOpening/Create` | Year, code, name. Columns repeat Bf / Yr / Bal six times, so six leave buckets. Edit and View. | Form is the register itself |
| Leave Carry Forward | `/LeaveCarryForward/Index` | Current year, next year, code, name. Same six Bf / Yr / Bal groups. | No separate create |
| Leave Encashment | `/LeaveEncash/Index` | Year, search date. List: Select, Slip No, Year, Emp. Strength, Leave Name, Amount, Use Leave, Cash Leave, B/F Leave | Create link exists; form not opened |

Leave names for the six register buckets are not printed in the header row. **REQUIRES VALIDATION**.

There is no leave-request or approval inbox in the admin menu. The dashboard's "Leave Application" count implies an employee self-service queue that this admin shell does not open.

## IT Master

Menu target `/ITMaster/Index` is a missing page. Income-tax output still exists as reports: IT Return (Form 16) and IT Declaration Form. No IT declaration data-entry screen was found.

## Reports

Path: `/ReportList/Index`. Reports are grouped. Salary register and salary slip were opened far enough to read filters. Preview was not run, so column layouts of generated reports were not captured.

### Salary

| Report | Filters seen |
| --- | --- |
| Salary Register | Month-Year, Payment Date, Type, report style, two radio pairs |
| Salary Slip | Month-Year, Style, Type, select-all employees, select-all locations, employee table (code, name, id), location table |
| Salary Slip (Direct Mail) | Not opened |
| Payment Report | Not opened |
| Increment Report | Not opened |
| Salary Certificate | Not opened |
| Department-wise Summary | Not opened |
| Employee Month-wise Summary | Not opened |
| Employee Annual Summary | Not opened |
| Employee Register | Not opened |
| Company Annual Summary | Not opened |
| Form ER-1 | Not opened |
| Overtime Register | Not opened |
| Nomination Form VII | Not opened |

Preview is the action on the two opened reports. Direct mail is a separate send path.

### Provident fund

PF Challan (Monthly), PF Register, Company PF Summary, Employee PF Summary, PF No, Form 5 (Monthly), Form 10 (Monthly), PF Form 11, Form 3A, Form 9, Form 2 Revised front/back, Aadhaar / non-Aadhaar, Inspection, PF Cover / Exempt Summary, UAN text file, KYC text file, Form 6A Part I, Form 6A Part II.

### ESI

ESI Challan (Monthly), ESI Register, Company ESI Summary, Employee ESI Summary, ESI No, ESI Covered / Exempt Summary, ESI Inspection.

### Professional tax and income tax

PT Summary (Monthly), PT Statement (Annual), PT Challan Form 5, IT Return (Form 16), IT Declaration Form.

### General

Employee information form, I-Card Form 36, Identity Card Register, LWF, Form D (equal remuneration), Form 15 / Form 17, Form 17 (child workers), Gratuity Form F, Left/Join, Birthday, Medical Form 32, Medical Form 33, Form 18/19 leave register, Annual, Annual consolidated, Leave encashment, Leave encashment (direct), Leave detail, Full and final.

### Attendance, bonus, gratuity

Attendance summary (monthly), Attendance summary (annual), Muster roll, Bonus Register Form C, Bonus Form D, Gratuity calculation, Gratuity statement.

### Labour contract

Form 13, Employment card, Form 24, Form XIX loss/damages, Form XIX fines, Form XXI advance, Form XXII overtime.

### Factory Act

Compensatory leave register / Form 10.

Export format for each report (PDF, Excel, print) was not confirmed except where a screen already said Export. **REQUIRES VALIDATION** per report when that report is built.

## Settings (Control Panel)

| Screen | Path | Fields / columns | Actions |
| --- | --- | --- | --- |
| User Role | `/UserRole/Create` | Role Status, Role Name | Entry form |
| User Master | `/UserMaster/Index` | Edit, User Name, Role, Selected Company, Delete | Create New |
| User Rights | `/UserRights/Index` | User Role filter. Columns: Edit, Menu View, User Role, Menu Name, Can View, Can Add, Can Edit, Can Delete, Delete. Header checkboxes: Add, Edit, Delete, View | Edit Rights, Update All Rights |
| ESS Lock | `/DataLock/Index_EssLock` | Department filter. Columns: ESS Status, Code, Name, Designation, Department, Join Date, Birth Date, Emp Id | Lock, Unlock |
| Data Lock | `/DataLock/Index_DataLock` | Select Type, Month-Year. Columns: Lock Type, Month, Year, Status. Page title: Salary-Attendance Lock/Unlock | Lock, Unlock |
| Retrieve Password | `/RetrievePassword/Index` | Code, Name, Your Password | Not submitted |
| Transfer Employee | `/TransferEmployee/Create` | Emp. Code, Emp. Name, Transfer company no, Transfer date, Transfer company name, Month | Not submitted |
| Merge Employee Code | `/MergeCode/Create` | Emp. Code, Emp. Name, New code, Merge date, Type (two radios), Month-Year | Not submitted |

Rights are per menu and per role: view, add, edit, delete. That matches the unauthorized create responses seen in this session.

## Business rules visible in the UI

| Rule | Evidence | Formula |
| --- | --- | --- |
| Company is selected before any payroll screen | Post-login landing | Confirmed |
| Salary base is monthly salary or per day | Employee profile radios | Confirmed as a flag. Effect on pay **REQUIRES VALIDATION** |
| EPF can be full basic, limited basic, full gross, or limited gross | EPF Diff On options | Ceiling amount **REQUIRES VALIDATION** |
| PF and ESI bases are chosen earning heads | Company checkboxes per head | Confirmed as configuration. Rates **REQUIRES VALIDATION** |
| ESI processing flags salary above 21000 | Process Salary exception list | Threshold confirmed as a label. Wage definition **REQUIRES VALIDATION** |
| PT is a state slab with lower, upper, and amount | PT Master | Slab selection **REQUIRES VALIDATION** |
| Category percentages exist for Gross and for CTC | Set Percentage | Split formula **REQUIRES VALIDATION** |
| An employee has dated salary rows with gross, CTC, and take-home | Employee salary history | Component math **REQUIRES VALIDATION** |
| Payroll is monthly | Month-year on process, muster, deductions, lock | Confirmed |
| Processing warns on missing rate, missing category, left employees, and ESI over 21000 | Process Salary | Confirmed as labels |
| A processed month can be deleted in bulk | Delete All on process and salary entry | Not executed |
| Months can be locked for salary and attendance | Data Lock | Not executed |
| Employees can be locked out of self-service | ESS Lock | Not executed |
| Loans track amount, installment, cash received, installments paid, and balance | Loan list | Processing deducts the installment. Lock posts it to cash received (DEC-014) |
| Leave register keeps brought-forward, year, and balance for six unnamed buckets | Leave register headers | Bucket names **REQUIRES VALIDATION** |

Do not invent PF, ESI, PT, TDS, bonus, gratuity, or overtime formulas from these labels. DEC-004 still applies.

## Screen inventory

| ID | Screen | Module | Purpose | Actions | Priority |
| --- | --- | --- | --- | --- | --- |
| M-001 | Sign In | Auth | User login | Submit | P0 |
| M-002 | Select Company | Auth | Choose the active company | Enter, search, logout | P0 |
| M-003 | Home | Dashboard | Counts, pending data, birthdays, process month | Filter, open lists | P0 |
| M-004 | Company list | Master | Companies for this user | Edit, create site, create company | P0 |
| M-005 | Company profile | Master | Statutory and pay setup | Save | P0 |
| M-006 | Employee list | Employee | Find employees | Create, edit, delete, search | P0 |
| M-007 | Employee profile | Employee | Identity, job, bank, PF, ESI | Submit | P0 |
| M-008 | Employee other | Employee | Category, shift, contacts | Save | P1 |
| M-009 | Employee salary | Salary | Increment and breakup | Save, delete history row | P0 |
| M-010 | Employee nominee | Employee | Nominee and family | Save, delete | P1 |
| M-011 | Employee document | Employee | Document bucket | Upload, delete | P1 |
| M-012 | Import data | Master | Spreadsheet intake | Open each import | P1 |
| M-013 | Export data | Master | Spreadsheet and mobile transfer | Open each export | P1 |
| M-014 | Set percentage | Salary | Category Basic/DA/PF/ESI/Leave percents | Create, edit, delete | P0 |
| M-015 | PT master | Statutory | PT slabs | Save, edit, delete | P1 |
| M-016 | Misc. entry | Master | Typed lookup lists | Save, edit, delete | P0 |
| M-017 | Holiday entry | Time | Holiday dates | Save, search, delete | P1 |
| M-018 | Thought entry | Master | Daily thought | Save, edit, delete | P2 |
| M-019 | Flow entry | Leave | Four-level flow | Save, edit, delete | P2 |
| M-020 | Rate change | Salary | Bulk allowance rate change | Save | P1 |
| M-021 | Shift list | Time | Shift timings | Create, edit, delete | P1 |
| M-022 | Monthly muster | Attendance | Day-wise attendance | Search, add, save, export, delete | P0 |
| M-023 | Loan list | Loan | Loan balances | Create, edit | P1 |
| M-024 | Deduction list | Deduction | Monthly deduction amounts | Search, create | P0 |
| M-025 | Salary summary | Payroll | Month totals | Filter year | P0 |
| M-026 | Process salary | Payroll | Run a month | Search, process, delete all, export | P0 |
| M-027 | Salary entry list | Payroll | Processed lines | Edit, delete, delete all | P0 |
| M-028 | Quick salary entry | Payroll | Attendance and pay grid | Month filter | P0 |
| M-029 | Full and final list | Payroll | Settlements | Entry, export | P1 |
| M-030 | Leave policy list | Leave | Cadre, name, duration, ratio | Create, edit, delete | P1 |
| M-031 | Leave register | Leave | Opening and balance | Edit, view | P1 |
| M-032 | Leave carry forward | Leave | Move balances to next year | Filter | P1 |
| M-033 | Leave encashment | Leave | Encashment slips | Create, select | P1 |
| M-034 | Report list | Reports | All statutory and pay reports | Open report | P1 |
| M-035 | Salary register | Reports | Month register | Preview | P0 |
| M-036 | Salary slip | Reports | Payslip preview | Preview | P0 |
| M-037 | User role | Access | Role name and status | Save | P1 |
| M-038 | User list | Access | Users and companies | Create, edit, delete | P1 |
| M-039 | User rights | Access | Menu permissions | Update | P0 |
| M-040 | ESS lock | Access | Self-service lock | Lock, unlock | P1 |
| M-041 | Data lock | Payroll | Lock salary and attendance months | Lock, unlock | P0 |
| M-042 | Retrieve password | Access | Set an employee password | Not used | P2 |
| M-043 | Transfer employee | Employee | Move to another company | Save | P2 |
| M-044 | Merge employee code | Employee | Replace a code | Save | P2 |
| M-045 | Task entry | Master | Present in menu | Unauthorized | P2 |
| M-046 | News entry | Master | Present in menu | Unauthorized | P2 |
| M-047 | Leave master | Leave | Present in menu | Unauthorized | P1 |
| M-048 | IT Master | Tax | Present in menu | Page missing | P2 |

## Workflow inventory

### Company setup

```text
Select company
↓
Company profile
↓
Statutory switches, PF, ESI, PT, allowance heads, deduction heads
↓
Misc. entry for department and designation
↓
PT slabs
↓
Category percentages (gross and CTC)
↓
Shifts and holidays
```

### Employee creation

```text
Employee list
↓
Create
↓
Profile
↓
Submit
↓
Other details
↓
Salary increment
↓
Nominee
↓
Documents
```

### Monthly payroll

```text
Holiday entry and monthly muster
↓
Loan and deduction entries for the month
↓
Leave register / encashment where used
↓
Process Salary for the month-year
↓
Review empty rate, empty category, left employees, ESI over 21000
↓
Salary entry edits
↓
Salary summary
↓
Salary register and salary slip
↓
Data lock for that month
```

Quick Entry is a parallel grid with attendance counts and deduction columns. Whether it replaces Process Salary or feeds it was not shown. **REQUIRES VALIDATION**.

### Separation

```text
Set left date and left reason on the employee
↓
Full and final list
↓
Full and final entry
↓
Full and final report
```

The entry worksheet was not opened.

## Traceability

Our build keeps the workflow and drops the visual copy. Status is the implementation state in this repository, not the discovery state, checked against the code on 2026-10-07. Task ids refer to `board/state.json`.

| MunshiPay feature | Our feature | Status | Tasks | Notes |
| --- | --- | --- | --- | --- |
| Sign in and company selection | Session sign-in and company switch | DONE | S-001, T-031, T-032 | Stored users with scrypt hashes and memberships (DEC-018). Sign-in opens Select Company. Enter opens the dashboard. The header switch accepts only a membership company. |
| Home counts and pending identity data | Operational dashboard | DONE | S-004 | Pending identity counts and 30-day events link to the employee list. Applications and news stay out |
| Company statutory profile | Company payroll settings | PARTIAL | S-005, T-212, T-071 | Company list with number, short name, name, location, city, state, and edit. Create company and create site, behind add on company. Profile still has name, location, city, state, PT switch, PF and ESI percents, and limits. Address, bank, and registration numbers are T-212. |
| Employee profile, other, salary, nominee, document | Employee record with tabs | PARTIAL | S-008, S-009, S-011, S-012 | Profile fields are covered (S-008, DEC-019) apart from the photo. Other, salary, nominee, and document still have gaps: one nominee, no file upload |
| Misc lists, PT slabs, holidays, shifts | Masters | PARTIAL | S-016, S-017, S-018, S-024 | Misc. entry, PT slabs, and shifts have edit and delete. Shift fields are recorded only. A month uses the latest slab set on or before the month end. An overlap warns and charges nothing until T-210. Holidays are add and list only |
| Category gross and CTC percentages | Category percents | PARTIAL | S-015 | Basic and DA only. The CTC flag has no effect |
| Employee salary history | Dated salary rows | PARTIAL | S-010, T-230 | Gross and optional CTC. No head breakup |
| Monthly muster | Attendance month | PARTIAL | S-025, T-218 | Five counts per month. No day grid. A locked month rejects muster and deduction edits |
| Loans and monthly deductions | Loans and deductions | PARTIAL | S-026, S-027, T-219 | Loans have edit, delete, and the list columns. Lock posts the installment and unlock reverses it (DEC-014). Monthly deduction entry is still add only |
| Process salary, exceptions, salary entry, summary | Payroll run | PARTIAL | S-029, S-030, S-028 | One month at a time. No year summary |
| Full and final | Leavers report | PARTIAL | S-032 | Settlement worksheet was not visible in the reference |
| Leave policy, register, carry forward, encashment | Leave records | PARTIAL | S-034, S-035, S-037 | Amounts are entered. Accrual is not inferred. Leave policy has its own page with edit and guarded delete, and duration and ratio are recorded only |
| Report catalog | Reports | PARTIAL | S-039, T-220 to T-224 | 10 of about 80 reports, grouped as the reference, each with its own rows and CSV and a month filter. The register's Type and Style filters are not built. Statutory stationery is withheld |
| Salary slip | Salary slip | PARTIAL | T-100, T-225 | Slip with company, employee, payment, and paid days, an A4 print layout, and print of all or chosen slips. PDF comes from the browser print dialog. No server PDF, address, style, or email |
| Roles, users, menu rights | Menu rights | PARTIAL | T-030, T-032, S-041, S-042 | Role model and rights matrix decided (DEC-017). Add, edit, delete, and view rights are enforced, unlock needs delete, exports need the export right, and each report group has its own menu. The dashboard hides a section the role cannot view. No user screens |
| Data lock | Period lock | PARTIAL | S-044 | Confirmation word required. Header month only |
| Import Excel and Export Excel | Workbook import and Excel export | PARTIAL | S-013, S-014, T-226 to T-229 | Upload, preview, sample, and all-or-nothing save. Saved rows do not create records yet. Export Excel downloads employee, salary rate, month-wise salary, month-wise deduction, and custom employee and salary workbooks. Salary rate and deduction exports use the import columns. Bank account, PAN, and Aadhaar are not exported. Transfer to Mobile App is dropped |
| Transfer employee, merge employee code | Employee code operations | PLANNED | S-046, S-047 | After T-211 shows the effect |
| Quick Entry | Muster, deductions, and salary entry | DROPPED | | Same data as the three screens above. Reopen if T-211 shows it writes other rows |
| ESS lock, pending applications, Flow Entry, leave-flow import | Employee self-service | DROPPED | | No self-service in scope. See DEC-012 |
| Task, News, and Thought entry | None | DROPPED | | Not payroll. Task and News were unauthorized |
| Leave Master | None | DROPPED | | Unauthorized. Policy and register cover leave names. Reopen after T-211 |
| IT Master | None | DROPPED | | The page is missing in the reference |
| Retrieve Password | User master | DROPPED | S-041 | Showing a stored password is refused. Reset sets a new one |
| Transfer to Mobile App | None | DROPPED | | No mobile app. Screens were not opened |
## Discovery gaps

These were visible as navigation or labels and were not fully inspected:

- Option lists for company pay-scale, leave method, PF calculation, and ESI calculation.
- Muster day-cell codes.
- Quick-entry abbreviations MD, WD, PD, CF, OD.
- Loan, deduction, shift, leave-policy, and leave-master create forms (unauthorized).
- Salary-entry edit form and full-and-final worksheet.
- Family-list columns.
- Generated report columns and file format.
- Whether Quick Entry writes the same rows as Process Salary.
- Employee self-service for leave, miss-punch, out-duty, resignation, and IT investment. The dashboard counts them. This admin menu does not open them.

Implementation of a formula waits until the gap is closed or the rule is written down and tested.
