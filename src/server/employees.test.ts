import assert from "node:assert/strict";
import test from "node:test";
import { deleteEmployee, EmployeeError } from "./employees.ts";
import { processPeriod } from "./payroll.ts";
import { seedStore } from "./store.ts";

test("delete refuses a processed employee and removes one who was never processed", () => {
  const store = seedStore();
  processPeriod(store, "c1", "2026-10", "tester");
  const before = store.employees.length;
  assert.throws(
    () => deleteEmployee(store, "c1", "e1", "tester", "E001"),
    /left date/,
  );
  assert.equal(store.employees.length, before);
  assert.equal(
    store.audit.some((item) => item.action.includes("Deleted")),
    false,
  );

  store.employees.push({
    ...store.employees[0],
    id: "e-new",
    code: "E099",
    companyId: "c1",
  });
  deleteEmployee(store, "c1", "e-new", "tester", "E099");
  assert.equal(
    store.employees.some((item) => item.id === "e-new"),
    false,
  );
  const audit = store.audit[0];
  assert.equal(audit?.action, "Deleted employee e-new");
  assert.equal(audit?.actor, "tester");
  assert.equal(audit?.companyId, "c1");
  assert.equal(JSON.stringify(audit).includes("DEMO"), false);

  assert.throws(
    () => deleteEmployee(store, "c2", "e2", "tester", "E002"),
    EmployeeError,
  );
  assert.throws(
    () => deleteEmployee(store, "c1", "e2", "tester", "WRONG"),
    /employee code/,
  );
  assert.equal(
    store.employees.some((item) => item.id === "e2"),
    true,
  );
});
