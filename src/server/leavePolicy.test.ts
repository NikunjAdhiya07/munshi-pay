import assert from "node:assert/strict";
import test from "node:test";
import {
  addLeavePolicy,
  deleteLeavePolicy,
  LeavePolicyError,
  type LeavePolicyInput,
  leaveRecordsUsing,
  recordsBlockingDelete,
  updateLeavePolicy,
} from "./leavePolicy.ts";
import { seedStore } from "./store.ts";

let counter = 0;
const newId = () => `id-${++counter}`;

const input = (
  overrides: Partial<LeavePolicyInput> = {},
): LeavePolicyInput => ({
  cadre: "Worker",
  name: "Casual leave",
  duration: "6 days",
  ratio: "1 per 30 worked",
  ...overrides,
});

function refused(run: () => void, pattern: RegExp) {
  assert.throws(run, (error) => {
    assert.ok(error instanceof LeavePolicyError);
    assert.match(error.message, pattern);
    return true;
  });
}

const privilege = (store: ReturnType<typeof seedStore>) => {
  const policy = store.leavePolicies.find(
    (item) => item.name === "Privilege leave",
  );
  assert.ok(policy);
  return policy;
};

test("a policy is added trimmed with an audit entry", () => {
  const store = seedStore();
  const policy = addLeavePolicy(
    store,
    "c1",
    "tester",
    input({ cadre: "  Worker ", duration: "" }),
    newId,
  );
  assert.equal(policy.cadre, "Worker");
  assert.equal(policy.duration, "");
  assert.equal(policy.companyId, "c1");
  assert.equal(
    store.audit[0]?.action,
    "Added leave policy Casual leave for Worker",
  );
});

test("cadre and leave name are required, and every field is bounded", () => {
  const store = seedStore();
  const add = (overrides: Partial<LeavePolicyInput>) => () =>
    addLeavePolicy(store, "c1", "t", input(overrides), newId);
  refused(add({ cadre: " " }), /pay cadre/);
  refused(add({ name: "" }), /leave name/);
  refused(add({ cadre: "c".repeat(41) }), /Pay cadre must be 40/);
  refused(add({ name: "n".repeat(41) }), /Leave name must be 40/);
  refused(add({ duration: "d".repeat(41) }), /Duration must be 40/);
  refused(add({ ratio: "r".repeat(41) }), /Ratio must be 40/);
  add({ cadre: "c".repeat(40) })();
});

test("the same leave name is allowed for another cadre, not twice for one cadre", () => {
  const store = seedStore();
  addLeavePolicy(store, "c1", "t", input({ name: "Privilege leave" }), newId);
  refused(
    () =>
      addLeavePolicy(
        store,
        "c1",
        "t",
        input({ cadre: "staff", name: "privilege LEAVE" }),
        newId,
      ),
    /already has a policy for the staff cadre/,
  );
  // Another company is separate.
  addLeavePolicy(
    store,
    "c2",
    "t",
    input({ cadre: "Staff", name: "Privilege leave" }),
    newId,
  );
});

test("a refused add leaves the policies and audit unchanged", () => {
  const store = seedStore();
  const before = JSON.stringify([store.leavePolicies, store.audit]);
  refused(
    () => addLeavePolicy(store, "c1", "t", input({ cadre: "" }), newId),
    /pay cadre/,
  );
  assert.equal(JSON.stringify([store.leavePolicies, store.audit]), before);
});

test("editing keeps the cadre and name pair unique and allows its own pair", () => {
  const store = seedStore();
  const casual = addLeavePolicy(store, "c1", "t", input(), newId);
  refused(
    () =>
      updateLeavePolicy(
        store,
        "c1",
        "t",
        casual.id,
        input({ cadre: "Staff", name: "Privilege leave" }),
        newId,
      ),
    /already has a policy/,
  );
  updateLeavePolicy(
    store,
    "c1",
    "tester",
    casual.id,
    input({ duration: "8 days" }),
    newId,
  );
  assert.equal(casual.duration, "8 days");
  assert.equal(
    store.audit[0]?.action,
    "Edited leave policy Casual leave for Worker",
  );
});

