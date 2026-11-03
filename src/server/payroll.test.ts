import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { can } from "./access.ts";
import { recordMuster } from "./muster.ts";
import {
  lockPeriod,
  PayrollError,
  processPeriod,
  recordDeduction,
  unlockPeriod,
} from "./payroll.ts";
import { seedStore } from "./store.ts";

test("processing a month records the four reference exceptions and payable nets", () => {
  const store = seedStore();
  const run = processPeriod(store, "c1", "2026-10", "tester");
  const codes = new Set(
    run.lines.flatMap((line) => line.exceptions.map((item) => item.code)),
  );
  assert.ok(codes.has("empty-rate"));
  assert.ok(codes.has("empty-category"));
  assert.ok(codes.has("left-employee"));
  assert.ok(codes.has("esi-above-limit"));

  const asha = run.lines.find((line) => line.employeeId === "e1");
  assert.equal(asha?.payable, true);
  assert.equal(asha?.pfPaise, 0);
  assert.equal(asha?.netPaise, 4_000_000 - 20_000 - 100_000);

  const ravi = run.lines.find((line) => line.employeeId === "e2");
  assert.equal(ravi?.grossPaise, 1_600_000);
  assert.equal(ravi?.netPaise, 1_600_000 - 20_000 - 25_000);

  assert.equal(run.lines.filter((line) => line.payable).length, 3);
  assert.equal(run.status, "in-review");
});

test("a locked period cannot be processed again", () => {
  const store = seedStore();
  processPeriod(store, "c1", "2026-10", "tester");
  lockPeriod(store, "c1", "2026-10", "tester");
  assert.throws(
    () => processPeriod(store, "c1", "2026-10", "tester"),
    PayrollError,
  );
});

const counts = () => ({
  paidDays: 20,
  weekOff: 4,
  publicHoliday: 1,
  compOff: 0,
  onDuty: 0,
});
let nextId = 0;
const newId = () => `test-${++nextId}`;
const deduction = { employeeId: "e1", type: "Food", amountPaise: 50_000 };

test("a locked period rejects muster and deduction writes and leaves them unchanged", () => {
  const store = seedStore();
  processPeriod(store, "c1", "2026-10", "tester");
  lockPeriod(store, "c1", "2026-10", "tester");
  const muster = JSON.stringify(store.muster);
  const deductions = JSON.stringify(store.deductions);
  assert.throws(
    () => recordMuster(store, "c1", "2026-10", counts, newId),
    PayrollError,
  );
  assert.throws(
    () => recordDeduction(store, "c1", "2026-10", deduction, newId),
    PayrollError,
  );
  assert.equal(JSON.stringify(store.muster), muster);
  assert.equal(JSON.stringify(store.deductions), deductions);
});

test("muster and deduction writes are accepted after unlock", () => {
  const store = seedStore();
  processPeriod(store, "c1", "2026-10", "tester");
  lockPeriod(store, "c1", "2026-10", "tester");
  unlockPeriod(store, "c1", "2026-10", "tester");
  const before = store.deductions.length;
  recordMuster(store, "c1", "2026-10", counts, newId);
  recordDeduction(store, "c1", "2026-10", deduction, newId);
  const row = store.muster.find(
    (item) => item.employeeId === "e1" && item.period === "2026-10",
  );
  assert.equal(row?.paidDays, 20);
  assert.equal(store.deductions.length, before + 1);
});

test("a lock on one month does not block the next month", () => {
  const store = seedStore();
  processPeriod(store, "c1", "2026-10", "tester");
  lockPeriod(store, "c1", "2026-10", "tester");
  recordMuster(store, "c1", "2026-11", counts, newId);
  recordDeduction(store, "c1", "2026-11", deduction, newId);
  assert.ok(
    store.muster.some(
      (item) => item.employeeId === "e1" && item.period === "2026-11",
    ),
  );
});

test("a deduction for another company's employee is rejected", () => {
  const store = seedStore();
  const before = store.deductions.length;
  assert.throws(
    () => recordDeduction(store, "c2", "2026-10", deduction, newId),
    PayrollError,
  );
  assert.equal(store.deductions.length, before);
});

test("a viewer cannot add employees", () => {
  const store = seedStore();
  assert.equal(can("viewer", store.rights, "employees", "add"), false);
  assert.equal(can("owner", store.rights, "employees", "add"), true);
});

test("the local store round-trips", async () => {
  const { readStore, resetStoreCache, writeStore } = await import("./store.ts");
  const file = path.join(os.tmpdir(), `munshi-store-${Date.now()}.json`);
  process.env.STORE_PATH = file;
  resetStoreCache();
  const store = seedStore();
  writeStore(store);
  resetStoreCache();
  assert.equal(readStore().companies.length, 2);
  fs.rmSync(file, { force: true });
  delete process.env.STORE_PATH;
  resetStoreCache();
});
