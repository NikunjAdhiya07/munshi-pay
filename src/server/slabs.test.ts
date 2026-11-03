import assert from "node:assert/strict";
import test from "node:test";
import { can } from "./access.ts";
import type { PtSlab } from "./model.ts";
import { buildInput, lockPeriod, processPeriod } from "./payroll.ts";
import {
  addSlab,
  deleteSlab,
  overlappingSlabs,
  parseRupees,
  ptFor,
  SlabError,
  slabsInForce,
  updateSlab,
} from "./slabs.ts";
import { seedStore } from "./store.ts";

let counter = 0;
const newId = () => `id-${++counter}`;

const input = (overrides: Partial<Parameters<typeof addSlab>[3]> = {}) => ({
  asOn: "2026-04-01",
  state: "Gujarat",
  lower: "0",
  upper: "5999",
  amount: "0",
  ...overrides,
});

function refused(run: () => void, pattern: RegExp) {
  assert.throws(run, (error) => {
    assert.ok(error instanceof SlabError);
    assert.match(error.message, pattern);
    return true;
  });
}

function slab(overrides: Partial<PtSlab>): PtSlab {
  return {
    id: `slab-${++counter}`,
    companyId: "c1",
    asOn: "2026-04-01",
    state: "Gujarat",
    lowerPaise: 0,
    upperPaise: 0,
    amountPaise: 0,
    ...overrides,
  };
}

test("rupees parse to paise without float drift", () => {
  for (const [raw, paise] of [
    ["0", 0],
    ["200", 20_000],
    ["12000.5", 1_200_050],
    ["0.29", 29],
    ["1,00,000.10", 10_000_010],
  ] as const) {
    assert.equal(parseRupees(raw, "amount"), paise, raw);
  }
  for (const raw of ["", "-1", "1.234", "abc", "1e3"]) {
    assert.throws(() => parseRupees(raw, "amount"), SlabError, raw);
  }
});

test("a slab is added, edited, and deleted with audit entries that omit amounts", () => {
  const store = seedStore();
  const added = addSlab(
    store,
    "c1",
    "tester",
    input({ lower: "6000", upper: "8999", amount: "80" }),
    newId,
  );
  assert.equal(added.lowerPaise, 600_000);
  assert.equal(added.upperPaise, 899_900);
  assert.equal(added.amountPaise, 8_000);
  assert.equal(
    store.audit[0]?.action,
    "Added PT slab Gujarat as on 2026-04-01",
  );

  updateSlab(
    store,
    "c1",
    "tester",
    added.id,
    input({ lower: "6000", upper: "8999", amount: "150" }),
    newId,
  );
  assert.equal(added.amountPaise, 15_000);
  assert.equal(
    store.audit[0]?.action,
    "Edited PT slab Gujarat as on 2026-04-01",
  );

  deleteSlab(store, "c1", "tester", added.id, newId);
  assert.ok(!store.slabs.some((item) => item.id === added.id));
  assert.equal(
    store.audit[0]?.action,
    "Deleted PT slab Gujarat as on 2026-04-01",
  );
});

test("invalid slabs are refused and leave the store unchanged", () => {
  const store = seedStore();
  const before = store.slabs.length;
  refused(() => addSlab(store, "c1", "t", input({ asOn: "" }), newId), /as-on/);
  refused(
    () => addSlab(store, "c1", "t", input({ asOn: "2026-02-30" }), newId),
    /as-on/,
  );
  refused(
    () => addSlab(store, "c1", "t", input({ state: " " }), newId),
    /state/,
  );
  refused(
    () =>
      addSlab(store, "c1", "t", input({ lower: "9000", upper: "6000" }), newId),
    /below the lower/,
  );
  refused(
    () => addSlab(store, "c1", "t", input({ amount: "" }), newId),
    /PT amount/,
  );
  assert.equal(store.slabs.length, before);
});

test("another company's slab cannot be edited or deleted", () => {
  const store = seedStore();
  refused(
    () => updateSlab(store, "c2", "t", "pt1", input(), newId),
    /not found/,
  );
  refused(() => deleteSlab(store, "c2", "t", "pt1", newId), /not found/);
  assert.ok(store.slabs.some((item) => item.id === "pt1"));
  assert.equal(can("viewer", store.rights, "masters", "edit"), false);
  assert.equal(can("viewer", store.rights, "masters", "delete"), false);
  assert.equal(can("owner", store.rights, "masters", "delete"), true);
});

