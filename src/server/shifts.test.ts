import assert from "node:assert/strict";
import test from "node:test";
import {
  addShift,
  assertShiftListed,
  deleteShift,
  employeesOnShift,
  ShiftError,
  type ShiftInput,
  updateShift,
} from "./shifts.ts";
import { seedStore } from "./store.ts";

let counter = 0;
const newId = () => `id-${++counter}`;

const input = (overrides: Partial<ShiftInput> = {}): ShiftInput => ({
  name: "Night",
  inTime: "21:00",
  outTime: "05:00",
  inTime2: "",
  outTime2: "",
  hours: "8",
  presentHours: "7.5",
  halfDayHours: "4",
  nightOffShift: "",
  nightDutyPunch: "",
  ...overrides,
});

function refused(run: () => void, pattern: RegExp) {
  assert.throws(run, (error) => {
    assert.ok(error instanceof ShiftError);
    assert.match(error.message, pattern);
    return true;
  });
}

test("a shift is added with times, hours, and an audit entry", () => {
  const store = seedStore();
  const shift = addShift(store, "c1", "tester", input(), newId);
  assert.equal(shift.companyId, "c1");
  assert.equal(shift.inTime, "21:00");
  // A shift may end after midnight.
  assert.equal(shift.outTime, "05:00");
  assert.equal(shift.presentHours, "7.5");
  assert.equal(store.audit[0]?.action, "Added shift Night");
});

test("hours are normalized and bounded", () => {
  const store = seedStore();
  const hours = (value: string) =>
    addShift(
      store,
      "c1",
      "t",
      input({ name: `H${counter + 1}`, hours: value }),
      newId,
    ).hours;
  assert.equal(hours("8.50"), "8.5");
  assert.equal(hours("24"), "24");
  assert.equal(hours(""), "");
  const bad: [string, RegExp][] = [
    ["24.01", /above 24/],
    ["25", /above 24/],
    ["-1", /number of hours/],
    ["8.555", /two decimals/],
    ["abc", /number of hours/],
    ["1e1", /number of hours/],
  ];
  for (const [value, pattern] of bad) {
    refused(
      () =>
        addShift(store, "c1", "t", input({ name: "Bad", hours: value }), newId),
      pattern,
    );
  }
});

test("clock times must be HH:MM and come in pairs", () => {
  const store = seedStore();
  const add = (overrides: Partial<ShiftInput>) => () =>
    addShift(store, "c1", "t", input({ name: "T", ...overrides }), newId);
  refused(add({ inTime: "9:30" }), /In time must be a time/);
  refused(add({ inTime: "24:00" }), /In time must be a time/);
  refused(add({ outTime: "10:60" }), /Out time must be a time/);
  refused(add({ outTime: "" }), /both the in time and the out time/);
  refused(
    add({ inTime: "", outTime: "17:00" }),
    /both the in time and the out time/,
  );
  refused(add({ inTime2: "13:00" }), /second in time and out time/);
  refused(
    add({ inTime: "", outTime: "", inTime2: "13:00", outTime2: "14:00" }),
    /first in and out times before the second/,
  );
  // A shift with no times at all is allowed, and so is a full second pair.
  addShift(
    store,
    "c1",
    "t",
    input({ name: "Open", inTime: "", outTime: "" }),
    newId,
  );
  addShift(
    store,
    "c1",
    "t",
    input({ name: "Split", inTime2: "14:00", outTime2: "18:00" }),
    newId,
  );
});

test("a blank, long, or repeated name is refused and a refusal changes nothing", () => {
  const store = seedStore();
  const before = JSON.stringify([store.shifts, store.audit]);
  refused(
    () => addShift(store, "c1", "t", input({ name: " " }), newId),
    /shift name/,
  );
  refused(
    () => addShift(store, "c1", "t", input({ name: "x".repeat(41) }), newId),
    /40 characters/,
  );
  refused(
    () => addShift(store, "c1", "t", input({ name: "general" }), newId),
    /already exists/,
  );
  refused(
    () =>
      addShift(
        store,
        "c1",
        "t",
        input({ nightOffShift: "y".repeat(31) }),
        newId,
      ),
    /30 characters/,
  );
  assert.equal(JSON.stringify([store.shifts, store.audit]), before);
});

