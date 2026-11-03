import type { Encashment, LeaveBalance, Store } from "./model.ts";

export class LeaveRegisterError extends Error {}

export type BalanceCounts = {
  broughtForward: string;
  yearCount: string;
  balance: string;
};

export type BalanceInput = BalanceCounts & {
  employeeId: string;
  year: string;
  leaveName: string;
};

const DAY_LIMIT = 999;

function same(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Leave names from the company's policies, one per name, in name order. */
export function policyLeaveNames(store: Store, companyId: string): string[] {
  const names: string[] = [];
  for (const policy of store.leavePolicies) {
    if (policy.companyId !== companyId) continue;
    if (!names.some((name) => same(name, policy.name))) names.push(policy.name);
  }
  return names.sort((a, b) => a.localeCompare(b));
}

/** Parses a day count such as 12 or 1.5. Half days are allowed. */
export function parseDays(raw: string, label: string): number {
  const value = raw.trim();
  if (value === "") throw new LeaveRegisterError(`Enter ${label}.`);
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    throw new LeaveRegisterError(
      `${label} must be a number of days with at most two decimals.`,
    );
  }
  const days = Number(value);
  if (days > DAY_LIMIT) {
    throw new LeaveRegisterError(`${label} cannot be above ${DAY_LIMIT} days.`);
  }
  return days;
}

function checkYear(raw: string): string {
  const year = raw.trim();
  if (!/^\d{4}$/.test(year)) {
    throw new LeaveRegisterError("Enter the year as four digits.");
  }
  return year;
}

/**
 * The balance is recorded as typed. The reference does not show how leave is
 * accrued or used, so it is not derived from the other two counts (DEC-004).
 */
function checkCounts(input: BalanceCounts) {
  return {
    broughtForward: parseDays(input.broughtForward, "brought forward"),
    yearCount: parseDays(input.yearCount, "this year"),
    balance: parseDays(input.balance, "balance"),
  };
}

function owned(store: Store, companyId: string, id: string): LeaveBalance {
  const row = store.leaveBalances.find(
    (item) => item.id === id && item.companyId === companyId,
  );
  if (!row) throw new LeaveRegisterError("Register row not found.");
  return row;
}

function codeOf(store: Store, employeeId: string): string {
  return store.employees.find((item) => item.id === employeeId)?.code ?? "";
}

function record(
  store: Store,
  companyId: string,
  actor: string,
  action: string,
  newId: () => string,
): void {
  store.audit.unshift({
    id: `audit-${newId()}`,
    at: new Date().toISOString(),
    actor,
    action,
    companyId,
  });
}

function findRow(
  store: Store,
  companyId: string,
  employeeId: string,
  year: string,
  leaveName: string,
): LeaveBalance | undefined {
  return store.leaveBalances.find(
    (item) =>
      item.companyId === companyId &&
      item.employeeId === employeeId &&
      item.year === year &&
      same(item.leaveName, leaveName),
  );
}

export function addBalance(
  store: Store,
  companyId: string,
  actor: string,
  input: BalanceInput,
  newId: () => string,
): LeaveBalance {
  const employee = store.employees.find(
    (item) => item.id === input.employeeId && item.companyId === companyId,
  );
  if (!employee) throw new LeaveRegisterError("Choose an employee.");
  const year = checkYear(input.year);
  const leaveName = policyLeaveNames(store, companyId).find((name) =>
    same(name, input.leaveName),
  );
  if (!leaveName) {
    throw new LeaveRegisterError("Choose a leave name from the leave policy.");
  }
  const counts = checkCounts(input);
  if (findRow(store, companyId, employee.id, year, leaveName)) {
    throw new LeaveRegisterError(
      `${employee.name} already has ${leaveName} for ${year}. Edit that row instead.`,
    );
  }
  const row: LeaveBalance = {
    id: newId(),
    companyId,
    employeeId: employee.id,
    year,
    leaveName,
    ...counts,
  };
  store.leaveBalances.push(row);
  record(
    store,
    companyId,
    actor,
    `Added leave balance ${leaveName} for ${employee.code} in ${year}`,
    newId,
  );
  return row;
}

/** The employee, year, and leave name of a row do not change. */
export function updateBalance(
  store: Store,
  companyId: string,
  actor: string,
  id: string,
  input: BalanceCounts,
  newId: () => string,
): LeaveBalance {
  const row = owned(store, companyId, id);
  Object.assign(row, checkCounts(input));
  record(
    store,
    companyId,
    actor,
    `Edited leave balance ${row.leaveName} for ${codeOf(store, row.employeeId)} in ${row.year}`,
    newId,
  );
  return row;
}

export function deleteBalance(
  store: Store,
  companyId: string,
  actor: string,
  id: string,
  newId: () => string,
): void {
  const row = owned(store, companyId, id);
  store.leaveBalances = store.leaveBalances.filter((item) => item.id !== id);
  record(
    store,
    companyId,
    actor,
    `Deleted leave balance ${row.leaveName} for ${codeOf(store, row.employeeId)} in ${row.year}`,
    newId,
  );
}

