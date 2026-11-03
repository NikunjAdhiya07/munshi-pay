import assert from "node:assert/strict";
import test from "node:test";
import { maskSecret } from "../domain/employees.ts";
import {
  addEmployee,
  codeTaken,
  EmployeeError,
  type NewEmployeeInput,
  nextCodeFor,
  type ProfileInput,
  updateProfile,
} from "./employees.ts";
import { MiscError } from "./misc.ts";
import { seedStore } from "./store.ts";

let counter = 0;
const newId = () => `t${++counter}`;

function newInput(patch: Partial<NewEmployeeInput> = {}): NewEmployeeInput {
  return {
    firstName: "Meera",
    middleName: "",
    lastName: "Nair",
    joinDate: "2026-10-01",
    gender: "female",
    salaryBase: "salary",
    department: "Accounts",
    designation: "Accountant",
    mobile: "9000000000",
    email: "meera@example.test",
    pfDeduct: true,
    esiDeduct: true,
    ...patch,
  };
}

function profileOf(store: ReturnType<typeof seedStore>, id = "e1") {
  const employee = store.employees.find((item) => item.id === id);
  assert.ok(employee);
  const input: ProfileInput = {
    firstName: employee.firstName ?? employee.name,
    middleName: employee.middleName ?? "",
    lastName: employee.lastName ?? "",
    joinDate: employee.joinDate,
    gender: employee.gender,
    salaryBase: employee.salaryBase,
    department: employee.department,
    designation: employee.designation,
    mobile: employee.mobile,
    email: employee.email,
    pfDeduct: employee.pfDeduct,
    esiDeduct: employee.esiDeduct,
    paymentBy: employee.paymentBy,
    bankName: employee.bankName,
    ifsc: employee.ifsc,
    account: maskSecret(employee.account),
    payee: employee.payee,
    marital: employee.marital,
    birthDate: employee.birthDate,
    leftDate: employee.leftDate,
    leftReason: employee.leftReason,
    localAddress: employee.localAddress ?? "",
    permanentAddress: employee.permanentAddress ?? "",
    pan: maskSecret(employee.pan),
    aadhaar: maskSecret(employee.aadhaar),
    voluntaryPf: employee.voluntaryPf,
    pfNumber: employee.pfNumber,
    uan: employee.uan,
    epfMode: employee.epfMode,
    pfJoinDate: employee.pfJoinDate ?? "",
    pfLeaveDate: employee.pfLeaveDate ?? "",
    pfLeaveReason: employee.pfLeaveReason ?? "",
    esiNumber: employee.esiNumber,
    esiDispensary: employee.esiDispensary ?? "",
    esiJoinDate: employee.esiJoinDate ?? "",
    esiLeaveDate: employee.esiLeaveDate ?? "",
    esiLeaveReason: employee.esiLeaveReason ?? "",
    bonusEligible: employee.bonusEligible ?? true,
    leaveEncashment: employee.leaveEncashment ?? true,
    abry: employee.abry ?? false,
  };
  return input;
}

test("a new employee gets the next code of the company and a built name", () => {
  const store = seedStore();
  const expected = nextCodeFor(store, "c1");
  const employee = addEmployee(
    store,
    "c1",
    "tester",
    newInput({ middleName: "K" }),
    newId,
  );
  assert.equal(employee.code, expected);
  assert.equal(employee.name, "Meera K Nair");
  assert.equal(employee.payee, "Meera K Nair");
  assert.equal(employee.companyId, "c1");
  assert.equal(employee.gender, "female");
  assert.equal(employee.joinDate, "2026-10-01");
  assert.equal(employee.leftDate, "");
  assert.ok(store.employees.includes(employee));
  assert.equal(nextCodeFor(store, "c1") === expected, false);
});

