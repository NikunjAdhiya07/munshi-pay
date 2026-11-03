import { calculatePayroll, type EngineInput } from "../domain/engine.ts";
import {
  installmentDue,
  postLoanInstallments,
  reverseLoanInstallments,
} from "./loans.ts";
import type {
  Deduction,
  Employee,
  PayrollLine,
  PayrollRun,
  Store,
} from "./model.ts";
import { ptFor } from "./slabs.ts";

export class PayrollError extends Error {}

export function isLocked(
  store: Store,
  companyId: string,
  period: string,
): boolean {
  return store.locks.some(
    (lock) => lock.companyId === companyId && lock.period === period,
  );
}

function assertOpen(store: Store, companyId: string, period: string): void {
  if (isLocked(store, companyId, period)) {
    throw new PayrollError("This period is locked.");
  }
}

export function periodEnd(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${period}-${String(last).padStart(2, "0")}`;
}

function latestRow(employee: Employee, period: string) {
  const end = periodEnd(period);
  return employee.salaryRows
    .filter((row) => row.asOn <= end)
    .sort((a, b) => b.asOn.localeCompare(a.asOn))[0];
}

function ptAmount(
  store: Store,
  companyId: string,
  state: string,
  gross: number,
  onDate: string,
): number {
  const company = store.companies.find((item) => item.id === companyId);
  if (!company?.professionalTax) return 0;
  return ptFor(store, companyId, state, gross, onDate);
}

function loanDue(store: Store, companyId: string, employeeId: string): number {
  return store.loans
    .filter(
      (loan) => loan.companyId === companyId && loan.employeeId === employeeId,
    )
    .reduce((sum, loan) => sum + installmentDue(loan), 0);
}

export function buildInput(
  store: Store,
  employee: Employee,
  period: string,
  adjustments?: { earningPaise: number; deductionPaise: number },
): EngineInput {
  const company = store.companies.find(
    (item) => item.id === employee.companyId,
  );
  const row = latestRow(employee, period);
  const category = store.categories.find((item) => item.id === row?.categoryId);
  const attendance = store.muster.find(
    (item) => item.employeeId === employee.id && item.period === period,
  );
  const other = store.deductions
    .filter((item) => item.employeeId === employee.id && item.period === period)
    .reduce((sum, item) => sum + item.amountPaise, 0);
  const end = periodEnd(period);
  const rate = row && row.grossPaise > 0 ? row.grossPaise : 0;
  const structureGross =
    employee.salaryBase === "per-day"
      ? rate * (attendance?.paidDays ?? 0)
      : rate;
  return {
    salaryBase: employee.salaryBase,
    categoryPresent: Boolean(category),
    ratePaise: row && row.grossPaise > 0 ? row.grossPaise : null,
    paidDays: attendance?.paidDays ?? 0,
    basicPercent: category?.basicPercent ?? 0,
    daPercent: category?.daPercent ?? 0,
    leftDuringPeriod: Boolean(employee.leftDate) && employee.leftDate <= end,
    pfDeduct: employee.pfDeduct,
    epfMode: employee.epfMode,
    pfLimitPaise: company?.pfLimitPaise ?? null,
    pfEmployeePercent: company?.pfEmployeePercent ?? null,
    esiDeduct: employee.esiDeduct,
    esiEmployeePercent: company?.esiEmployeePercent ?? null,
    esiExceptionLimitPaise: company?.esiExceptionLimitPaise ?? 2_100_000,
    ptPaise: ptAmount(
      store,
      employee.companyId,
      company?.state ?? "",
      structureGross,
      end,
    ),
    otherDeductionPaise: other,
    loanPaise: loanDue(store, employee.companyId, employee.id),
    earningAdjustmentPaise: adjustments?.earningPaise ?? 0,
    deductionAdjustmentPaise: adjustments?.deductionPaise ?? 0,
  };
}

export function processPeriod(
  store: Store,
  companyId: string,
  period: string,
  actor: string,
): PayrollRun {
  assertOpen(store, companyId, period);
  const lines: PayrollLine[] = store.employees
    .filter((employee) => employee.companyId === companyId)
    .map((employee) => {
      const existing = store.runs.find(
        (run) => run.companyId === companyId && run.period === period,
      );
      const previous = existing?.lines.find(
        (line) => line.employeeId === employee.id,
      );
      const result = calculatePayroll(
        buildInput(store, employee, period, {
          earningPaise: previous?.earningAdjustmentPaise ?? 0,
          deductionPaise: previous?.deductionAdjustmentPaise ?? 0,
        }),
      );
      return {
        employeeId: employee.id,
        ...result,
        exceptions: result.exceptions,
        earningAdjustmentPaise: previous?.earningAdjustmentPaise ?? 0,
        deductionAdjustmentPaise: previous?.deductionAdjustmentPaise ?? 0,
      };
    });
  const open = lines.some((line) => line.exceptions.length > 0);
  const run: PayrollRun = {
    id: `run-${companyId}-${period}`,
    companyId,
    period,
    status: open ? "in-review" : "calculated",
    lines,
    processedAt: new Date().toISOString(),
  };
  store.runs = store.runs.filter((item) => item.id !== run.id);
  store.runs.push(run);
  store.audit.unshift({
    id: `audit-${run.processedAt}`,
    at: run.processedAt,
    actor,
    action: `Processed salary ${period}`,
    companyId,
  });
  return run;
}

export function adjustLine(
  store: Store,
  companyId: string,
  period: string,
  employeeId: string,
  earningPaise: number,
  deductionPaise: number,
): void {
  assertOpen(store, companyId, period);
  const run = store.runs.find(
    (item) => item.companyId === companyId && item.period === period,
  );
  if (!run) throw new PayrollError("Process the month before editing a line.");
  const employee = store.employees.find(
    (item) => item.id === employeeId && item.companyId === companyId,
  );
  if (!employee) throw new PayrollError("Employee not found.");
  const result = calculatePayroll(
    buildInput(store, employee, period, { earningPaise, deductionPaise }),
  );
  const line = run.lines.find((item) => item.employeeId === employeeId);
  if (!line) throw new PayrollError("Employee is not in this run.");
  Object.assign(line, result, {
    earningAdjustmentPaise: earningPaise,
    deductionAdjustmentPaise: deductionPaise,
  });
}

export function recordDeduction(
  store: Store,
  companyId: string,
  period: string,
  input: { employeeId: string; type: string; amountPaise: number },
  newId: () => string,
): Deduction {
  assertOpen(store, companyId, period);
  if (
    !store.employees.some(
      (item) => item.id === input.employeeId && item.companyId === companyId,
    )
  ) {
    throw new PayrollError("Employee not found.");
  }
  const deduction: Deduction = {
    id: newId(),
    companyId,
    employeeId: input.employeeId,
    period,
    type: input.type,
    amountPaise: input.amountPaise,
  };
  store.deductions.push(deduction);
  return deduction;
}

export function lockPeriod(
  store: Store,
  companyId: string,
  period: string,
  actor: string,
): void {
  const run = store.runs.find(
    (item) => item.companyId === companyId && item.period === period,
  );
  if (!run) throw new PayrollError("Process the month before locking it.");
  if (isLocked(store, companyId, period)) {
    throw new PayrollError("This period is already locked.");
  }
  const now = new Date().toISOString();
  store.locks.push({
    id: `lock-${companyId}-${period}`,
    companyId,
    period,
    kind: "salary-attendance",
    lockedAt: now,
    lockedBy: actor,
  });
  run.status = "locked";
  store.audit.unshift({
    id: `audit-lock-${now}`,
    at: now,
    actor,
    action: `Locked salary and attendance ${period}`,
    companyId,
  });
  postLoanInstallments(
    store,
    companyId,
    period,
    actor,
    () => `audit-loan-${now}`,
  );
}

export function unlockPeriod(
  store: Store,
  companyId: string,
  period: string,
  actor: string,
): void {
  reverseLoanInstallments(
    store,
    companyId,
    period,
    actor,
    () => `audit-loan-reverse-${new Date().toISOString()}`,
  );
  store.locks = store.locks.filter(
    (lock) => !(lock.companyId === companyId && lock.period === period),
  );
  const run = store.runs.find(
    (item) => item.companyId === companyId && item.period === period,
  );
  if (run)
    run.status = run.lines.some((line) => line.exceptions.length > 0)
      ? "in-review"
      : "calculated";
  const now = new Date().toISOString();
  store.audit.unshift({
    id: `audit-unlock-${now}`,
    at: now,
    actor,
    action: `Unlocked salary and attendance ${period}`,
    companyId,
  });
}
