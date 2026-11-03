import type { Employee, PayrollRun, Store } from "./model.ts";

/**
 * Salary slips for one company and month. A slip is read from the saved
 * payroll line and never recalculated, so the slip always matches the run.
 * Employee details (designation, department, payment method) are read from the
 * employee record today. Until T-215 stores a snapshot with a locked run, a
 * later edit to those details shows on an older slip.
 */

export type SlipLine = { label: string; paise: number };

export type Slip = {
  employeeId: string;
  company: { name: string; state: string };
  period: string;
  runStatus: PayrollRun["status"];
  employee: {
    code: string;
    name: string;
    designation: string;
    department: string;
  };
  paymentMethod: string;
  /** Paid days from the month's muster, or null when no muster was saved. */
  paidDays: number | null;
  earnings: SlipLine[];
  grossPaise: number;
  deductions: SlipLine[];
  totalDeductionsPaise: number;
  netPaise: number;
};

export const PAYMENT_METHOD: Record<Employee["paymentBy"], string> = {
  bank: "Bank transfer",
  cash: "Cash",
  cheque: "Cheque",
};

/** Most slips one print request may carry. */
export const MAX_SLIPS = 500;

function run(
  store: Store,
  companyId: string,
  period: string,
): PayrollRun | undefined {
  return store.runs.find(
    (item) => item.companyId === companyId && item.period === period,
  );
}

export function buildSlip(
  store: Store,
  companyId: string,
  period: string,
  employeeId: string,
): Slip | null {
  const payroll = run(store, companyId, period);
  const line = payroll?.lines.find(
    (item) => item.employeeId === employeeId && item.payable,
  );
  const employee = store.employees.find(
    (item) => item.id === employeeId && item.companyId === companyId,
  );
  const company = store.companies.find((item) => item.id === companyId);
  if (!payroll || !line || !employee || !company) return null;

  const muster = store.muster.find(
    (item) =>
      item.companyId === companyId &&
      item.employeeId === employeeId &&
      item.period === period,
  );

  // The engine folds a typed adjustment into "other". Show it on its own row
  // so it is labeled and never read as another earning or deduction.
  const earningAdjustment = line.earningAdjustmentPaise ?? 0;
  const deductionAdjustment = line.deductionAdjustmentPaise ?? 0;
  const earnings: SlipLine[] = [
    { label: "Basic", paise: line.basicPaise },
    { label: "DA", paise: line.daPaise },
    {
      label: "Other earnings",
      paise: line.otherEarningPaise - earningAdjustment,
    },
  ];
  if (earningAdjustment !== 0) {
    earnings.push({ label: "Earning adjustment", paise: earningAdjustment });
  }
  const deductions: SlipLine[] = [
    { label: "PF", paise: line.pfPaise },
    { label: "ESI", paise: line.esiPaise },
    { label: "Professional tax", paise: line.ptPaise },
    {
      label: "Other deductions",
      paise: line.otherDeductionPaise - deductionAdjustment,
    },
    { label: "Loan", paise: line.loanPaise },
  ];
  if (deductionAdjustment !== 0) {
    deductions.push({
      label: "Deduction adjustment",
      paise: deductionAdjustment,
    });
  }

  return {
    employeeId,
    company: { name: company.name, state: company.state },
    period,
    runStatus: payroll.status,
    employee: {
      code: employee.code,
      name: employee.name,
      designation: employee.designation,
      department: employee.department,
    },
    paymentMethod: PAYMENT_METHOD[employee.paymentBy] ?? employee.paymentBy,
    paidDays: muster ? muster.paidDays : null,
    earnings,
    grossPaise: line.grossPaise,
    deductions,
    totalDeductionsPaise: line.deductionPaise,
    netPaise: line.netPaise,
  };
}

/** Employees who have a payable slip this month, in the run's order. */
export function slipEmployeeIds(
  store: Store,
  companyId: string,
  period: string,
): string[] {
  const people = new Set(
    store.employees
      .filter((item) => item.companyId === companyId)
      .map((item) => item.id),
  );
  return (run(store, companyId, period)?.lines ?? [])
    .filter((line) => line.payable && people.has(line.employeeId))
    .map((line) => line.employeeId);
}

/**
 * Slips for chosen employees, or for everyone when `employeeIds` is null.
 * Ids that are repeated, unknown, from another company, or not payable are
 * dropped, and the result keeps the run's order.
 */
export function buildSlips(
  store: Store,
  companyId: string,
  period: string,
  employeeIds: string[] | null,
): Slip[] {
  const wanted = employeeIds === null ? null : new Set(employeeIds);
  return slipEmployeeIds(store, companyId, period)
    .filter((id) => wanted === null || wanted.has(id))
    .slice(0, MAX_SLIPS)
    .flatMap((id) => buildSlip(store, companyId, period, id) ?? []);
}

/** Query values for a repeated parameter, trimmed, de-duplicated, and capped. */
export function parseSelection(value: string | string[] | undefined): string[] {
  const list =
    value === undefined ? [] : Array.isArray(value) ? value : [value];
  return [
    ...new Set(list.map((item) => item.trim()).filter((item) => item !== "")),
  ].slice(0, MAX_SLIPS);
}

/** Do the shown rows add up to the saved totals? Used to catch drift in tests. */
export function slipReconciles(slip: Slip): boolean {
  const earned = slip.earnings.reduce((sum, item) => sum + item.paise, 0);
  const withheld = slip.deductions.reduce((sum, item) => sum + item.paise, 0);
  return (
    earned === slip.grossPaise &&
    withheld === slip.totalDeductionsPaise &&
    slip.grossPaise - slip.totalDeductionsPaise === slip.netPaise
  );
}