test("new employees take their own flags and the usual defaults", () => {
  const store = seedStore();
  const off = addEmployee(
    store,
    "c1",
    "tester",
    newInput({ pfDeduct: false, esiDeduct: false }),
    newId,
  );
  assert.equal(off.pfDeduct, false);
  assert.equal(off.esiDeduct, false);
  assert.equal(off.bonusEligible, true);
  assert.equal(off.leaveEncashment, true);
  assert.equal(off.abry, false);
  assert.equal(off.pan, "");
  assert.equal(off.aadhaar, "");
  assert.deepEqual(off.salaryRows, []);
});

test("codes are counted per company and never repeat", () => {
  const store = seedStore();
  const first = addEmployee(store, "c1", "tester", newInput(), newId);
  const second = addEmployee(store, "c1", "tester", newInput(), newId);
  assert.notEqual(first.code, second.code);
  assert.ok(codeTaken(store, "c1", first.code.toLowerCase()));
  assert.equal(codeTaken(store, "c1", first.code, first.id), false);
});

test("a refused new employee leaves the store untouched", () => {
  const store = seedStore();
  const people = store.employees.length;
  const audits = store.audit.length;
  const refused: Array<[Partial<NewEmployeeInput>, RegExp]> = [
    [{ firstName: "", lastName: "" }, /name/],
    [{ firstName: "x".repeat(61) }, /60 characters/],
    [{ joinDate: "" }, /Join date/],
    [{ joinDate: "2026-02-30" }, /Join date/],
    [{ gender: "other" }, /Gender/],
    [{ salaryBase: "weekly" }, /Salary base/],
    [{ mobile: "9".repeat(21) }, /Mobile/],
  ];
  for (const [patch, message] of refused) {
    assert.throws(
      () => addEmployee(store, "c1", "tester", newInput(patch), newId),
      (error) => error instanceof EmployeeError && message.test(error.message),
      JSON.stringify(patch),
    );
  }
  assert.throws(
    () =>
      addEmployee(
        store,
        "c1",
        "tester",
        newInput({ department: "Nowhere" }),
        newId,
      ),
    MiscError,
  );
  assert.equal(store.employees.length, people);
  assert.equal(store.audit.length, audits);
});

test("adding an employee is audited with the code and no personal values", () => {
  const store = seedStore();
  const employee = addEmployee(store, "c1", "tester", newInput(), newId);
  const entry = store.audit[0];
  assert.equal(entry?.action, `Added employee ${employee.code}`);
  assert.equal(entry?.actor, "tester");
  assert.equal(entry?.companyId, "c1");
  const text = JSON.stringify(entry);
  assert.equal(text.includes("Meera"), false);
  assert.equal(text.includes("9000000000"), false);
});

test("an untouched masked field keeps the saved identity and account", () => {
  const store = seedStore();
  const before = store.employees.find((item) => item.id === "e1");
  assert.ok(before);
  const saved = {
    pan: before.pan,
    aadhaar: before.aadhaar,
    account: before.account,
  };
  const input = profileOf(store);
  input.mobile = "9111111111";
  updateProfile(store, "c1", "tester", "e1", input, newId);
  assert.equal(before.mobile, "9111111111");
  assert.equal(before.pan, saved.pan);
  assert.equal(before.aadhaar, saved.aadhaar);
  assert.equal(before.account, saved.account);
});

test("a typed or cleared identity field replaces the saved one", () => {
  const store = seedStore();
  const input = profileOf(store);
  input.pan = "ABCDE1234F";
  input.aadhaar = "";
  updateProfile(store, "c1", "tester", "e1", input, newId);
  const saved = store.employees.find((item) => item.id === "e1");
  assert.equal(saved?.pan, "ABCDE1234F");
  assert.equal(saved?.aadhaar, "");
});