test("the same name is allowed in another company", () => {
  const store = seedStore();
  addShift(store, "c2", "t", input({ name: "General" }), newId);
  assert.equal(
    store.shifts.filter((item) => item.name === "General").length,
    2,
  );
});

test("employees on a shift are counted per company", () => {
  const store = seedStore();
  assert.equal(employeesOnShift(store, "c1", "General"), 6);
  assert.equal(employeesOnShift(store, "c1", "general"), 6);
  assert.equal(employeesOnShift(store, "c2", "General"), 0);
});

test("renaming a shift moves the employees on it, and an edit keeps the name", () => {
  const store = seedStore();
  const general = store.shifts.find((item) => item.name === "General");
  assert.ok(general);
  updateShift(
    store,
    "c1",
    "tester",
    general.id,
    input({ name: "Day", inTime: "09:00", outTime: "18:00" }),
    newId,
  );
  assert.equal(general.name, "Day");
  assert.equal(general.inTime, "09:00");
  assert.ok(store.employees.every((item) => item.shift === "Day"));
  assert.match(
    store.audit[0]?.action ?? "",
    /Renamed shift General to Day \(6 employees\)/,
  );

  updateShift(
    store,
    "c1",
    "tester",
    general.id,
    input({ name: "Day", hours: "9" }),
    newId,
  );
  assert.equal(general.hours, "9");
  assert.equal(store.audit[0]?.action, "Edited shift Day");
});

test("a refused edit leaves the shift and its employees alone", () => {
  const store = seedStore();
  const general = store.shifts.find((item) => item.name === "General");
  assert.ok(general);
  const night = addShift(store, "c1", "t", input(), newId);
  refused(
    () =>
      updateShift(
        store,
        "c1",
        "t",
        night.id,
        input({ name: "General" }),
        newId,
      ),
    /already exists/,
  );
  refused(
    () =>
      updateShift(
        store,
        "c1",
        "t",
        general.id,
        input({ name: "Late", inTime: "99:00" }),
        newId,
      ),
    /In time/,
  );
  assert.equal(general.name, "General");
  assert.ok(store.employees.every((item) => item.shift === "General"));
});

test("a shift on employees cannot be deleted, an unused one can", () => {
  const store = seedStore();
  const general = store.shifts.find((item) => item.name === "General");
  assert.ok(general);
  refused(
    () => deleteShift(store, "c1", "t", general.id, newId),
    /used by 6 employees\. Change those employees first/,
  );
  assert.ok(store.shifts.some((item) => item.id === general.id));

  const night = addShift(store, "c1", "t", input(), newId);
  deleteShift(store, "c1", "tester", night.id, newId);
  assert.ok(!store.shifts.some((item) => item.id === night.id));
  assert.equal(store.audit[0]?.action, "Deleted shift Night");
});

test("another company's shift cannot be edited or deleted", () => {
  const store = seedStore();
  const other = addShift(store, "c2", "t", input({ name: "Dock" }), newId);
  refused(
    () => updateShift(store, "c1", "t", other.id, input(), newId),
    /not found/,
  );
  refused(() => deleteShift(store, "c1", "t", other.id, newId), /not found/);
  assert.equal(store.shifts.find((item) => item.id === other.id)?.name, "Dock");
});

test("a shift saved before the new fields existed can be shown and edited", () => {
  const store = seedStore();
  const general = store.shifts.find((item) => item.name === "General");
  assert.ok(general);
  assert.equal(general.inTime2, undefined);
  updateShift(
    store,
    "c1",
    "t",
    general.id,
    input({ name: "General", inTime: "09:30", outTime: "18:30" }),
    newId,
  );
  assert.equal(general.inTime2, "");
});

test("the employee form takes a listed shift, blank, or an unchanged older one", () => {
  const store = seedStore();
  assertShiftListed(store, "c1", "General", "");
  assertShiftListed(store, "c1", "general", "");
  assertShiftListed(store, "c1", "", "Anything");
  assertShiftListed(store, "c1", "Old text", "Old text");
  refused(
    () => assertShiftListed(store, "c1", "Old text", "General"),
    /not in the list/,
  );
  addShift(store, "c2", "t", input({ name: "Dock" }), newId);
  refused(() => assertShiftListed(store, "c1", "Dock", ""), /not in the list/);
});
