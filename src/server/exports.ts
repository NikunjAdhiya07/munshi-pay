import type { Employee, Menu, PayrollLine, Store } from "./model.ts";

export class ExportError extends Error {}

/** Money cells hold integer paise. The file writer turns them into rupees. */
export type ExportCell = string | number;

export type ExportColumn = {
  key: string;
  label: string;
  money: boolean;
};

export type ExportTable = {
  title: string;
  columns: ExportColumn[];
  rows: ExportCell[][];
};

export type ExportDef = {
  slug: string;
  title: string;
  /** The screen that shows the same data. Its view right is needed with the export right. */
  menu: Menu;
  month: boolean;
  custom: boolean;
  note: string;
};

export const EXPORTS: readonly ExportDef[] = [
  {
    slug: "employees",
    title: "Employee",
    menu: "employees",
    month: false,
    custom: false,
    note: "Every employee of this company, including those who left.",
  },
  {
    slug: "salary-rates",
    title: "Salary rate master",
    menu: "employees",
    month: false,
    custom: false,
    note: "Every dated salary row. Same columns as the salary rate import.",
  },
  {
    slug: "monthly-salary",
    title: "Month-wise salary",
    menu: "payroll",
    month: true,
    custom: false,
    note: "Payable lines of the processed run for the month.",
  },
  {
    slug: "monthly-deductions",
    title: "Month-wise deduction",
    menu: "deductions",
    month: true,
    custom: false,
    note: "Deductions entered for the month. Same columns as the monthly deduction import.",
  },
  {
    slug: "custom-employees",
    title: "Custom employee",
    menu: "employees",
    month: false,
    custom: true,
    note: "Employee columns you choose.",
  },
  {
    slug: "custom-salary",
    title: "Custom salary",
    menu: "payroll",
    month: true,
    custom: true,
    note: "Salary columns you choose, for the processed run of the month.",
  },
];

type Picked<T> = ExportColumn & { value: (row: T) => ExportCell };

const text = <T>(
  key: string,
  label: string,
  value: (row: T) => string,
): Picked<T> => ({ key, label, money: false, value });

const money = <T>(
  key: string,
  label: string,
  value: (row: T) => number,
): Picked<T> => ({ key, label, money: true, value });

/**
 * Bank account, PAN, and Aadhaar are not offered. UAN, PF, and ESI numbers
 * are, as on the employee list download.
 */
export const EMPLOYEE_COLUMNS: readonly Picked<Employee>[] = [
  text("code", "Code", (row) => row.code),
  text("name", "Name", (row) => row.name),
  text("department", "Department", (row) => row.department),
  text("designation", "Designation", (row) => row.designation),
  text("gender", "Gender", (row) => row.gender),
  text("birthDate", "Birth date", (row) => row.birthDate),
  text("joinDate", "Join date", (row) => row.joinDate),
  text("leftDate", "Left date", (row) => row.leftDate),
  text("leftReason", "Left reason", (row) => row.leftReason),
  text("paymentBy", "Payment by", (row) => row.paymentBy),
  text("bankName", "Bank", (row) => row.bankName),
  text("ifsc", "IFSC", (row) => row.ifsc),
  text("salaryBase", "Salary base", (row) => row.salaryBase),
  text("mobile", "Mobile", (row) => row.mobile),
  text("email", "Email", (row) => row.email),
  text("uan", "UAN", (row) => row.uan),
  text("pfNumber", "PF number", (row) => row.pfNumber),
  text("esiNumber", "ESI number", (row) => row.esiNumber),
  text("shift", "Shift", (row) => row.shift),
  text("weekOff", "Week off", (row) => row.weekOff),
];

const STANDARD_EMPLOYEE = [
  "code",
  "name",
  "department",
  "designation",
  "gender",
  "birthDate",
  "joinDate",
  "leftDate",
  "paymentBy",
  "salaryBase",
  "uan",
  "pfNumber",
  "esiNumber",
];

type SalaryRow = { employee: Employee | undefined; line: PayrollLine };

export const SALARY_COLUMNS: readonly Picked<SalaryRow>[] = [
  text("code", "Code", (row) => row.employee?.code ?? ""),
  text("name", "Name", (row) => row.employee?.name ?? ""),
  text("department", "Department", (row) => row.employee?.department ?? ""),
  money("basic", "Basic", (row) => row.line.basicPaise),
  money("da", "DA", (row) => row.line.daPaise),
  money("other", "Other earning", (row) => row.line.otherEarningPaise),
  money("gross", "Gross", (row) => row.line.grossPaise),
  money("pf", "PF", (row) => row.line.pfPaise),
  money("esi", "ESI", (row) => row.line.esiPaise),
  money("pt", "PT", (row) => row.line.ptPaise),
  money(
    "otherDeduction",
    "Other deduction",
    (row) => row.line.otherDeductionPaise,
  ),
  money("loan", "Loan", (row) => row.line.loanPaise),
  money("deduction", "Total deduction", (row) => row.line.deductionPaise),
  money("net", "Net", (row) => row.line.netPaise),
  money(
    "earningAdjustment",
    "Earning adjustment",
    (row) => row.line.earningAdjustmentPaise,
  ),
  money(
    "deductionAdjustment",
    "Deduction adjustment",
    (row) => row.line.deductionAdjustmentPaise,
  ),
];

