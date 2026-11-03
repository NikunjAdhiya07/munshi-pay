import assert from "node:assert/strict";
import test from "node:test";
import {
  acceptedRows,
  canCommit,
  displayCell,
  FILE_LIMIT_BYTES,
  fileProblem,
  findImport,
  reviewSheet,
} from "./import.ts";

const employees = findImport("employees");

test("the catalog omits leave flow and rejects the wrong file", () => {
  assert.equal(findImport("leave-flow"), null);
  assert.equal(findImport("employees")?.title, "Employees");
  assert.equal(fileProblem("people.csv", 20), "Upload an .xlsx file.");
  assert.equal(fileProblem("people.xlsx", 0), "The file is empty.");
  assert.equal(
    fileProblem("people.xlsx", FILE_LIMIT_BYTES + 1),
    "The file is over the 1 MB limit.",
  );
  assert.equal(fileProblem("People.XLSX", 10), null);
  assert.equal(displayCell("secret", true), "Hidden");
  assert.equal(displayCell("Asha", false), "Asha");
});

test("a sheet is previewed without treating a rejected row as accepted", () => {
  assert.ok(employees);
  const review = reviewSheet(employees, [
    { number: 1, cells: ["Name", "Code", "Join date"] },
    { number: 2, cells: ["Asha", "E001", "2024-04-01"] },
    { number: 3, cells: ["", "E002", "2024-04-01"] },
    { number: 4, cells: ["Ravi", "E001", "2024-05-01"] },
  ]);
  assert.equal(review.state, "rows");
  if (review.state !== "rows") return;
  assert.equal(review.rows[0]?.status, "accepted");
  assert.equal(review.rows[1]?.reason, "Name is required.");
  assert.equal(
    review.rows[2]?.reason,
    "This row repeats one already in the file.",
  );
  assert.equal(canCommit(review), false);
  assert.equal(acceptedRows(review).length, 1);

  const clean = reviewSheet(employees, [
    { number: 1, cells: ["Code", "Name", "Join date"] },
    { number: 2, cells: ["E010", "Nila", "2024-04-01"] },
  ]);
  assert.equal(canCommit(clean), true);
  assert.equal(
    reviewSheet(employees, [{ number: 1, cells: ["Code", "Extra"] }]).state,
    "file",
  );
});