test("the profile builds the name and records the extra fields", () => {
  const store = seedStore();
  const input = profileOf(store);
  Object.assign(input, {
    firstName: "Asha",
    middleName: "",
    lastName: "Rao",
    localAddress: "12 Mill Road",
    permanentAddress: "4 Lake View",
    pfJoinDate: "2024-04-01",
    pfLeaveDate: "2025-03-31",
    esiDispensary: "City dispensary",
    esiJoinDate: "2024-04-01",
    bonusEligible: false,
    leaveEncashment: false,
    abry: true,
  });
  const employee = updateProfile(store, "c1", "tester", "e1", input, newId);
  assert.equal(employee.name, "Asha Rao");
  assert.equal(employee.firstName, "Asha");
  assert.equal(employee.localAddress, "12 Mill Road");
  assert.equal(employee.permanentAddress, "4 Lake View");
  assert.equal(employee.pfLeaveDate, "2025-03-31");
  assert.equal(employee.esiDispensary, "City dispensary");
  assert.equal(employee.bonusEligible, false);
  assert.equal(employee.leaveEncashment, false);
  assert.equal(employee.abry, true);
  assert.equal(employee.code, "E001");
});

test("a blank join date keeps the saved one", () => {
  const store = seedStore();
  const before = store.employees.find((item) => item.id === "e1")?.joinDate;
  const input = profileOf(store);
  input.joinDate = "";
  updateProfile(store, "c1", "tester", "e1", input, newId);
  assert.equal(
    store.employees.find((item) => item.id === "e1")?.joinDate,
    before,
  );
});

test("a refused profile changes nothing at all", () => {
  const store = seedStore();
  const snapshot = JSON.stringify(store.employees);
  const audits = store.audit.length;
  const refused: Array<[Partial<ProfileInput>, RegExp]> = [
    [{ firstName: "", lastName: "" }, /name/],
    [{ gender: "x" }, /Gender/],
    [{ paymentBy: "gold" }, /Payment by/],
    [{ marital: "x" }, /Marital/],
    [{ epfMode: "x" }, /EPF/],
    [{ birthDate: "1990-13-01" }, /Birth date/],
    [{ leftDate: "2000-01-01" }, /Left date cannot be before/],
    [{ pfJoinDate: "2024-05-01", pfLeaveDate: "2024-04-01" }, /PF leave/],
    [{ esiJoinDate: "2024-05-01", esiLeaveDate: "2024-04-01" }, /ESI leave/],
    [{ localAddress: "x".repeat(301) }, /Local address/],
    [{ uan: "x".repeat(101) }, /UAN/],
  ];
  for (const [patch, message] of refused) {
    const input = { ...profileOf(store), mobile: "9222222222", ...patch };
    assert.throws(
      () => updateProfile(store, "c1", "tester", "e1", input, newId),
      (error) => error instanceof EmployeeError && message.test(error.message),
      JSON.stringify(patch),
    );
  }
  const unlisted = { ...profileOf(store), designation: "Wizard" };
  assert.throws(
    () => updateProfile(store, "c1", "tester", "e1", unlisted, newId),
    MiscError,
  );
  assert.equal(JSON.stringify(store.employees), snapshot);
  assert.equal(store.audit.length, audits);
});

test("a profile cannot be saved through another company", () => {
  const store = seedStore();
  const first = store.employees[0];
  assert.ok(first);
  const other = { ...first, id: "e-other", code: "E500", companyId: "c2" };
  store.employees.push(other);
  assert.throws(
    () =>
      updateProfile(store, "c1", "tester", other.id, profileOf(store), newId),
    /not found/,
  );
  assert.throws(
    () =>
      updateProfile(store, "c1", "tester", "missing", profileOf(store), newId),
    EmployeeError,
  );
});

test("a saved profile is audited without values", () => {
  const store = seedStore();
  const input = profileOf(store);
  input.pan = "ABCDE1234F";
  input.mobile = "9333333333";
  updateProfile(store, "c1", "tester", "e1", input, newId);
  const entry = store.audit[0];
  assert.equal(entry?.action, "Updated profile of employee E001");
  assert.equal(entry?.actor, "tester");
  const text = JSON.stringify(entry);
  assert.equal(text.includes("ABCDE1234F"), false);
  assert.equal(text.includes("9333333333"), false);
});