test("the latest slab set on or before the month end is in force", () => {
  const store = seedStore();
  store.slabs = [
    slab({
      id: "old",
      asOn: "2025-04-01",
      upperPaise: 99_999_999,
      amountPaise: 15_000,
    }),
    slab({
      id: "new",
      asOn: "2026-10-01",
      upperPaise: 99_999_999,
      amountPaise: 20_000,
    }),
    slab({
      id: "future",
      asOn: "2026-11-01",
      upperPaise: 99_999_999,
      amountPaise: 25_000,
    }),
    slab({
      id: "other",
      state: "Maharashtra",
      upperPaise: 99_999_999,
      amountPaise: 30_000,
    }),
  ];
  const cases = [
    { onDate: "2026-09-30", ids: ["old"], pt: 15_000 },
    { onDate: "2026-10-31", ids: ["new"], pt: 20_000 },
    { onDate: "2026-11-30", ids: ["future"], pt: 25_000 },
    { onDate: "2025-03-31", ids: [], pt: 0 },
  ];
  for (const { onDate, ids, pt } of cases) {
    assert.deepEqual(
      slabsInForce(store, "c1", "Gujarat", onDate).map((item) => item.id),
      ids,
      onDate,
    );
    assert.equal(ptFor(store, "c1", "Gujarat", 1_000_000, onDate), pt, onDate);
  }
  assert.equal(
    ptFor(store, "c1", " gujarat ", 1_000_000, "2026-10-31"),
    20_000,
  );
  assert.equal(ptFor(store, "c2", "Gujarat", 1_000_000, "2026-10-31"), 0);
});

test("slab limits are inclusive and an overlap or a gap charges no PT", () => {
  const store = seedStore();
  store.slabs = [
    slab({ id: "a", lowerPaise: 0, upperPaise: 599_900, amountPaise: 0 }),
    slab({
      id: "b",
      lowerPaise: 600_000,
      upperPaise: 899_900,
      amountPaise: 8_000,
    }),
    slab({
      id: "c",
      lowerPaise: 899_900,
      upperPaise: 1_199_900,
      amountPaise: 15_000,
    }),
  ];
  for (const [gross, pt] of [
    [0, 0],
    [599_900, 0],
    [599_950, 0],
    [600_000, 8_000],
    [899_800, 8_000],
    [899_900, 0],
    [1_199_900, 15_000],
    [1_200_000, 0],
  ] as const) {
    assert.equal(
      ptFor(store, "c1", "Gujarat", gross, "2026-10-31"),
      pt,
      String(gross),
    );
  }
  assert.deepEqual([...overlappingSlabs(store, "c1")].sort(), ["b", "c"]);
});

test("overlap warnings ignore other states, other as-on dates, and other companies", () => {
  const store = seedStore();
  store.slabs = [
    slab({ id: "a", upperPaise: 100_000 }),
    slab({ id: "b", state: "Maharashtra", upperPaise: 100_000 }),
    slab({ id: "c", asOn: "2026-10-01", upperPaise: 100_000 }),
    slab({ id: "d", companyId: "c2", upperPaise: 100_000 }),
    slab({ id: "e", lowerPaise: 100_001, upperPaise: 200_000 }),
  ];
  assert.equal(overlappingSlabs(store, "c1").size, 0);
});

test("processing uses the revised slab set instead of zeroing PT", () => {
  const store = seedStore();
  addSlab(
    store,
    "c1",
    "tester",
    input({
      asOn: "2026-10-01",
      lower: "0",
      upper: "999999.99",
      amount: "250",
    }),
    newId,
  );
  const asha = store.employees.find((item) => item.id === "e1");
  assert.ok(asha);
  assert.equal(buildInput(store, asha, "2026-09").ptPaise, 20_000);
  assert.equal(buildInput(store, asha, "2026-10").ptPaise, 25_000);
});

test("a locked month keeps its PT after a slab is edited", () => {
  const store = seedStore();
  const run = processPeriod(store, "c1", "2026-10", "tester");
  lockPeriod(store, "c1", "2026-10", "tester");
  const before = run.lines.find((line) => line.employeeId === "e1")?.ptPaise;
  updateSlab(
    store,
    "c1",
    "tester",
    "pt1",
    input({ lower: "0", upper: "999999.99", amount: "500" }),
    newId,
  );
  const after = store.runs
    .find((item) => item.id === run.id)
    ?.lines.find((line) => line.employeeId === "e1")?.ptPaise;
  assert.equal(after, before);
});
