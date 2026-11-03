import assert from "node:assert/strict";
import test from "node:test";
import {
  addMisc,
  assertListed,
  deleteMisc,
  employeeCountUsing,
  MiscError,
  updateMisc,
} from "./misc.ts";
import { seedStore } from "./store.ts";

let counter = 0;
const newId = () => `id-${++counter}`;

function refused(run: () => void, pattern: RegExp) {
  assert.throws(run, (error) => {
    assert.ok(error instanceof MiscError);
    assert.match(error.message, pattern);
    return true;
  });
}

const find = (
  store: ReturnType<typeof seedStore>,
  type: string,
  description: string,
) => {
  const item = store.misc.find(
    (entry) => entry.type === type && entry.description === description,
  );
  assert.ok(item, `${type} ${description} is seeded`);
  return item;
};

test("an entry is added with a type, a trimmed description, and an audit entry", () => {
  const store = seedStore();
  const item = addMisc(
    store,
    "c1",
    "tester",
    { type: "department", description: "  Stores  " },
    newId,
  );
  assert.equal(item.description, "Stores");
  assert.equal(item.companyId, "c1");
  assert.equal(store.audit[0]?.action, "Added department Stores");
});

test("a missing type, a blank or long description, and a repeat are refused", () => {
  const store = seedStore();
  const add = (type: string, description: string) => () =>
    addMisc(store, "c1", "t", { type, description }, newId);
  refused(add("", "Stores"), /Choose a type/);
  refused(add("team", "Stores"), /Choose a type/);
  refused(add("department", "   "), /Enter a description/);
  refused(add("department", "x".repeat(61)), /60 characters/);
  refused(add("department", "accounts"), /already in the list/);
  // The same text is allowed in a different list.
  addMisc(
    store,
    "c1",
    "t",
    { type: "designation", description: "Accounts" },
    newId,
  );
});

test("a refused add leaves the lists and audit unchanged", () => {
  const store = seedStore();
  const before = JSON.stringify([store.misc, store.audit]);
  refused(
    () => addMisc(store, "c1", "t", { type: "bank", description: "" }, newId),
    /Enter a description/,
  );
  assert.equal(JSON.stringify([store.misc, store.audit]), before);
});

test("entries are counted per company by the text employees carry", () => {
  const store = seedStore();
  assert.equal(
    employeeCountUsing(store, "c1", find(store, "department", "Plant")),
    1,
  );
  assert.equal(
    employeeCountUsing(store, "c1", find(store, "department", "Accounts")),
    5,
  );
  // Salary bank and PF bank both count.
  assert.ok(
    employeeCountUsing(store, "c1", find(store, "bank", "Demo Bank")) >= 1,
  );
  assert.ok(
    employeeCountUsing(store, "c1", find(store, "bank", "Demo PF Bank")) >= 1,
  );
  // Another company's employees never count.
  assert.equal(
    employeeCountUsing(store, "c2", find(store, "department", "Plant")),
    0,
  );
});

test("renaming moves the employees who carried the old text", () => {
  const store = seedStore();
  const plant = find(store, "department", "Plant");
  updateMisc(store, "c1", "tester", plant.id, "Production", newId);
  assert.equal(plant.description, "Production");
  assert.equal(
    store.employees.find((e) => e.id === "e2")?.department,
    "Production",
  );
  assert.equal(
    store.employees.find((e) => e.id === "e1")?.department,
    "Accounts",
  );
  assert.match(
    store.audit[0]?.action ?? "",
    /Renamed department Plant to Production \(1 employee\)/,
  );
});

test("renaming to a name that is taken in the same list is refused and changes nothing", () => {
  const store = seedStore();
  const plant = find(store, "department", "Plant");
  refused(
    () => updateMisc(store, "c1", "t", plant.id, "accounts", newId),
    /already in the list/,
  );
  assert.equal(plant.description, "Plant");
  assert.equal(store.employees.find((e) => e.id === "e2")?.department, "Plant");
  // Changing only the letter case of its own name is allowed.
  updateMisc(store, "c1", "t", plant.id, "PLANT", newId);
  assert.equal(store.employees.find((e) => e.id === "e2")?.department, "PLANT");
});

test("renaming a bank moves both the salary bank and the PF bank", () => {
  const store = seedStore();
  const bank = find(store, "bank", "Demo Bank");
  const pf = find(store, "bank", "Demo PF Bank");
  updateMisc(store, "c1", "t", bank.id, "North Bank", newId);
  assert.equal(
    store.employees.find((e) => e.id === "e1")?.bankName,
    "North Bank",
  );
  assert.equal(
    store.employees.find((e) => e.id === "e1")?.pfBankName,
    "Demo PF Bank",
  );
  updateMisc(store, "c1", "t", pf.id, "North PF", newId);
  assert.equal(
    store.employees.find((e) => e.id === "e1")?.pfBankName,
    "North PF",
  );
});

test("an entry used by an employee cannot be deleted", () => {
  const store = seedStore();
  const plant = find(store, "department", "Plant");
  refused(
    () => deleteMisc(store, "c1", "t", plant.id, newId),
    /used by 1 employee\. Change those employees first/,
  );
  assert.ok(store.misc.some((item) => item.id === plant.id));
});

test("an unused entry is deleted with an audit entry, and after moving people it can be too", () => {
  const store = seedStore();
  const stores = addMisc(
    store,
    "c1",
    "t",
    { type: "department", description: "Stores" },
    newId,
  );
  deleteMisc(store, "c1", "tester", stores.id, newId);
  assert.ok(!store.misc.some((item) => item.id === stores.id));
  assert.equal(store.audit[0]?.action, "Deleted department Stores");

  const plant = find(store, "department", "Plant");
  const ravi = store.employees.find((e) => e.id === "e2");
  assert.ok(ravi);
  ravi.department = "Accounts";
  deleteMisc(store, "c1", "t", plant.id, newId);
  assert.ok(!store.misc.some((item) => item.id === plant.id));
});

test("another company's entry cannot be renamed or deleted", () => {
  const store = seedStore();
  store.misc.push({
    id: "other",
    companyId: "c2",
    type: "department",
    description: "Dock",
  });
  refused(
    () => updateMisc(store, "c1", "t", "other", "Yard", newId),
    /not found/,
  );
  refused(() => deleteMisc(store, "c1", "t", "other", newId), /not found/);
  assert.equal(
    store.misc.find((item) => item.id === "other")?.description,
    "Dock",
  );
});

test("employee forms accept listed values, blank, and an unchanged older value only", () => {
  const store = seedStore();
  assertListed(store, "c1", "department", "Plant", "");
  assertListed(store, "c1", "department", "plant", "");
  assertListed(store, "c1", "department", "", "Anything");
  assertListed(store, "c1", "department", "Old text", "Old text");
  refused(
    () => assertListed(store, "c1", "department", "Old text", "Plant"),
    /not in the list/,
  );
  refused(
    () => assertListed(store, "c1", "designation", "Plant", ""),
    /Designation Plant is not in the list/,
  );
  // Another company's entry does not count.
  store.misc.push({
    id: "x",
    companyId: "c2",
    type: "department",
    description: "Dock",
  });
  refused(
    () => assertListed(store, "c1", "department", "Dock", ""),
    /not in the list/,
  );
});
