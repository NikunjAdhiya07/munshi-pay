import assert from "node:assert/strict";
import test from "node:test";
import {
  addBalance,
  addEncashment,
  carryForward,
  deleteBalance,
  LeaveRegisterError,
  parseDays,
  policyLeaveNames,
  registerFor,
  updateBalance,
} from "./leaveRegister.ts";
import type { Store } from "./model.ts";
import { seedStore } from "./store.ts";

let counter = 0;
const newId = () => `id-${++counter}`;

const input = (overrides: Partial<Parameters<typeof addBalance>[3]> = {}) => ({
  employeeId: "e2",
  year: "2026",
  leaveName: "Privilege leave",
  broughtForward: "1",
  yearCount: "12",
  balance: "9.5",
  ...overrides,
});

function refused(run: () => void, pattern: RegExp) {
  assert.throws(run, (error) => {
    assert.ok(error instanceof LeaveRegisterError);
    assert.match(error.message, pattern);
    return true;
  });
}

function withCasualLeave(store: Store): Store {
  store.leavePolicies.push({
    id: "lp2",
    companyId: "c1",
    cadre: "Worker",
    name: "Casual leave",
    duration: "",
    ratio: "",
  });
  return store;
}

test("day counts accept whole and half days and refuse anything else", () => {
  for (const [raw, days] of [
    ["0", 0],
    ["12", 12],
    ["1.5", 1.5],
    [" 0.25 ", 0.25],
  ] as const) {
    assert.equal(parseDays(raw, "days"), days, raw);
  }
  for (const raw of ["", "-1", "1.234", "abc", "1000"]) {
    assert.throws(() => parseDays(raw, "days"), LeaveRegisterError, raw);
  }
});

test("leave names come from the policy once each, across cadres", () => {
  const store = withCasualLeave(seedStore());
  store.leavePolicies.push({
    id: "lp3",
    companyId: "c1",
    cadre: "Worker",
    name: "privilege leave",
    duration: "",
    ratio: "",
  });
  assert.deepEqual(policyLeaveNames(store, "c1"), [
    "Casual leave",
    "Privilege leave",
  ]);
  assert.deepEqual(policyLeaveNames(store, "c2"), []);
});

test("a balance is added as typed with an audit entry", () => {
  const store = seedStore();
  const row = addBalance(
    store,
    "c1",
    "tester",
    input({ leaveName: "privilege LEAVE" }),
    newId,
  );
  assert.equal(row.leaveName, "Privilege leave");
  assert.equal(row.broughtForward, 1);
  assert.equal(row.yearCount, 12);
  assert.equal(row.balance, 9.5);
  assert.equal(
    store.audit[0]?.action,
    "Added leave balance Privilege leave for E002 in 2026",
  );
});

test("invalid, unlisted, and duplicate balances are refused and nothing is saved", () => {
  const store = seedStore();
  const before = store.leaveBalances.length;
  const add = (overrides: Parameters<typeof input>[0]) => () =>
    addBalance(store, "c1", "t", input(overrides), newId);
  refused(add({ employeeId: "nobody" }), /Choose an employee/);
  refused(add({ year: "26" }), /four digits/);
  refused(add({ leaveName: "Sick leave" }), /leave policy/);
  refused(add({ balance: "" }), /Enter balance/);
  refused(add({ yearCount: "-2" }), /at most two decimals/);
  refused(add({ employeeId: "e1" }), /already has Privilege leave for 2026/);
  assert.equal(store.leaveBalances.length, before);
});

test("a balance is edited and deleted with audit entries, only inside its company", () => {
  const store = seedStore();
  refused(
    () =>
      updateBalance(
        store,
        "c2",
        "t",
        "lb1",
        { broughtForward: "0", yearCount: "0", balance: "0" },
        newId,
      ),
    /not found/,
  );
  refused(() => deleteBalance(store, "c2", "t", "lb1", newId), /not found/);
  updateBalance(
    store,
    "c1",
    "tester",
    "lb1",
    { broughtForward: "3", yearCount: "12", balance: "7" },
    newId,
  );
  const row = store.leaveBalances.find((item) => item.id === "lb1");
  assert.equal(row?.broughtForward, 3);
  assert.equal(row?.balance, 7);
  assert.equal(row?.employeeId, "e1");
  assert.equal(
    store.audit[0]?.action,
    "Edited leave balance Privilege leave for E001 in 2026",
  );
  deleteBalance(store, "c1", "tester", "lb1", newId);
  assert.ok(!store.leaveBalances.some((item) => item.id === "lb1"));
  assert.equal(
    store.audit[0]?.action,
    "Deleted leave balance Privilege leave for E001 in 2026",
  );
});