test("renaming the only policy for a name moves the register and encashment rows", () => {
  const store = seedStore();
  store.encashments.push({
    id: "en1",
    companyId: "c1",
    employeeId: "e1",
    year: "2026",
    leaveName: "privilege leave",
    amountPaise: 100_000,
    used: 0,
    cashed: 0,
  });
  const policy = privilege(store);
  assert.equal(leaveRecordsUsing(store, "c1", "Privilege leave"), 2);
  updateLeavePolicy(
    store,
    "c1",
    "tester",
    policy.id,
    input({ cadre: "Staff", name: "Earned leave" }),
    newId,
  );
  assert.equal(store.leaveBalances[0]?.leaveName, "Earned leave");
  assert.equal(store.encashments[0]?.leaveName, "Earned leave");
  assert.match(
    store.audit[0]?.action ?? "",
    /Renamed leave Privilege leave to Earned leave for Staff \(2 records\)/,
  );
});

test("renaming one cadre's policy leaves the rows when another cadre keeps the name", () => {
  const store = seedStore();
  addLeavePolicy(store, "c1", "t", input({ name: "Privilege leave" }), newId);
  const policy = privilege(store);
  updateLeavePolicy(
    store,
    "c1",
    "t",
    policy.id,
    input({ cadre: "Staff", name: "Earned leave" }),
    newId,
  );
  assert.equal(store.leaveBalances[0]?.leaveName, "Privilege leave");
  assert.match(store.audit[0]?.action ?? "", /\(0 records\)/);
});

test("rows of another company are never renamed", () => {
  const store = seedStore();
  store.leaveBalances.push({
    id: "other",
    companyId: "c2",
    employeeId: "x",
    year: "2026",
    leaveName: "Privilege leave",
    broughtForward: 0,
    yearCount: 0,
    balance: 0,
  });
  updateLeavePolicy(
    store,
    "c1",
    "t",
    privilege(store).id,
    input({ cadre: "Staff", name: "Earned leave" }),
    newId,
  );
  assert.equal(
    store.leaveBalances.find((item) => item.id === "other")?.leaveName,
    "Privilege leave",
  );
});

test("the last policy for a name with records cannot be deleted", () => {
  const store = seedStore();
  const policy = privilege(store);
  assert.equal(recordsBlockingDelete(store, "c1", policy), 1);
  refused(
    () => deleteLeavePolicy(store, "c1", "t", policy.id, newId),
    /1 register or encashment record and no other cadre/,
  );
  assert.ok(store.leavePolicies.some((item) => item.id === policy.id));
});

test("a policy can be deleted when another cadre keeps the name or no record uses it", () => {
  const store = seedStore();
  const worker = addLeavePolicy(
    store,
    "c1",
    "t",
    input({ name: "Privilege leave" }),
    newId,
  );
  deleteLeavePolicy(store, "c1", "tester", worker.id, newId);
  assert.ok(!store.leavePolicies.some((item) => item.id === worker.id));
  assert.equal(
    store.audit[0]?.action,
    "Deleted leave policy Privilege leave for Worker",
  );

  const casual = addLeavePolicy(store, "c1", "t", input(), newId);
  deleteLeavePolicy(store, "c1", "t", casual.id, newId);
  assert.ok(!store.leavePolicies.some((item) => item.id === casual.id));
});

test("another company's policy cannot be edited or deleted", () => {
  const store = seedStore();
  const other = addLeavePolicy(store, "c2", "t", input(), newId);
  refused(
    () => updateLeavePolicy(store, "c1", "t", other.id, input(), newId),
    /not found/,
  );
  refused(
    () => deleteLeavePolicy(store, "c1", "t", other.id, newId),
    /not found/,
  );
  assert.ok(store.leavePolicies.some((item) => item.id === other.id));
});
