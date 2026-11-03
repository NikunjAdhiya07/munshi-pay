import assert from "node:assert/strict";
import test from "node:test";
import {
  buildExport,
  EMPLOYEE_COLUMNS,
  EXPORTS,
  ExportError,
  SALARY_COLUMNS,
} from "./exports.ts";
import { reviewUpload } from "./import.ts";
import type { PayrollLine, Store } from "./model.ts";
import { MENUS } from "./model.ts";
import { seedStore } from "./store.ts";
import { buildTableSheet, readSheet } from "./xlsx.ts";

function line(employeeId: string, payable = true): PayrollLine {
  return {
    employeeId,
    basicPaise: 2_000_000,
    daPaise: 800_000,
    otherEarningPaise: 1_200_005,
    grossPaise: 4_000_005,
    pfPaise: 240_000,
    esiPaise: 0,
    ptPaise: 20_000,
    otherDeductionPaise: 0,
    loanPaise: 0,
    deductionPaise: 260_000,
    netPaise: 3_740_005,
    payable,
    exceptions: [],
    earningAdjustmentPaise: 0,
    deductionAdjustmentPaise: 0,
  };
}

function withRun(): Store {
  const store = seedStore();
  const outsider = {
    ...store.employees[0],
    id: "x1",
    companyId: "c2",
    code: "X001",
  };
  store.employees.push(outsider);
  store.runs.push(
    {
      id: "r1",
      companyId: "c1",
      period: "2026-10",
      status: "calculated",
      processedAt: "2026-10-07T00:00:00.000Z",
      lines: [line("e2"), line("e1"), line("e3", false), line("x1")],
    },
    {
      id: "r2",
      companyId: "c2",
      period: "2026-10",
      status: "calculated",
      processedAt: "2026-10-07T00:00:00.000Z",
      lines: [line("x1")],
    },
  );
  return store;
}

test("every export names a real menu and has a unique slug", () => {
  assert.equal(new Set(EXPORTS.map((item) => item.slug)).size, EXPORTS.length);
  for (const item of EXPORTS) assert.ok(MENUS.includes(item.menu), item.slug);
});

test("no export offers bank account, PAN, or Aadhaar", () => {
  const keys = [...EMPLOYEE_COLUMNS, ...SALARY_COLUMNS].map((item) => item.key);
  for (const key of ["account", "pan", "aadhaar", "pfAccount"]) {
    assert.ok(!keys.includes(key), key);
  }
  const store = seedStore();
  const first = store.employees[0];
  if (first) {
    first.account = "123456789012";
    first.pan = "ABCDE1234F";
    first.aadhaar = "999988887777";
  }
  const all = buildExport(store, "c1", "custom-employees", {
    columns: EMPLOYEE_COLUMNS.map((item) => item.key),
  });
  const cells = all.rows.flat().map(String);
  for (const secret of ["123456789012", "ABCDE1234F", "999988887777"]) {
    assert.ok(!cells.includes(secret), secret);
  }
});

test("employee export lists only this company, sorted by code", () => {
  const store = withRun();
  const table = buildExport(store, "c1", "employees");
  assert.deepEqual(
    table.rows.map((row) => row[0]),
    ["E001", "E002", "E003", "E004", "E005", "E006"],
  );
  assert.equal(table.columns[0]?.label, "Code");
  assert.equal(buildExport(store, "c2", "employees").rows.length, 1);
});

test("month-wise salary has payable lines of this company's run, in paise", () => {
  const store = withRun();
  const table = buildExport(store, "c1", "monthly-salary", {
    month: "2026-10",
  });
  assert.deepEqual(
    table.rows.map((row) => row[0]),
    ["E001", "E002"],
    "unpayable line and other company's employee left out",
  );
  const net = table.columns.findIndex((column) => column.key === "net");
  assert.equal(table.columns[net]?.money, true);
  assert.equal(table.rows[0]?.[net], 3_740_005);
  assert.equal(table.title, "Month-wise salary 2026-10");
});

