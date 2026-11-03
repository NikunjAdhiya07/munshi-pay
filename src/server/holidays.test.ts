import assert from "node:assert/strict";
import test from "node:test";
import {
  addHoliday,
  deleteHoliday,
  HolidayError,
  holidaysInPeriod,
  holidayYears,
  searchHolidays,
} from "./holidays.ts";
import { seedStore } from "./store.ts";

let counter = 0;
const newId = () => `id-${++counter}`;

const input = (overrides: Partial<Parameters<typeof addHoliday>[3]> = {}) => ({
  date: "2026-11-08",
  year: "2026",
  description: "Diwali",
  ...overrides,
});

function refused(run: () => void, pattern: RegExp) {
  assert.throws(run, (error) => {
    assert.ok(error instanceof HolidayError);
    assert.match(error.message, pattern);
    return true;
  });
}

test("a holiday is added with a year and an audit entry", () => {
  const store = seedStore();
  const holiday = addHoliday(store, "c1", "tester", input(), newId);
  assert.equal(holiday.year, "2026");
  assert.equal(holiday.description, "Diwali");
  assert.equal(store.audit[0]?.action, "Added holiday 2026-11-08");
  assert.equal(store.audit[0]?.companyId, "c1");
});

test("invalid or duplicate holidays are refused and nothing is saved", () => {
  const store = seedStore();
  const before = store.holidays.length;
  refused(
    () => addHoliday(store, "c1", "t", input({ date: "" }), newId),
    /date/,
  );
  refused(
    () => addHoliday(store, "c1", "t", input({ date: "2026-02-30" }), newId),
    /date/,
  );
  refused(
    () => addHoliday(store, "c1", "t", input({ year: "26" }), newId),
    /four digits/,
  );
  refused(
    () =>
      addHoliday(
        store,
        "c1",
        "t",
        input({ description: "x".repeat(61) }),
        newId,
      ),
    /60 characters/,
  );
  refused(
    () => addHoliday(store, "c1", "t", input({ date: "2026-10-02" }), newId),
    /already a holiday/,
  );
  assert.equal(store.holidays.length, before);
});

test("the same date can be a holiday in two companies", () => {
  const store = seedStore();
  addHoliday(store, "c2", "t", input({ date: "2026-10-02" }), newId);
  assert.equal(
    store.holidays.filter((item) => item.date === "2026-10-02").length,
    2,
  );
});

test("a holiday is deleted with an audit entry, only inside its company", () => {
  const store = seedStore();
  refused(() => deleteHoliday(store, "c2", "t", "h1", newId), /not found/);
  assert.ok(store.holidays.some((item) => item.id === "h1"));
  deleteHoliday(store, "c1", "tester", "h1", newId);
  assert.ok(!store.holidays.some((item) => item.id === "h1"));
  assert.equal(store.audit[0]?.action, "Deleted holiday 2026-10-02");
});

test("search filters by year and by text in the date or description", () => {
  const store = seedStore();
  addHoliday(store, "c1", "t", input(), newId);
  addHoliday(
    store,
    "c1",
    "t",
    input({ date: "2027-01-26", year: "2027", description: "Republic Day" }),
    newId,
  );
  addHoliday(store, "c2", "t", input({ date: "2026-12-25" }), newId);
  const dates = (filter: Parameters<typeof searchHolidays>[2]) =>
    searchHolidays(store, "c1", filter).map((item) => item.date);
  assert.deepEqual(dates({}), ["2026-10-02", "2026-11-08", "2027-01-26"]);
  assert.deepEqual(dates({ year: "2027" }), ["2027-01-26"]);
  assert.deepEqual(dates({ text: "diwali" }), ["2026-11-08"]);
  assert.deepEqual(dates({ text: "2026-10" }), ["2026-10-02"]);
  assert.deepEqual(dates({ year: "2027", text: "diwali" }), []);
  assert.deepEqual(holidayYears(store, "c1"), ["2027", "2026"]);
});

test("the muster count is the listed dates inside the month for the company", () => {
  const store = seedStore();
  addHoliday(store, "c1", "t", input({ date: "2026-10-20" }), newId);
  addHoliday(store, "c1", "t", input({ date: "2026-11-01" }), newId);
  addHoliday(store, "c2", "t", input({ date: "2026-10-21" }), newId);
  assert.equal(holidaysInPeriod(store, "c1", "2026-10"), 2);
  assert.equal(holidaysInPeriod(store, "c1", "2026-11"), 1);
  assert.equal(holidaysInPeriod(store, "c1", "2026-09"), 0);
  assert.equal(holidaysInPeriod(store, "c2", "2026-10"), 1);
});

test("a stored holiday without a year takes the year of its date on load", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const { readStore, resetStoreCache } = await import("./store.ts");
  const file = path.join(os.tmpdir(), `munshi-holiday-${Date.now()}.json`);
  const legacy = seedStore();
  legacy.holidays = [
    { id: "old", companyId: "c1", date: "2025-08-15", description: "" },
  ] as unknown as typeof legacy.holidays;
  fs.writeFileSync(file, JSON.stringify(legacy));
  process.env.STORE_PATH = file;
  resetStoreCache();
  try {
    assert.equal(readStore().holidays[0]?.year, "2025");
  } finally {
    fs.rmSync(file, { force: true });
    delete process.env.STORE_PATH;
    resetStoreCache();
  }
});
