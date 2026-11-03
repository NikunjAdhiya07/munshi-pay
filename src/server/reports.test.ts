import assert from "node:assert/strict";
import test from "node:test";
import { plainRupees } from "../domain/money.ts";
import {
  isIsoDate,
  isPeriod,
  reportBySlug,
  reportGroups,
  reports,
} from "../domain/reports.ts";
import type { PayrollLine, Store } from "./model.ts";
import { buildReport, reportCsv, runStatusFor } from "./reports.ts";
import { seedStore } from "./store.ts";

const line = (
  employeeId: string,
  overrides: Partial<PayrollLine> = {},
): PayrollLine => ({
  employeeId,
  basicPaise: 1_000_000,
  daPaise: 200_000,
  otherEarningPaise: 0,
  grossPaise: 1_200_000,
  pfPaise: 120_000,
  esiPaise: 9_000,
  ptPaise: 20_000,
  otherDeductionPaise: 0,
  loanPaise: 0,
  deductionPaise: 149_000,
  netPaise: 1_051_000,
  payable: true,
  exceptions: [],
  earningAdjustmentPaise: 0,
  deductionAdjustmentPaise: 0,
  ...overrides,
});

/** The seed plus a processed October run, and a second company with its own data. */
function storeWithRun(): Store {
  const store = seedStore();
  store.runs.push(
    {
      id: "r1",
      companyId: "c1",
      period: "2026-10",
      status: "in-review",
      processedAt: "2026-10-07T00:00:00.000Z",
      lines: [
        line("e1"),
        line("e2", { netPaise: 900_000, grossPaise: 1_000_000 }),
        line("e3", { payable: false }),
      ],
    },
    {
      id: "r2",
      companyId: "c2",
      period: "2026-10",
      status: "locked",
      processedAt: "2026-10-07T00:00:00.000Z",
      lines: [line("x1")],
    },
  );
  const first = store.employees[0];
  store.employees.push({
    ...first,
    id: "x1",
    companyId: "c2",
    code: "H001",
    name: "Other company person",
  });
  store.muster.push({
    id: "mu-x",
    companyId: "c2",
    employeeId: "x1",
    period: "2026-10",
    paidDays: 30,
    weekOff: 0,
    publicHoliday: 0,
    compOff: 0,
    onDuty: 0,
  });
  store.leaveBalances.push({
    id: "lb-x",
    companyId: "c2",
    employeeId: "x1",
    year: "2026",
    leaveName: "Casual leave",
    broughtForward: 0,
    yearCount: 6,
    balance: 6,
  });
  return store;
}

test("the catalog has ten reports, each in a reference group", () => {
  assert.equal(reports.length, 10);
  for (const report of reports) {
    assert.ok(reportGroups.includes(report.group), report.slug);
  }
  assert.deepEqual(
    reportGroups.filter((group) =>
      reports.some((item) => item.group === group),
    ),
    [...reportGroups],
    "every group in the list has at least one report",
  );
  assert.equal(reportBySlug("salary-register")?.name, "Salary register");
  assert.equal(reportBySlug("missing"), undefined);
});

test("every report builds, and each row matches its columns", () => {
  const store = storeWithRun();
  for (const report of reports) {
    const table = buildReport(store, "c1", "2026-10", report.slug);
    for (const row of table.rows) {
      assert.equal(row.cells.length, table.columns.length, report.slug);
    }
  }
});

test("pay reports list only payable lines of the company's run", () => {
  const store = storeWithRun();
  const register = buildReport(store, "c1", "2026-10", "salary-register");
  assert.deepEqual(
    register.columns.map((column) => column.label),
    [
      "Code",
      "Name",
      "Basic",
      "DA",
      "Gross",
      "PF",
      "ESI",
      "PT",
      "Deductions",
      "Net",
    ],
  );
  assert.deepEqual(
    register.rows.map((row) => row.cells[0]),
    ["E001", "E002"],
    "a line that is not payable and another company's line are left out",
  );
  assert.deepEqual(register.rows[0].cells, [
    "E001",
    "Asha Rao",
    1_000_000,
    200_000,
    1_200_000,
    120_000,
    9_000,
    20_000,
    149_000,
    1_051_000,
  ]);
});

test("each pay report shows its own columns", () => {
  const store = storeWithRun();
  const labels = (slug: Parameters<typeof buildReport>[3]) =>
    buildReport(store, "c1", "2026-10", slug).columns.map((c) => c.label);
  assert.deepEqual(labels("pf-register"), ["Code", "Name", "Gross", "PF"]);
  assert.deepEqual(labels("esi-register"), ["Code", "Name", "Gross", "ESI"]);
  assert.deepEqual(labels("pt-summary"), ["Code", "Name", "Gross", "PT"]);
  assert.deepEqual(labels("payment"), ["Code", "Name", "Paid by", "Net pay"]);
  assert.deepEqual(labels("salary-slip"), [
    "Code",
    "Name",
    "Gross",
    "Deductions",
    "Net",
  ]);
  const pf = buildReport(store, "c1", "2026-10", "pf-register");
  assert.deepEqual(pf.rows[0].cells, ["E001", "Asha Rao", 1_200_000, 120_000]);
  const payment = buildReport(store, "c1", "2026-10", "payment");
  assert.deepEqual(payment.rows[1].cells, [
    "E002",
    "Ravi Menon",
    "bank",
    900_000,
  ]);
});

test("a month with no run has no pay rows and no status", () => {
  const store = storeWithRun();
  assert.equal(
    buildReport(store, "c1", "2026-09", "salary-register").rows.length,
    0,
  );
  assert.equal(runStatusFor(store, "c1", "2026-09"), null);
  assert.equal(runStatusFor(store, "c1", "2026-10"), "in-review");
  assert.equal(runStatusFor(store, "c2", "2026-10"), "locked");
  assert.equal(runStatusFor(store, "c3", "2026-10"), null);
});

