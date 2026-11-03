import type { Loan, Store } from "./model.ts";

export class LoanError extends Error {}

export type LoanInput = {
  employeeId: string;
  date: string;
  amount: string;
  installment: string;
  received: string;
};

const input = (value: LoanInput): LoanInput => ({
  employeeId: value.employeeId.trim(),
  date: value.date.trim(),
  amount: value.amount.trim(),
  installment: value.installment.trim(),
  received: value.received.trim(),
});

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

/** Rupees typed by a person, converted to paise without a float. */
function parseRupees(raw: string, label: string, allowBlank: boolean): number {
  if (raw === "") {
    if (allowBlank) return 0;
    throw new LoanError(`Enter the ${label}.`);
  }
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(raw.replaceAll(",", ""));
  if (!match) {
    throw new LoanError(
      `${label} must be an amount in rupees with at most two decimals.`,
    );
  }
  const paise =
    Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(paise))
    throw new LoanError(`${label} is too large.`);
  return paise;
}

export function loanBalance(loan: Loan): number {
  return Math.max(0, loan.amountPaise - loan.receivedPaise);
}

/** The installment a processed month deducts, capped at the remaining balance. */
export function installmentDue(loan: Loan): number {
  const balance = loanBalance(loan);
  if (balance <= 0 || loan.installmentPaise <= 0) return 0;
  return Math.min(loan.installmentPaise, balance);
}

function postedPaise(loan: Loan): number {
  return (loan.posts ?? []).reduce((sum, post) => sum + post.paise, 0);
}

function employeeCode(
  store: Store,
  companyId: string,
  employeeId: string,
): string {
  return (
    store.employees.find(
      (item) => item.id === employeeId && item.companyId === companyId,
    )?.code ?? employeeId
  );
}

function audit(
  store: Store,
  companyId: string,
  actor: string,
  action: string,
  newId: () => string,
): void {
  store.audit.unshift({
    id: newId(),
    at: new Date().toISOString(),
    actor,
    action,
    companyId,
  });
}

function checked(
  store: Store,
  companyId: string,
  value: LoanInput,
): {
  employeeId: string;
  date: string;
  amountPaise: number;
  installmentPaise: number;
  openingPaise: number;
} {
  const fields = input(value);
  if (
    !store.employees.some(
      (item) => item.id === fields.employeeId && item.companyId === companyId,
    )
  ) {
    throw new LoanError("Choose an employee in this company.");
  }
  if (!validDate(fields.date)) throw new LoanError("Enter a valid loan date.");
  const amountPaise = parseRupees(fields.amount, "loan amount", false);
  const installmentPaise = parseRupees(
    fields.installment,
    "monthly installment",
    false,
  );
  const openingPaise = parseRupees(
    fields.received,
    "cash already received",
    true,
  );
  if (amountPaise <= 0) throw new LoanError("Enter a loan amount above zero.");
  if (installmentPaise <= 0) {
    throw new LoanError("Enter a monthly installment above zero.");
  }
  if (openingPaise > amountPaise) {
    throw new LoanError("Cash already received cannot exceed the loan amount.");
  }
  return {
    employeeId: fields.employeeId,
    date: fields.date,
    amountPaise,
    installmentPaise,
    openingPaise,
  };
}

export function addLoan(
  store: Store,
  companyId: string,
  actor: string,
  value: LoanInput,
  newId: () => string,
): void {
  const fields = checked(store, companyId, value);
  store.loans.push({
    id: newId(),
    companyId,
    employeeId: fields.employeeId,
    date: fields.date,
    amountPaise: fields.amountPaise,
    installmentPaise: fields.installmentPaise,
    receivedPaise: fields.openingPaise,
    paidInstallments: 0,
    posts: [],
  });
  audit(
    store,
    companyId,
    actor,
    `Added loan for ${employeeCode(store, companyId, fields.employeeId)} dated ${fields.date}`,
    newId,
  );
}

export function updateLoan(
  store: Store,
  companyId: string,
  actor: string,
  id: string,
  value: LoanInput,
  newId: () => string,
): void {
  const loan = store.loans.find(
    (item) => item.id === id && item.companyId === companyId,
  );
  if (!loan) throw new LoanError("Loan not found.");
  const fields = checked(store, companyId, value);
  const posted = postedPaise(loan);
  if ((loan.posts ?? []).length > 0 && fields.employeeId !== loan.employeeId) {
    throw new LoanError(
      "Unlock the months that posted installments before changing the employee.",
    );
  }
  if (fields.openingPaise + posted > fields.amountPaise) {
    throw new LoanError("Loan amount is below the cash already received.");
  }
  loan.employeeId = fields.employeeId;
  loan.date = fields.date;
  loan.amountPaise = fields.amountPaise;
  loan.installmentPaise = fields.installmentPaise;
  loan.receivedPaise = fields.openingPaise + posted;
  audit(
    store,
    companyId,
    actor,
    `Edited loan for ${employeeCode(store, companyId, fields.employeeId)} dated ${fields.date}`,
    newId,
  );
}

export function deleteLoan(
  store: Store,
  companyId: string,
  actor: string,
  id: string,
  newId: () => string,
): void {
  const loan = store.loans.find(
    (item) => item.id === id && item.companyId === companyId,
  );
  if (!loan) throw new LoanError("Loan not found.");
  if ((loan.posts ?? []).length > 0) {
    throw new LoanError(
      "Unlock the months that posted installments before deleting this loan.",
    );
  }
  const code = employeeCode(store, companyId, loan.employeeId);
  const date = loan.date;
  store.loans = store.loans.filter((item) => item !== loan);
  audit(
    store,
    companyId,
    actor,
    `Deleted loan for ${code} dated ${date}`,
    newId,
  );
}

/** Add this month's installment to cash received. Processing itself does not. */
export function postLoanInstallments(
  store: Store,
  companyId: string,
  period: string,
  actor: string,
  newId: () => string,
): void {
  for (const loan of store.loans) {
    if (loan.companyId !== companyId) continue;
    loan.posts ??= [];
    loan.paidInstallments ??= 0;
    if (loan.posts.some((post) => post.period === period)) continue;
    const due = installmentDue(loan);
    if (due <= 0) continue;
    loan.posts.push({ period, paise: due });
    loan.receivedPaise += due;
    loan.paidInstallments += 1;
  }
  audit(
    store,
    companyId,
    actor,
    `Posted loan installments for ${period}`,
    newId,
  );
}

/** Remove the installment this lock added, and no other month's installment. */
export function reverseLoanInstallments(
  store: Store,
  companyId: string,
  period: string,
  actor: string,
  newId: () => string,
): void {
  for (const loan of store.loans) {
    if (loan.companyId !== companyId) continue;
    const post = (loan.posts ?? []).find((item) => item.period === period);
    if (!post) continue;
    loan.receivedPaise = Math.max(0, loan.receivedPaise - post.paise);
    loan.paidInstallments = Math.max(0, (loan.paidInstallments ?? 1) - 1);
    loan.posts = loan.posts.filter((item) => item.period !== period);
  }
  audit(
    store,
    companyId,
    actor,
    `Reversed loan installments for ${period}`,
    newId,
  );
}
