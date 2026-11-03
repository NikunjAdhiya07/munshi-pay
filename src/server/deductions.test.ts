import assert from "node:assert/strict";
import test from "node:test";
import { parseRupeeText } from "../domain/money.ts";
import {
  addDeduction,
  DeductionError,
  deleteDeduction,
  listedType,
  searchDeductions,
  updateDeduction,
} from "./deductions.ts";
import {
  buildInput,
  lockPeriod,
  PayrollError,
  processPeriod,
  unlockPeriod,
} from "./payroll.ts";
import { seedStore } from "./store.ts";

let counter = 0;
const newId = () => `id-${++counter}`;

const input = (
  overrides: Partial<Parameters<typeof addDeduction>[4]> = {},
) => ({
  employeeId: "e1",
  type: "Adv",
  amount: "1500",
  ...overrides,
});

function refused(run: () => void, pattern: RegExp) {
  assert.throws(run, (error) => {
    assert.ok(error instanceof DeductionError || error instanceof PayrollError);
    assert.match(error.message, pattern);
    return true;
  });
}

test("typed rupees become paise without float drift", () => {
  for (const [raw, paise] of [
    ["0.1", 10],
    ["0.29", 29],
    ["1,250.5", 125_050],
    [" 19.99 ", 1_999],
  ] as const) {
    assert.equal(parseRupeeText(raw), paise, raw);
  }
  for (const raw of ["", "-5", "1.005", "1e2", "₹10"]) {
    assert.equal(parseRupeeText(raw), null, raw);
  }
});

test("types come from the reference list, ignoring case", () => {
  assert.equal(listedType("food"), "Food");
  assert.equal(listedType(" OTH_D "), "Oth_D");
  assert.equal(listedType("Canteen"), null);
});

test("a deduction is added for the month with an audit entry that omits the amount", () => {
  const store = seedStore();
  const deduction = addDeduction(
    store,
    "c1",
    "2026-10",
    "tester",
    input({ type: "ebill", amount: "349.50" }),
    newId,
  );
  assert.equal(deduction.type, "Ebill");
  assert.equal(deduction.amountPaise, 34_950);
  assert.equal(deduction.period, "2026-10");
  assert.equal(
    store.audit[0]?.action,
    "Added deduction Ebill for E001 in 2026-10",
  );
  assert.doesNotMatch(store.audit[0]?.action ?? "", /349/);
});

test("invalid input is refused and nothing is saved", () => {
  const store = seedStore();
  const before = store.deductions.length;
  const add = (overrides: Parameters<typeof input>[0]) => () =>
    addDeduction(store, "c1", "2026-10", "t", input(overrides), newId);
  refused(add({ type: "" }), /type from the list/);
  refused(add({ type: "Canteen" }), /type from the list/);
  refused(add({ amount: "" }), /Enter the amount/);
  refused(add({ amount: "0" }), /more than zero/);
  refused(add({ amount: "12.345" }), /two decimals/);
  refused(add({ employeeId: "nobody" }), /Employee not found/);
  assert.equal(store.deductions.length, before);
});

test("a deduction is edited and deleted with audit entries", () => {
  const store = seedStore();
  updateDeduction(
    store,
    "c1",
    "tester",
    "d1",
    { type: "Other", amount: "300" },
    newId,
  );
  const row = store.deductions.find((item) => item.id === "d1");
  assert.equal(row?.type, "Other");
  assert.equal(row?.amountPaise, 30_000);
  assert.equal(row?.employeeId, "e2");
  assert.equal(
    store.audit[0]?.action,
    "Edited deduction Other for E002 in 2026-10",
  );
  deleteDeduction(store, "c1", "tester", "d1", newId);
  assert.ok(!store.deductions.some((item) => item.id === "d1"));
  assert.equal(
    store.audit[0]?.action,
    "Deleted deduction Other for E002 in 2026-10",
  );
});

test("a locked month refuses edit and delete, and allows them after unlock", () => {
  const store = seedStore();
  processPeriod(store, "c1", "2026-10", "tester");
  lockPeriod(store, "c1", "2026-10", "tester");
  const before = JSON.stringify(store.deductions);
  refused(
    () =>
      updateDeduction(
        store,
        "c1",
        "t",
        "d1",
        { type: "Food", amount: "1" },
        newId,
      ),
    /locked/,
  );
  refused(() => deleteDeduction(store, "c1", "t", "d1", newId), /locked/);
  refused(
    () => addDeduction(store, "c1", "2026-10", "t", input(), newId),
    /locked/,
  );
  assert.equal(JSON.stringify(store.deductions), before);
  unlockPeriod(store, "c1", "2026-10", "tester");
  deleteDeduction(store, "c1", "t", "d1", newId);
  assert.ok(!store.deductions.some((item) => item.id === "d1"));
});

test("another company cannot edit, delete, or add for this company's employee", () => {
  const store = seedStore();
  refused(
    () =>
      updateDeduction(
        store,
        "c2",
        "t",
        "d1",
        { type: "Food", amount: "1" },
        newId,
      ),
    /not found/,
  );
  refused(() => deleteDeduction(store, "c2", "t", "d1", newId), /not found/);
  refused(
    () => addDeduction(store, "c2", "2026-10", "t", input(), newId),
    /Employee not found/,
  );
  assert.ok(store.deductions.some((item) => item.id === "d1"));
});

test("the list filters by month and type within the company", () => {
  const store = seedStore();
  addDeduction(store, "c1", "2026-10", "t", input({ type: "Food" }), newId);
  addDeduction(store, "c1", "2026-10", "t", input({ type: "IT" }), newId);
  addDeduction(store, "c1", "2026-11", "t", input({ type: "Food" }), newId);
  store.deductions.push({
    id: "legacy",
    companyId: "c1",
    employeeId: "e1",
    period: "2026-10",
    type: "food",
    amountPaise: 100,
  });
  const ids = (period: string, type?: string) =>
    searchDeductions(store, "c1", { period, type }).map((item) => item.type);
  assert.deepEqual(ids("2026-10"), ["food", "Food", "IT", "Food"]);
  assert.deepEqual(ids("2026-10", "Food"), ["food", "Food", "Food"]);
  assert.deepEqual(ids("2026-11"), ["Food"]);
  assert.deepEqual(searchDeductions(store, "c2", { period: "2026-10" }), []);
});

test("processing uses the edited amount and drops a deleted deduction", () => {
  const store = seedStore();
  const ravi = store.employees.find((item) => item.id === "e2");
  assert.ok(ravi);
  assert.equal(buildInput(store, ravi, "2026-10").otherDeductionPaise, 25_000);
  updateDeduction(
    store,
    "c1",
    "t",
    "d1",
    { type: "Food", amount: "400" },
    newId,
  );
  assert.equal(buildInput(store, ravi, "2026-10").otherDeductionPaise, 40_000);
  deleteDeduction(store, "c1", "t", "d1", newId);
  assert.equal(buildInput(store, ravi, "2026-10").otherDeductionPaise, 0);
});