test("pay rows follow the company asked for", () => {
  const store = storeWithRun();
  const other = buildReport(store, "c2", "2026-10", "salary-register");
  assert.deepEqual(
    other.rows.map((row) => row.cells[0]),
    ["H001"],
  );
});

test("attendance rows are the month's muster for the company", () => {
  const store = storeWithRun();
  const table = buildReport(store, "c1", "2026-10", "attendance");
  assert.equal(table.rows.length, 3);
  assert.deepEqual(table.rows[0].cells, ["E001", "Asha Rao", 26, 4, 1, 0, 0]);
  assert.equal(
    buildReport(store, "c1", "2026-09", "attendance").rows.length,
    0,
  );
  assert.deepEqual(
    buildReport(store, "c2", "2026-10", "attendance").rows.map(
      (row) => row.cells[0],
    ),
    ["H001"],
  );
});

test("leave rows are the company's balances", () => {
  const store = storeWithRun();
  const table = buildReport(store, "c1", "2026-10", "leave");
  assert.deepEqual(
    table.rows.map((row) => row.cells),
    [["E001", "Asha Rao", "2026", "Privilege leave", 2, 12, 10]],
  );
  assert.deepEqual(
    buildReport(store, "c2", "2026-10", "leave").rows.map(
      (row) => row.cells[3],
    ),
    ["Casual leave"],
  );
});

test("full and final lists only people who have left", () => {
  const store = storeWithRun();
  const table = buildReport(store, "c1", "2026-10", "full-final");
  assert.deepEqual(
    table.rows.map((row) => [row.cells[0], row.cells[2]]),
    [["E005", "2026-09-30"]],
  );
  assert.equal(
    buildReport(store, "c2", "2026-10", "full-final").rows.length,
    0,
  );
});

test("IT declaration has no rows or columns and says why", () => {
  const table = buildReport(storeWithRun(), "c1", "2026-10", "it-declaration");
  assert.equal(table.columns.length, 0);
  assert.equal(table.rows.length, 0);
  assert.match(table.note ?? "", /No declaration records are stored/);
});

test("the CSV holds the same rows as the report, in plain rupees", () => {
  const store = storeWithRun();
  const table = buildReport(store, "c1", "2026-10", "salary-register");
  const csv = reportCsv(table);
  const rows = csv.trimEnd().split("\r\n");
  assert.equal(rows.length, table.rows.length + 1);
  assert.equal(
    rows[0],
    '"Code","Name","Basic","DA","Gross","PF","ESI","PT","Deductions","Net"',
  );
  assert.equal(
    rows[1],
    '"E001","Asha Rao",10000.00,2000.00,12000.00,1200.00,90.00,200.00,1490.00,10510.00',
  );
  assert.ok(csv.endsWith("\r\n"));
  assert.ok(!csv.includes("₹"), "no currency symbol in a file");
});

test("a report's CSV differs from another report's CSV", () => {
  const store = storeWithRun();
  const csv = (slug: Parameters<typeof buildReport>[3]) =>
    reportCsv(buildReport(store, "c1", "2026-10", slug));
  assert.notEqual(csv("pf-register"), csv("esi-register"));
  assert.match(csv("pf-register").split("\r\n")[0], /"PF"/);
  assert.match(csv("attendance").split("\r\n")[0], /"Paid days"/);
  assert.match(csv("leave").split("\r\n")[0], /"Balance"/);
  assert.match(csv("full-final").split("\r\n")[0], /"Left date"/);
});

test("CSV quotes text, and does not let a name run as a formula", () => {
  const store = storeWithRun();
  store.employees[0].name = '=HYPERLINK("http://x")';
  store.employees[1].name = 'Ravi "R", Menon';
  const rows = reportCsv(
    buildReport(store, "c1", "2026-10", "pf-register"),
  ).split("\r\n");
  assert.equal(rows[1], `"E001","'=HYPERLINK(""http://x"")",12000.00,1200.00`);
  assert.equal(rows[2], '"E002","Ravi ""R"", Menon",10000.00,1200.00');
});

test("building a report does not change the store", () => {
  const store = storeWithRun();
  const before = JSON.stringify(store);
  for (const report of reports) {
    reportCsv(buildReport(store, "c1", "2026-10", report.slug));
  }
  assert.equal(JSON.stringify(store), before);
});

test("plain rupees is exact for integer paise", () => {
  assert.equal(plainRupees(0), "0.00");
  assert.equal(plainRupees(5), "0.05");
  assert.equal(plainRupees(100), "1.00");
  assert.equal(plainRupees(125_005), "1250.05");
  assert.equal(plainRupees(-50), "-0.50");
  assert.equal(plainRupees(Number.MAX_SAFE_INTEGER), "90071992547409.91");
});

test("month and date filters accept only real values", () => {
  assert.ok(isPeriod("2026-10"));
  assert.ok(isPeriod("2026-01"));
  assert.ok(!isPeriod("2026-13"));
  assert.ok(!isPeriod("2026-00"));
  assert.ok(!isPeriod("2026-1"));
  assert.ok(!isPeriod("2026-10\n"));
  assert.ok(!isPeriod("../x"));
  assert.ok(!isPeriod(undefined));
  assert.ok(isIsoDate("2026-10-31"));
  assert.ok(isIsoDate("2028-02-29"));
  assert.ok(!isIsoDate("2026-02-29"));
  assert.ok(!isIsoDate("2026-04-31"));
  assert.ok(!isIsoDate("2026-10-3"));
  assert.ok(!isIsoDate("31-10-2026"));
});
