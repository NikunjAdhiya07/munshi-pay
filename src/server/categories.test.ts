import assert from "node:assert/strict";
import test from "node:test";
import {
  addCategory,
  CategoryError,
  deleteCategory,
  parsePercent,
  salaryRowsUsing,
  updateCategory,
} from "./categories.ts";
import { lockPeriod, processPeriod } from "./payroll.ts";
import { seedStore } from "./store.ts";

let counter = 0;
const newId = () => `id-${++counter}`;

const input = (overrides: Partial<Parameters<typeof addCategory>[3]> = {}) => ({
  name: "Supervisor",
  structure: "gross" as const,
  basicPercent: "40",
  daPercent: "30",
  ...overrides,
});

function refused(run: () => void, pattern: RegExp) {
  assert.throws(run, (error) => {
    assert.ok(error instanceof CategoryError);
    assert.match(error.message, pattern);
    return true;
  });
}

test("a category is added with percents and an audit entry", () => {
  const store = seedStore();
  const category = addCategory(store, "c1", "tester", input(), newId);
  assert.equal(category.basicPercent, 40);
  assert.equal(category.daPercent, 30);
  assert.equal(category.structure, "gross");
  assert.equal(store.audit[0]?.action, "Added category Supervisor");
  assert.equal(store.audit[0]?.companyId, "c1");
});

test("percent parsing table", () => {
  const cases: [string, number | RegExp][] = [
    ["0", 0],
    ["100", 100],
    ["12.5", 12.5],
    ["33.33", 33.33],
    [" 50 ", 50],
    ["", /Enter the Basic percent/],
    ["-1", /number/],
    ["abc", /number/],
    ["1e2", /number/],
    ["12.345", /two decimals/],
    ["100.01", /number|above 100/],
    ["101", /above 100/],
  ];
  for (const [raw, expected] of cases) {
    if (typeof expected === "number") {
      assert.equal(parsePercent(raw, "Basic"), expected, raw);
    } else {
      refused(() => parsePercent(raw, "Basic"), expected);
    }
  }
});

test("basic plus DA above 100 is refused, exactly 100 is allowed", () => {
  const store = seedStore();
  refused(
    () =>
      addCategory(
        store,
        "c1",
        "t",
        input({ basicPercent: "60", daPercent: "40.01" }),
        newId,
      ),
    /cannot be above 100/,
  );
  const before = store.categories.length;
  addCategory(
    store,
    "c1",
    "t",
    input({ basicPercent: "60", daPercent: "40" }),
    newId,
  );
  assert.equal(store.categories.length, before + 1);
  // 12.1 + 87.9 is 100 in decimal but not in floating point.
  addCategory(
    store,
    "c1",
    "t",
    input({ name: "Float", basicPercent: "12.1", daPercent: "87.9" }),
    newId,
  );
});

test("a blank name, a long name, and a repeat name in the same list are refused", () => {
  const store = seedStore();
  refused(
    () => addCategory(store, "c1", "t", input({ name: "  " }), newId),
    /name/,
  );
  refused(
    () => addCategory(store, "c1", "t", input({ name: "x".repeat(61) }), newId),
    /60 characters/,
  );
  refused(
    () => addCategory(store, "c1", "t", input({ name: "staff" }), newId),
    /already exists/,
  );
  // The same name is allowed in the other list.
  addCategory(
    store,
    "c1",
    "t",
    input({ name: "Staff", structure: "ctc" }),
    newId,
  );
});

test("a refused save leaves the categories and audit unchanged", () => {
  const store = seedStore();
  const before = JSON.stringify([store.categories, store.audit]);
  refused(
    () => addCategory(store, "c1", "t", input({ daPercent: "" }), newId),
    /DA percent/,
  );
  assert.equal(JSON.stringify([store.categories, store.audit]), before);
});

test("editing changes percents, keeps the list, and allows keeping its own name", () => {
  const store = seedStore();
  const updated = updateCategory(
    store,
    "c1",
    "tester",
    "cat-staff",
    input({
      name: "Staff",
      structure: "ctc",
      basicPercent: "45",
      daPercent: "25",
    }),
    newId,
  );
  assert.equal(updated.basicPercent, 45);
  assert.equal(updated.daPercent, 25);
  assert.equal(updated.structure, "gross");
  assert.equal(store.audit[0]?.action, "Edited category Staff");
});

test("another company's category cannot be edited or deleted", () => {
  const store = seedStore();
  store.categories.push({
    id: "other",
    companyId: "c2",
    name: "Other",
    structure: "gross",
    basicPercent: 50,
    daPercent: 10,
  });
  refused(
    () => updateCategory(store, "c1", "t", "other", input(), newId),
    /not found/,
  );
  refused(() => deleteCategory(store, "c1", "t", "other", newId), /not found/);
  assert.ok(store.categories.some((item) => item.id === "other"));
  assert.equal(store.categories.find((i) => i.id === "other")?.name, "Other");
});

test("a category used by salary rows cannot be deleted", () => {
  const store = seedStore();
  assert.equal(salaryRowsUsing(store, "c1", "cat-staff"), 3);
  refused(
    () => deleteCategory(store, "c1", "t", "cat-staff", newId),
    /used by 3 salary rows/,
  );
  assert.ok(store.categories.some((item) => item.id === "cat-staff"));
});

test("an unused category is deleted with an audit entry", () => {
  const store = seedStore();
  const category = addCategory(store, "c1", "t", input(), newId);
  deleteCategory(store, "c1", "tester", category.id, newId);
  assert.ok(!store.categories.some((item) => item.id === category.id));
  assert.equal(store.audit[0]?.action, "Deleted category Supervisor");
});

test("after moving every row off a category it can be deleted", () => {
  const store = seedStore();
  for (const employee of store.employees) {
    for (const row of employee.salaryRows) {
      if (row.categoryId === "cat-worker") row.categoryId = "cat-staff";
    }
  }
  deleteCategory(store, "c1", "t", "cat-worker", newId);
  assert.ok(!store.categories.some((item) => item.id === "cat-worker"));
});

test("editing percents moves an open month but never a locked one", () => {
  const store = seedStore();
  const staff = (period: string) =>
    processPeriod(store, "c1", period, "t").lines.find(
      (line) => line.employeeId === "e1",
    );
  assert.equal(staff("2026-10")?.basicPaise, 2_000_000);
  updateCategory(
    store,
    "c1",
    "t",
    "cat-staff",
    input({ name: "Staff", basicPercent: "60", daPercent: "20" }),
    newId,
  );
  // A month that is only processed picks the new percents when processed again.
  assert.equal(staff("2026-10")?.basicPaise, 2_400_000);
  lockPeriod(store, "c1", "2026-10", "t");
  updateCategory(
    store,
    "c1",
    "t",
    "cat-staff",
    input({ name: "Staff", basicPercent: "10", daPercent: "10" }),
    newId,
  );
  const locked = store.runs.find((run) => run.period === "2026-10");
  assert.equal(
    locked?.lines.find((line) => line.employeeId === "e1")?.basicPaise,
    2_400_000,
  );
});