export type CarryResult = {
  created: number;
  /** Rows already in the next year. They are left as they are. */
  skipped: number;
  /** Skipped rows whose brought forward differs from this year's balance. */
  differing: number;
};

/**
 * Copies each balance of one year into the next year as brought forward, with
 * this year at zero and the balance equal to brought forward. A row that
 * already exists in the next year is never overwritten, so running it again
 * creates nothing new.
 */
export function carryForward(
  store: Store,
  companyId: string,
  actor: string,
  rawFrom: string,
  newId: () => string,
): CarryResult {
  const from = checkYear(rawFrom);
  const to = String(Number(from) + 1);
  const result: CarryResult = { created: 0, skipped: 0, differing: 0 };
  const source = store.leaveBalances.filter(
    (item) => item.companyId === companyId && item.year === from,
  );
  for (const row of source) {
    const existing = findRow(
      store,
      companyId,
      row.employeeId,
      to,
      row.leaveName,
    );
    if (existing) {
      result.skipped += 1;
      if (existing.broughtForward !== row.balance) result.differing += 1;
      continue;
    }
    store.leaveBalances.push({
      id: newId(),
      companyId,
      employeeId: row.employeeId,
      year: to,
      leaveName: row.leaveName,
      broughtForward: row.balance,
      yearCount: 0,
      balance: row.balance,
    });
    result.created += 1;
  }
  record(
    store,
    companyId,
    actor,
    `Carried forward leave ${from} to ${to} (${result.created} created, ${result.skipped} already there)`,
    newId,
  );
  return result;
}

export type RegisterLine = {
  employeeId: string;
  code: string;
  name: string;
  byLeave: Map<string, LeaveBalance>;
};

/**
 * One line per employee with rows in the year, in code order. Columns are the
 * policy leave names, followed by any names found in rows but not in a policy.
 * Rows that repeat an employee, year, and leave name, which older carry
 * forwards could create, are returned as duplicates instead of being shown.
 */
export function registerFor(
  store: Store,
  companyId: string,
  year: string,
): {
  columns: string[];
  unlisted: Set<string>;
  lines: RegisterLine[];
  duplicates: LeaveBalance[];
} {
  const columns = policyLeaveNames(store, companyId);
  const unlisted = new Set<string>();
  const duplicates: LeaveBalance[] = [];
  const lines = new Map<string, RegisterLine>();
  for (const row of store.leaveBalances) {
    if (row.companyId !== companyId || row.year !== year) continue;
    let column = columns.find((name) => same(name, row.leaveName));
    if (!column) {
      column = row.leaveName;
      columns.push(column);
      unlisted.add(column);
    }
    const employee = store.employees.find((item) => item.id === row.employeeId);
    const line = lines.get(row.employeeId) ?? {
      employeeId: row.employeeId,
      code: employee?.code ?? "",
      name: employee?.name ?? "",
      byLeave: new Map<string, LeaveBalance>(),
    };
    if (line.byLeave.has(column)) duplicates.push(row);
    else line.byLeave.set(column, row);
    lines.set(row.employeeId, line);
  }
  return {
    columns,
    unlisted,
    duplicates,
    lines: [...lines.values()].sort((a, b) => a.code.localeCompare(b.code)),
  };
}

export function registerYears(store: Store, companyId: string): string[] {
  return [
    ...new Set(
      store.leaveBalances
        .filter((item) => item.companyId === companyId)
        .map((item) => item.year),
    ),
  ].sort((a, b) => b.localeCompare(a));
}

export type EncashmentInput = {
  employeeId: string;
  year: string;
  leaveName: string;
  amountPaise: number;
  used: string;
  cashed: string;
};

/**
 * Records an encashment for an employee of this company. The employee is
 * looked up inside the company, so an id from another company is refused.
 * The amount is recorded as typed and nothing here calculates it (DEC-004).
 */
export function addEncashment(
  store: Store,
  companyId: string,
  actor: string,
  input: EncashmentInput,
  newId: () => string,
): Encashment {
  const employee = store.employees.find(
    (item) => item.id === input.employeeId && item.companyId === companyId,
  );
  if (!employee) throw new LeaveRegisterError("Choose an employee.");
  const year = checkYear(input.year);
  const leaveName = input.leaveName.trim();
  if (!leaveName) throw new LeaveRegisterError("Enter the leave name.");
  if (!Number.isSafeInteger(input.amountPaise) || input.amountPaise < 0) {
    throw new LeaveRegisterError("Amount cannot be negative.");
  }
  const used = parseDays(input.used, "used");
  const cashed = parseDays(input.cashed, "cashed");
  const row: Encashment = {
    id: newId(),
    companyId,
    employeeId: employee.id,
    year,
    leaveName,
    amountPaise: input.amountPaise,
    used,
    cashed,
  };
  store.encashments.push(row);
  record(
    store,
    companyId,
    actor,
    `Added encashment ${leaveName} for ${employee.code} in ${year}`,
    newId,
  );
  return row;
}