const STANDARD_SALARY = [
  "code",
  "name",
  "basic",
  "da",
  "other",
  "gross",
  "pf",
  "esi",
  "pt",
  "otherDeduction",
  "loan",
  "deduction",
  "net",
];

export function findExport(slug: string): ExportDef | null {
  return EXPORTS.find((item) => item.slug === slug) ?? null;
}

/** Chosen keys in catalog order. Unknown keys and an empty choice are refused. */
function choose<T>(
  catalog: readonly Picked<T>[],
  keys: readonly string[],
): Picked<T>[] {
  const wanted = new Set(keys);
  const unknown = [...wanted].filter(
    (key) => !catalog.some((column) => column.key === key),
  );
  if (unknown.length > 0)
    throw new ExportError("Choose columns from the list.");
  const picked = catalog.filter((column) => wanted.has(column.key));
  if (picked.length === 0) throw new ExportError("Choose at least one column.");
  return picked;
}

function table<T>(title: string, columns: Picked<T>[], rows: T[]): ExportTable {
  return {
    title,
    columns: columns.map(({ key, label, money }) => ({ key, label, money })),
    rows: rows.map((row) => columns.map((column) => column.value(row))),
  };
}

function byCode(left: Employee, right: Employee): number {
  return left.code.localeCompare(right.code, "en", { numeric: true });
}

function salaryRows(
  store: Store,
  companyId: string,
  month: string,
): SalaryRow[] {
  const run = store.runs.find(
    (item) => item.companyId === companyId && item.period === month,
  );
  if (!run) throw new ExportError(`Salary is not processed for ${month}.`);
  const people = new Map(
    store.employees
      .filter((item) => item.companyId === companyId)
      .map((item) => [item.id, item]),
  );
  return run.lines
    .filter((line) => line.payable && people.has(line.employeeId))
    .map((line) => ({ employee: people.get(line.employeeId), line }))
    .sort((left, right) =>
      (left.employee?.code ?? "").localeCompare(
        right.employee?.code ?? "",
        "en",
        { numeric: true },
      ),
    );
}

export type ExportOptions = { month?: string; columns?: readonly string[] };

/** Builds one export for one company. Nothing outside that company is read. */
export function buildExport(
  store: Store,
  companyId: string,
  slug: string,
  options: ExportOptions = {},
): ExportTable {
  const def = findExport(slug);
  if (!def) throw new ExportError("Unknown export.");
  const month = options.month ?? "";
  if (def.month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new ExportError("Choose a valid month.");
  }
  const people = store.employees
    .filter((item) => item.companyId === companyId)
    .sort(byCode);
  const title = def.month ? `${def.title} ${month}` : def.title;

  switch (def.slug) {
    case "employees":
      return table(title, choose(EMPLOYEE_COLUMNS, STANDARD_EMPLOYEE), people);
    case "custom-employees":
      return table(
        title,
        choose(EMPLOYEE_COLUMNS, options.columns ?? []),
        people,
      );
    case "salary-rates": {
      const rows = people.flatMap((employee) =>
        [...employee.salaryRows]
          .sort((a, b) => a.asOn.localeCompare(b.asOn))
          .map((row) => ({ code: employee.code, row })),
      );
      type Row = (typeof rows)[number];
      return table(
        title,
        [
          text("code", "Code", (item: Row) => item.code),
          text("asOn", "As on", (item: Row) => item.row.asOn),
          money("gross", "Gross", (item: Row) => item.row.grossPaise),
        ],
        rows,
      );
    }
    case "monthly-salary":
      return table(
        title,
        choose(SALARY_COLUMNS, STANDARD_SALARY),
        salaryRows(store, companyId, month),
      );
    case "custom-salary": {
      const columns = choose(SALARY_COLUMNS, options.columns ?? []);
      return table(title, columns, salaryRows(store, companyId, month));
    }
    case "monthly-deductions": {
      const codes = new Map(people.map((item) => [item.id, item.code]));
      const rows = store.deductions
        .filter(
          (item) =>
            item.companyId === companyId &&
            item.period === month &&
            codes.has(item.employeeId),
        )
        .map((item) => ({ ...item, code: codes.get(item.employeeId) ?? "" }))
        .sort(
          (a, b) =>
            a.code.localeCompare(b.code, "en", { numeric: true }) ||
            a.type.localeCompare(b.type),
        );
      type Row = (typeof rows)[number];
      return table(
        title,
        [
          text("code", "Code", (item: Row) => item.code),
          text("period", "Period", (item: Row) => item.period),
          text("type", "Type", (item: Row) => item.type),
          money("amount", "Amount", (item: Row) => item.amountPaise),
        ],
        rows,
      );
    }
    default:
      throw new ExportError("Unknown export.");
  }
}