test("a salary export without a run or with a bad month is refused", () => {
  const store = withRun();
  assert.throws(
    () => buildExport(store, "c1", "monthly-salary", { month: "2026-09" }),
    (error: unknown) =>
      error instanceof ExportError &&
      /not processed for 2026-09/.test(error.message),
  );
  for (const month of ["", "2026-13", "2026-1", "x"]) {
    assert.throws(
      () => buildExport(store, "c1", "monthly-salary", { month }),
      ExportError,
      month,
    );
  }
  assert.throws(() => buildExport(store, "c1", "nope"), ExportError);
});

test("custom exports keep catalog order and refuse unknown or empty choices", () => {
  const store = withRun();
  const table = buildExport(store, "c1", "custom-salary", {
    month: "2026-10",
    columns: ["net", "code", "net"],
  });
  assert.deepEqual(
    table.columns.map((column) => column.key),
    ["code", "net"],
  );
  assert.throws(
    () => buildExport(store, "c1", "custom-employees", { columns: [] }),
    /at least one column/,
  );
  assert.throws(
    () =>
      buildExport(store, "c1", "custom-employees", {
        columns: ["code", "aadhaar"],
      }),
    /from the list/,
  );
});

test("deduction export uses the import columns and this company's month", () => {
  const store = withRun();
  store.deductions.push(
    {
      id: "d2",
      companyId: "c1",
      employeeId: "e2",
      period: "2026-10",
      type: "Food",
      amountPaise: 125_050,
    },
    {
      id: "d3",
      companyId: "c1",
      employeeId: "e1",
      period: "2026-09",
      type: "Food",
      amountPaise: 100,
    },
    {
      id: "d4",
      companyId: "c2",
      employeeId: "x1",
      period: "2026-10",
      type: "Food",
      amountPaise: 100,
    },
  );
  const table = buildExport(store, "c1", "monthly-deductions", {
    month: "2026-10",
  });
  assert.deepEqual(
    table.columns.map((column) => column.label),
    ["Code", "Period", "Type", "Amount"],
  );
  assert.ok(table.rows.every((row) => row[1] === "2026-10"));
  assert.ok(table.rows.some((row) => row[0] === "E002" && row[3] === 125_050));
  assert.ok(!table.rows.some((row) => row[0] === "X001"));
});

test("a salary rate export opens in Excel and passes the salary rate import", async () => {
  const store = seedStore();
  const first = store.employees.find((item) => item.code === "E001");
  first?.salaryRows.push({
    id: "s-extra",
    asOn: "2026-11-01",
    categoryId: null,
    grossPaise: 4_250_005,
    ctcPaise: null,
  });
  const table = buildExport(store, "c1", "salary-rates");
  const bytes = await buildTableSheet(table);
  const rows = await readSheet(bytes);
  assert.deepEqual(rows[0]?.cells, ["Code", "As on", "Gross"]);
  const extra = rows.find((row) => row.cells[1] === "2026-11-01");
  assert.deepEqual(extra?.cells, ["E001", "2026-11-01", "42500.05"]);
  const review = await reviewUpload("salary-rates", bytes);
  assert.equal(review.state, "rows");
  if (review.state === "rows") {
    assert.ok(review.rows.every((row) => row.status === "accepted"));
  }
});

test("text that looks like a formula is written as text", async () => {
  const store = seedStore();
  const first = store.employees[0];
  if (first) first.name = '=HYPERLINK("http://x")';
  const bytes = await buildTableSheet(
    buildExport(store, "c1", "custom-employees", { columns: ["code", "name"] }),
  );
  const ExcelJS = (await import("exceljs")).default;
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes as never);
  const cell = book.worksheets[0]?.getRow(2).getCell(2);
  assert.equal(cell?.type, ExcelJS.ValueType.String);
  assert.equal(cell?.value, '=HYPERLINK("http://x")');
});
