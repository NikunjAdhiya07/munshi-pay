import assert from "node:assert/strict";
import test from "node:test";
import type { PayrollLine, Store } from "./model.ts";
import {
  buildSlip,
  buildSlips,
  MAX_SLIPS,
  PAYMENT_METHOD,
  parseSelection,
  slipEmployeeIds,
  slipReconciles,
} from "./slips.ts";
import { seedStore } from "./store.ts";

const line = (
  employeeId: string,
  overrides: Partial<PayrollLine> = {},
): PayrollLine => ({
  employeeId,
  basicPaise: 1_000_000,
  daPaise: 200_000,
  otherEarningPaise: 300_000,
  grossPaise: 1_500_000,
  pfPaise: 120_000,
  esiPaise: 9_000,
  ptPaise: 20_000,
  otherDeductionPaise: 25_000,
  loanPaise: 50_000,
  deductionPaise: 224_000,
  netPaise: 1_276_000,
  payable: true,
  exceptions: [],
  earningAdjustmentPaise: 0,
  deductionAdjustmentPaise: 0,
  ...overrides,
});

function storeWithRun(): Store {
  const store = seedStore();
  store.runs.push(
    {
      id: "r1",
      companyId: "c1",
      period: "2026-10",
      status: "locked",
      processedAt: "2026-10-07T00:00:00.000Z",
      lines: [line("e1"), line("e2"), line("e3", { payable: false })],
    },
    {
      id: "r2",
      companyId: "c2",
      period: "2026-10",
      status: "calculated",
      processedAt: "2026-10-07T00:00:00.000Z",
      lines: [line("x1")],
    },
  );
  store.employees.push({
    ...store.employees[0],
    id: "x1",
    companyId: "c2",
    code: "H001",
    name: "Other company person",
  });
  return store;
}

test("a slip carries the company, employee, payment, days, and month", () => {
  const store = storeWithRun();
  const slip = buildSlip(store, "c1", "2026-10", "e1");
  assert.ok(slip);
  assert.equal(slip.company.name, store.companies[0].name);
  assert.equal(slip.company.state, store.companies[0].state);
  assert.equal(slip.period, "2026-10");
  assert.equal(slip.runStatus, "locked");
  assert.equal(slip.employee.code, "E001");
  assert.equal(slip.employee.name, "Asha Rao");
  assert.equal(slip.employee.designation, store.employees[0].designation);
  assert.equal(slip.employee.department, store.employees[0].department);
  assert.equal(slip.paymentMethod, "Bank transfer");
  assert.equal(slip.paidDays, 26);
});

test("earnings come before deductions and match the saved totals", () => {
  const slip = buildSlip(storeWithRun(), "c1", "2026-10", "e1");
  assert.ok(slip);
  assert.deepEqual(
    slip.earnings.map((item) => [item.label, item.paise]),
    [
      ["Basic", 1_000_000],
      ["DA", 200_000],
      ["Other earnings", 300_000],
    ],
  );
  assert.deepEqual(
    slip.deductions.map((item) => [item.label, item.paise]),
    [
      ["PF", 120_000],
      ["ESI", 9_000],
      ["Professional tax", 20_000],
      ["Other deductions", 25_000],
      ["Loan", 50_000],
    ],
  );
  assert.equal(slip.grossPaise, 1_500_000);
  assert.equal(slip.totalDeductionsPaise, 224_000);
  assert.equal(slip.netPaise, 1_276_000);
  assert.ok(slipReconciles(slip));
});

test("a typed adjustment gets its own labeled row and the totals still match", () => {
  const store = storeWithRun();
  const saved = store.runs[0].lines[0];
  // The engine folds an adjustment into "other", so the saved line holds it there.
  Object.assign(saved, {
    earningAdjustmentPaise: -40_000,
    otherEarningPaise: 260_000,
    grossPaise: 1_460_000,
    deductionAdjustmentPaise: 10_000,
    otherDeductionPaise: 35_000,
    deductionPaise: 234_000,
    netPaise: 1_226_000,
  });
  const slip = buildSlip(store, "c1", "2026-10", "e1");
  assert.ok(slip);
  assert.deepEqual(slip.earnings.at(-1), {
    label: "Earning adjustment",
    paise: -40_000,
  });
  assert.equal(
    slip.earnings.find((item) => item.label === "Other earnings")?.paise,
    300_000,
  );
  assert.deepEqual(slip.deductions.at(-1), {
    label: "Deduction adjustment",
    paise: 10_000,
  });
  assert.equal(
    slip.deductions.find((item) => item.label === "Other deductions")?.paise,
    25_000,
  );
  assert.ok(slipReconciles(slip));
});

