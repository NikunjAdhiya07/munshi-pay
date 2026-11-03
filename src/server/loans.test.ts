import assert from "node:assert/strict";
import test from "node:test";
import { can } from "./access.ts";
import {
  addLoan,
  deleteLoan,
  installmentDue,
  LoanError,
  updateLoan,
} from "./loans.ts";
import {
  buildInput,
  lockPeriod,
  processPeriod,
  unlockPeriod,
} from "./payroll.ts";
import { seedStore } from "./store.ts";

let counter = 0;
const newId = () => `id-${++counter}`;

const fields = (overrides: Record<string, string> = {}) => ({
  employeeId: "e1",
  date: "2026-05-01",
  amount: "5000",
  installment: "1000",
  received: "0",
  ...overrides,
});

const refused = (run: () => void, pattern: RegExp) => {
  assert.throws(run, (error: unknown) => {
    assert.ok(error instanceof LoanError);
    assert.match(error.message, pattern);
    return true;
  });
};

test("a loan is added, edited, and deleted without writing amounts to the audit", () => {
  const store = seedStore();
  addLoan(store, "c1", "tester", fields({ amount: "1250.50" }), newId);
  const loan = store.loans.find((item) => item.date === "2026-05-01");
  assert.ok(loan);
  assert.equal(loan.amountPaise, 125_050);
  assert.equal(loan.installmentPaise, 100_000);
  assert.equal(loan.receivedPaise, 0);
  assert.equal(loan.paidInstallments, 0);
  updateLoan(
    store,
    "c1",
    "tester",
    loan.id,
    fields({ installment: "250.25", received: "100" }),
    newId,
  );
  assert.equal(loan.installmentPaise, 25_025);
  assert.equal(loan.receivedPaise, 10_000);
  deleteLoan(store, "c1", "tester", loan.id, newId);
  assert.equal(
    store.loans.some((item) => item.id === loan.id),
    false,
  );
  const text = store.audit
    .slice(0, 3)
    .map((item) => item.action)
    .join("\n");
  assert.match(text, /Added loan for E001 dated 2026-05-01/);
  assert.match(text, /Edited loan for E001 dated 2026-05-01/);
  assert.match(text, /Deleted loan for E001 dated 2026-05-01/);
  assert.equal(text.includes("125050"), false);
  assert.equal(text.includes("25025"), false);
  assert.equal(can("viewer", store.rights, "loans", "edit"), false);
  assert.equal(can("viewer", store.rights, "loans", "delete"), false);
  assert.equal(can("owner", store.rights, "loans", "delete"), true);
});

test("invalid loans are refused and leave the store unchanged", () => {
  const store = seedStore();
  const before = store.loans.length;
  refused(
    () => addLoan(store, "c1", "t", fields({ employeeId: "e9" }), newId),
    /employee/,
  );
  refused(
    () => addLoan(store, "c1", "t", fields({ date: "2026-02-30" }), newId),
    /date/,
  );
  refused(
    () => addLoan(store, "c1", "t", fields({ amount: "" }), newId),
    /loan amount/,
  );
  refused(
    () => addLoan(store, "c1", "t", fields({ amount: "0" }), newId),
    /above zero/,
  );
  refused(
    () => addLoan(store, "c1", "t", fields({ installment: "0" }), newId),
    /installment/,
  );
  refused(
    () => addLoan(store, "c1", "t", fields({ received: "6000" }), newId),
    /cannot exceed/,
  );
  assert.equal(store.loans.length, before);
});

test("another company's loan cannot be edited or deleted", () => {
  const store = seedStore();
  refused(
    () => updateLoan(store, "c2", "t", "ln1", fields(), newId),
    /not found/,
  );
  refused(() => deleteLoan(store, "c2", "t", "ln1", newId), /not found/);
  assert.ok(store.loans.some((item) => item.id === "ln1"));
});

test("locking posts the installment and unlocking restores the balance", () => {
  const store = seedStore();
  const loan = store.loans.find((item) => item.id === "ln1");
  assert.ok(loan);
  loan.amountPaise = 150_000;
  loan.installmentPaise = 100_000;
  const asha = store.employees.find((item) => item.id === "e1");
  assert.ok(asha);
  processPeriod(store, "c1", "2026-10", "tester");
  assert.equal(loan.receivedPaise, 0);
  assert.equal(buildInput(store, asha, "2026-10").loanPaise, 100_000);
  lockPeriod(store, "c1", "2026-10", "tester");
  assert.equal(loan.receivedPaise, 100_000);
  assert.equal(loan.paidInstallments, 1);
  assert.equal(installmentDue(loan), 50_000);
  processPeriod(store, "c1", "2026-11", "tester");
  assert.equal(buildInput(store, asha, "2026-11").loanPaise, 50_000);
  lockPeriod(store, "c1", "2026-11", "tester");
  assert.equal(loan.receivedPaise, 150_000);
  assert.equal(loan.paidInstallments, 2);
  assert.equal(installmentDue(loan), 0);
  processPeriod(store, "c1", "2026-12", "tester");
  assert.equal(buildInput(store, asha, "2026-12").loanPaise, 0);
  unlockPeriod(store, "c1", "2026-11", "tester");
  assert.equal(loan.receivedPaise, 100_000);
  assert.equal(loan.paidInstallments, 1);
  assert.deepEqual(
    loan.posts.map((post) => post.period),
    ["2026-10"],
  );
  const text = store.audit.map((item) => item.action).join("\n");
  assert.match(text, /Posted loan installments for 2026-10/);
  assert.match(text, /Reversed loan installments for 2026-11/);
  assert.equal(text.includes("100000"), false);
  assert.equal(text.includes("150000"), false);
});

test("a posted loan cannot be deleted, and another company is not posted", () => {
  const store = seedStore();
  store.loans.push({
    id: "other",
    companyId: "c2",
    employeeId: "e1",
    date: "2026-04-01",
    amountPaise: 100_000,
    installmentPaise: 100_000,
    receivedPaise: 0,
    paidInstallments: 0,
    posts: [],
  });
  processPeriod(store, "c1", "2026-10", "tester");
  lockPeriod(store, "c1", "2026-10", "tester");
  const other = store.loans.find((item) => item.id === "other");
  assert.equal(other?.receivedPaise, 0);
  refused(() => deleteLoan(store, "c1", "t", "ln1", newId), /Unlock/);
  assert.ok(store.loans.some((item) => item.id === "ln1"));
});
