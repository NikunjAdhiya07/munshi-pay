import assert from "node:assert/strict";
import test from "node:test";
import {
  employment,
  type ListedEmployee,
  matchesEmployment,
  pageOf,
  pageSize,
  sortEmployees,
} from "./employees.ts";

function row(
  code: string,
  patch: Partial<ListedEmployee> = {},
): ListedEmployee {
  return {
    id: code,
    companyId: "c1",
    code,
    name: code,
    department: "Accounts",
    designation: "Accountant",
    birthDate: "",
    joinDate: "2024-04-01",
    leftDate: "",
    mobile: "",
    pan: "",
    aadhaar: "",
    uan: "",
    pfNumber: "",
    esiNumber: "",
    bankName: "",
    ifsc: "",
    account: "",
    ...patch,
  };
}

test("page size, employment, and sort stay on the allowed values", () => {
  assert.equal(pageSize("25"), 25);
  assert.equal(pageSize("8"), 10);
  assert.equal(pageSize("999"), 10);
  assert.equal(employment("left"), "left");
  assert.equal(employment("site"), "all");

  const people = [
    row("E002", { name: "Ravi", leftDate: "2026-09-30" }),
    row("E001", { name: "Asha" }),
    row("E003", { name: "Meera", birthDate: "1990-01-02" }),
  ];
  const active = people.filter((item) =>
    matchesEmployment(item, "active", "2026-10-07"),
  );
  assert.deepEqual(
    active.map((item) => item.code),
    ["E001", "E003"],
  );
  assert.deepEqual(
    sortEmployees(people, "name", "asc").map((item) => item.code),
    ["E001", "E003", "E002"],
  );
  assert.deepEqual(
    pageOf(sortEmployees(people, "code", "desc"), 1, 10).map(
      (item) => item.code,
    ),
    ["E003", "E002", "E001"],
  );
  assert.equal(pageOf(people, 2, 10).length, 0);
});
