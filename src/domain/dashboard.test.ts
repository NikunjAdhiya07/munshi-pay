import assert from "node:assert/strict";
import test from "node:test";
import {
  type DashboardPerson,
  eventCounts,
  eventKind,
  filterDashboardPeople,
  isMissing,
  pendingCounts,
  pendingField,
} from "./dashboard.ts";

const today = "2026-10-07";

function person(
  id: string,
  patch: Partial<DashboardPerson> = {},
): DashboardPerson {
  return {
    id,
    companyId: "c1",
    birthDate: "",
    joinDate: "2024-04-01",
    leftDate: "",
    mobile: "",
    pan: "",
    aadhaar: "",
    uan: "",
    bankName: "",
    ifsc: "",
    account: "",
    pfBankName: "",
    pfIfsc: "",
    pfAccount: "",
    ...patch,
  };
}

const complete = person("complete", {
  birthDate: "1990-10-07",
  mobile: "9000000001",
  pan: "DEMO-PAN",
  aadhaar: "DEMO-AADHAAR",
  uan: "DEMO-UAN",
  bankName: "Demo Bank",
  ifsc: "DEMO0000001",
  account: "DEMO-ACCOUNT",
  pfBankName: "Demo PF Bank",
  pfIfsc: "DEMO0000002",
  pfAccount: "DEMO-PF",
});

test("pending counts ignore other companies, leavers, and filled fields", () => {
  const people = [
    complete,
    person("blank"),
    person("spaces", { aadhaar: "   ", pan: " DEMO " }),
    person("partial-bank", {
      bankName: "Demo Bank",
      ifsc: "DEMO0000001",
      account: "",
    }),
    person("left", { leftDate: "2026-10-01", aadhaar: "" }),
    person("other-company", { companyId: "c2" }),
  ];
  const counts = Object.fromEntries(
    pendingCounts(people, "c1", today).map((row) => [row.id, row.count]),
  );
  assert.equal(counts.aadhaar, 3);
  assert.equal(counts.pan, 2);
  assert.equal(counts["salary-bank"], 3);
  assert.equal(counts["pf-bank"], 3);
  assert.equal(counts["join-date"], 0);
  assert.equal(
    counts.aadhaar,
    filterDashboardPeople(people, "c1", today, { missing: "aadhaar" }).length,
  );
  assert.equal(isMissing(person("old"), "pf-bank"), true);
});

test("events use a 30-day window and stay inside the company", () => {
  const people = [
    complete,
    person("upcoming", { birthDate: "1992-10-20" }),
    person("year-end", { birthDate: "1988-01-05" }),
    person("leap", { birthDate: "1992-02-29" }),
    person("joined", { joinDate: "2026-09-20" }),
    person("joined-old", { joinDate: "2026-09-06" }),
    person("left-recent", { leftDate: "2026-09-30", birthDate: "1990-10-07" }),
    person("left-today", { leftDate: today, birthDate: "1991-10-07" }),
    person("other", { companyId: "c2", birthDate: "1990-10-07" }),
  ];
  const counts = Object.fromEntries(
    eventCounts(people, "c1", today).map((row) => [row.id, row.count]),
  );
  assert.equal(counts["birthday-today"], 1);
  assert.equal(counts["birthday-upcoming"], 1);
  assert.equal(counts.joining, 1);
  assert.equal(counts.left, 2);

  const yearEnd = eventCounts(people, "c1", "2026-12-20").find(
    (row) => row.id === "birthday-upcoming",
  );
  assert.equal(yearEnd?.count, 1);

  const leapDay = filterDashboardPeople(people, "c1", "2027-02-28", {
    event: "birthday-today",
  }).map((item) => item.id);
  assert.deepEqual(leapDay, ["leap"]);

  assert.equal(pendingField("aadhaar"), "aadhaar");
  assert.equal(pendingField("news"), null);
  assert.equal(eventKind("left"), "left");
  assert.equal(eventKind("holiday"), null);
});