test("a slip is read from the saved line, not recalculated", () => {
  const store = storeWithRun();
  store.runs[0].lines[0].netPaise = 1;
  assert.equal(buildSlip(store, "c1", "2026-10", "e1")?.netPaise, 1);
  assert.equal(
    slipReconciles(buildSlip(store, "c1", "2026-10", "e1") as never),
    false,
    "a drifted line is reported, not hidden",
  );
});

test("paid days are blank when the month has no muster", () => {
  const store = storeWithRun();
  assert.equal(buildSlip(store, "c1", "2026-10", "e2")?.paidDays, 20);
  store.muster = store.muster.filter((item) => item.employeeId !== "e2");
  assert.equal(buildSlip(store, "c1", "2026-10", "e2")?.paidDays, null);
});

test("payment method has a plain label for every kind", () => {
  assert.deepEqual(PAYMENT_METHOD, {
    bank: "Bank transfer",
    cash: "Cash",
    cheque: "Cheque",
  });
  const store = storeWithRun();
  store.employees[0].paymentBy = "cheque";
  assert.equal(
    buildSlip(store, "c1", "2026-10", "e1")?.paymentMethod,
    "Cheque",
  );
});

test("no slip for an unpayable line, an unprocessed month, or another company", () => {
  const store = storeWithRun();
  assert.equal(buildSlip(store, "c1", "2026-10", "e3"), null);
  assert.equal(buildSlip(store, "c1", "2026-09", "e1"), null);
  assert.equal(buildSlip(store, "c1", "2026-10", "x1"), null);
  assert.equal(buildSlip(store, "c2", "2026-10", "e1"), null);
  assert.equal(buildSlip(store, "c1", "2026-10", "missing"), null);
  assert.equal(buildSlip(store, "c2", "2026-10", "x1")?.employee.code, "H001");
});

test("every payable employee is listed once, in the run's order", () => {
  const store = storeWithRun();
  assert.deepEqual(slipEmployeeIds(store, "c1", "2026-10"), ["e1", "e2"]);
  assert.deepEqual(slipEmployeeIds(store, "c2", "2026-10"), ["x1"]);
  assert.deepEqual(slipEmployeeIds(store, "c1", "2026-09"), []);
});

test("all slips, or only the chosen ones", () => {
  const store = storeWithRun();
  const ids = (list: ReturnType<typeof buildSlips>) =>
    list.map((slip) => slip.employeeId);
  assert.deepEqual(ids(buildSlips(store, "c1", "2026-10", null)), ["e1", "e2"]);
  assert.deepEqual(ids(buildSlips(store, "c1", "2026-10", ["e2"])), ["e2"]);
  assert.deepEqual(ids(buildSlips(store, "c1", "2026-10", ["e2", "e1"])), [
    "e1",
    "e2",
  ]);
  assert.deepEqual(
    ids(buildSlips(store, "c1", "2026-10", ["e1", "e1", "e3", "x1", "nope"])),
    ["e1"],
    "repeated, unpayable, other-company, and unknown ids are dropped",
  );
  assert.deepEqual(ids(buildSlips(store, "c1", "2026-10", [])), []);
});

test("a selection is trimmed, de-duplicated, and capped", () => {
  assert.deepEqual(parseSelection(undefined), []);
  assert.deepEqual(parseSelection("e1"), ["e1"]);
  assert.deepEqual(parseSelection([" e1 ", "e2", "e1", ""]), ["e1", "e2"]);
  const many = Array.from({ length: MAX_SLIPS + 20 }, (_, i) => `id${i}`);
  assert.equal(parseSelection(many).length, MAX_SLIPS);
});

test("building slips does not change the store", () => {
  const store = storeWithRun();
  const before = JSON.stringify(store);
  buildSlips(store, "c1", "2026-10", null);
  buildSlip(store, "c2", "2026-10", "x1");
  assert.equal(JSON.stringify(store), before);
});