test("carry forward copies the balance into the next year and is safe to repeat", () => {
  const store = seedStore();
  const first = carryForward(store, "c1", "tester", "2026", newId);
  assert.deepEqual(first, { created: 1, skipped: 0, differing: 0 });
  const next = store.leaveBalances.filter((item) => item.year === "2027");
  assert.equal(next.length, 1);
  assert.equal(next[0]?.broughtForward, 10);
  assert.equal(next[0]?.yearCount, 0);
  assert.equal(next[0]?.balance, 10);
  assert.match(store.audit[0]?.action ?? "", /2026 to 2027 \(1 created, 0/);

  const again = carryForward(store, "c1", "tester", "2026", newId);
  assert.deepEqual(again, { created: 0, skipped: 1, differing: 0 });
  assert.equal(
    store.leaveBalances.filter((item) => item.year === "2027").length,
    1,
  );
});

test("carry forward never overwrites the next year and reports a changed balance", () => {
  const store = seedStore();
  carryForward(store, "c1", "t", "2026", newId);
  const target = store.leaveBalances.find((item) => item.year === "2027");
  assert.ok(target);
  target.yearCount = 12;
  target.balance = 20;
  updateBalance(
    store,
    "c1",
    "t",
    "lb1",
    { broughtForward: "2", yearCount: "12", balance: "6" },
    newId,
  );
  const result = carryForward(store, "c1", "t", "2026", newId);
  assert.deepEqual(result, { created: 0, skipped: 1, differing: 1 });
  assert.equal(target.broughtForward, 10);
  assert.equal(target.balance, 20);
});

test("carry forward adds only missing rows, stays in the company, and checks the year", () => {
  const store = withCasualLeave(seedStore());
  carryForward(store, "c1", "t", "2026", newId);
  addBalance(store, "c1", "t", input({ leaveName: "Casual leave" }), newId);
  store.leaveBalances.push({
    id: "c2-row",
    companyId: "c2",
    employeeId: "x",
    year: "2026",
    leaveName: "Privilege leave",
    broughtForward: 0,
    yearCount: 0,
    balance: 4,
  });
  const result = carryForward(store, "c1", "t", "2026", newId);
  assert.deepEqual(result, { created: 1, skipped: 1, differing: 0 });
  assert.equal(
    store.leaveBalances.filter(
      (item) => item.companyId === "c2" && item.year === "2027",
    ).length,
    0,
  );
  refused(() => carryForward(store, "c1", "t", "20x6", newId), /four digits/);
});

test("the register groups rows by employee and policy leave name, and flags repeats and unlisted names", () => {
  const store = withCasualLeave(seedStore());
  addBalance(store, "c1", "t", input({ leaveName: "Casual leave" }), newId);
  addBalance(store, "c1", "t", input(), newId);
  store.leaveBalances.push(
    {
      id: "repeat",
      companyId: "c1",
      employeeId: "e1",
      year: "2026",
      leaveName: "privilege leave",
      broughtForward: 2,
      yearCount: 12,
      balance: 10,
    },
    {
      id: "old-name",
      companyId: "c1",
      employeeId: "e1",
      year: "2026",
      leaveName: "Sick leave",
      broughtForward: 0,
      yearCount: 0,
      balance: 1,
    },
    {
      id: "other-year",
      companyId: "c1",
      employeeId: "e3",
      year: "2025",
      leaveName: "Privilege leave",
      broughtForward: 0,
      yearCount: 0,
      balance: 1,
    },
  );
  const register = registerFor(store, "c1", "2026");
  assert.deepEqual(register.columns, [
    "Casual leave",
    "Privilege leave",
    "Sick leave",
  ]);
  assert.deepEqual([...register.unlisted], ["Sick leave"]);
  assert.deepEqual(
    register.lines.map((line) => line.code),
    ["E001", "E002"],
  );
  const asha = register.lines[0];
  assert.equal(asha?.byLeave.get("Privilege leave")?.id, "lb1");
  assert.equal(asha?.byLeave.get("Sick leave")?.balance, 1);
  assert.equal(asha?.byLeave.has("Casual leave"), false);
  assert.deepEqual(
    register.duplicates.map((row) => row.id),
    ["repeat"],
  );
  assert.deepEqual(registerFor(store, "c2", "2026").lines, []);
});

test("encashment refuses an employee from another company", () => {
  const store = seedStore();
  const before = store.encashments.length;
  refused(
    () =>
      addEncashment(
        store,
        "c2",
        "t",
        {
          employeeId: "e1",
          year: "2026",
          leaveName: "Privilege leave",
          amountPaise: 0,
          used: "0",
          cashed: "0",
        },
        newId,
      ),
    /Choose an employee/,
  );
  assert.equal(store.encashments.length, before);
  const row = addEncashment(
    store,
    "c1",
    "t",
    {
      employeeId: "e1",
      year: "2026",
      leaveName: "Privilege leave",
      amountPaise: 100,
      used: "1",
      cashed: "1",
    },
    newId,
  );
  assert.equal(row.companyId, "c1");
  assert.equal(row.employeeId, "e1");
  assert.equal(
    store.audit.some((item) => item.action.includes("100")),
    false,
  );
});
