import { parseRupeeText } from "../domain/money.ts";
import type { Deduction, Store } from "./model.ts";
import { isLocked, recordDeduction } from "./payroll.ts";

export class DeductionError extends Error {}

/**
 * Column names from the reference Quick Entry grid. They are labels only: no
 * type changes how a deduction is calculated, and IT is not an income-tax
 * computation.
 */
export const DEDUCTION_TYPES = [
  "Conven",
  "Other",
  "IT",
  "Loan",
  "Adv",
  "Food",
  "Ebill",
  "Oth_D",
] as const;

export type DeductionType = (typeof DEDUCTION_TYPES)[number];

/** The listed type that matches the text, ignoring case, or null for older free text. */
export function listedType(raw: string): DeductionType | null {
  const text = raw.trim().toLowerCase();
  return DEDUCTION_TYPES.find((type) => type.toLowerCase() === text) ?? null;
}

function checkType(raw: string): DeductionType {
  const type = listedType(raw);
  if (!type) throw new DeductionError("Choose a deduction type from the list.");
  return type;
}

function checkAmount(raw: string): number {
  if (raw.trim() === "") throw new DeductionError("Enter the amount.");
  const paise = parseRupeeText(raw);
  if (paise === null) {
    throw new DeductionError(
      "Amount must be in rupees with at most two decimals.",
    );
  }
  if (paise === 0) throw new DeductionError("Amount must be more than zero.");
  return paise;
}

function owned(store: Store, companyId: string, id: string): Deduction {
  const deduction = store.deductions.find(
    (item) => item.id === id && item.companyId === companyId,
  );
  if (!deduction) throw new DeductionError("Deduction not found.");
  return deduction;
}

function assertOpen(store: Store, deduction: Deduction): void {
  if (isLocked(store, deduction.companyId, deduction.period)) {
    throw new DeductionError("This period is locked.");
  }
}

function codeOf(store: Store, employeeId: string): string {
  return store.employees.find((item) => item.id === employeeId)?.code ?? "";
}

/** Audit text names the type, employee code, and month. Amounts are not logged. */
function record(
  store: Store,
  actor: string,
  verb: string,
  deduction: Deduction,
  newId: () => string,
): void {
  store.audit.unshift({
    id: `audit-${newId()}`,
    at: new Date().toISOString(),
    actor,
    action: `${verb} deduction ${deduction.type} for ${codeOf(store, deduction.employeeId)} in ${deduction.period}`,
    companyId: deduction.companyId,
  });
}

export function addDeduction(
  store: Store,
  companyId: string,
  period: string,
  actor: string,
  input: { employeeId: string; type: string; amount: string },
  newId: () => string,
): Deduction {
  const type = checkType(input.type);
  const amountPaise = checkAmount(input.amount);
  const deduction = recordDeduction(
    store,
    companyId,
    period,
    { employeeId: input.employeeId, type, amountPaise },
    newId,
  );
  record(store, actor, "Added", deduction, newId);
  return deduction;
}

/** The employee and month of a deduction do not change. Delete and add again instead. */
export function updateDeduction(
  store: Store,
  companyId: string,
  actor: string,
  id: string,
  input: { type: string; amount: string },
  newId: () => string,
): Deduction {
  const deduction = owned(store, companyId, id);
  assertOpen(store, deduction);
  const type = checkType(input.type);
  const amountPaise = checkAmount(input.amount);
  deduction.type = type;
  deduction.amountPaise = amountPaise;
  record(store, actor, "Edited", deduction, newId);
  return deduction;
}

export function deleteDeduction(
  store: Store,
  companyId: string,
  actor: string,
  id: string,
  newId: () => string,
): void {
  const deduction = owned(store, companyId, id);
  assertOpen(store, deduction);
  store.deductions = store.deductions.filter((item) => item.id !== id);
  record(store, actor, "Deleted", deduction, newId);
}

/** Deductions for one company month, optionally one type, by employee code. */
export function searchDeductions(
  store: Store,
  companyId: string,
  filter: { period: string; type?: string },
): Deduction[] {
  const type = filter.type ? listedType(filter.type) : null;
  return store.deductions
    .filter(
      (item) =>
        item.companyId === companyId &&
        item.period === filter.period &&
        (!type || listedType(item.type) === type),
    )
    .sort(
      (a, b) =>
        codeOf(store, a.employeeId).localeCompare(
          codeOf(store, b.employeeId),
        ) || a.type.localeCompare(b.type),
    );
}
