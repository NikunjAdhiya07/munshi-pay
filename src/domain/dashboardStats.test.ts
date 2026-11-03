import assert from "node:assert/strict";
import test from "node:test";
import {
  deductionBreakdown,
  departmentRollup,
  payBands,
  payrollInsights,
  reconcile,
  type SourceLine,
  type StatLine,
  toStatLine,
  totalsOf,
  waterfall,
} from "./dashboardStats.ts";
import { calculatePayroll, type EngineInput } from "./engine.ts";

const base: EngineInput = {
  salaryBase: "salary",
  categoryPresent: true,
  ratePaise: 4_000_000,
  paidDays: 26,
  basicPercent: 50,
  daPercent: 20,
  leftDuringPeriod: false,
  pfDeduct: true,
  epfMode: "limited-basic",
  pfLimitPaise: 1_500_000,
  pfEmployeePercent: 12,
  esiDeduct: true,
  esiEmployeePercent: 0.75,
  esiExceptionLimitPaise: 2_100_000,
  ptPaise: 20_000,
  otherDeductionPaise: 25_000,
  loanPaise: 100_000,
  earningAdjustmentPaise: 0,
  deductionAdjustmentPaise: 0,
};

/** A saved line, built the way processing builds it, from the real engine. */
function saved(
  employeeId: string,
  patch: Partial<EngineInput> = {},
): SourceLine {
  const input = { ...base, ...patch };
  const result = calculatePayroll(input);
  return {
    employeeId,
    grossPaise: result.grossPaise,
    basicPaise: result.basicPaise,
    daPaise: result.daPaise,
    otherEarningPaise: result.otherEarningPaise,
    pfPaise: result.pfPaise,
    esiPaise: result.esiPaise,
    ptPaise: result.ptPaise,
    loanPaise: result.loanPaise,
    otherDeductionPaise: result.otherDeductionPaise,
    deductionAdjustmentPaise: input.deductionAdjustmentPaise,
    deductionPaise: result.deductionPaise,
    netPaise: result.netPaise,
  };
}

const person = (name: string, department: string) => ({
  name,
  code: name.slice(0, 3).toUpperCase(),
  department,
});

function lines(): StatLine[] {
  return [
    toStatLine(saved("a"), person("Asha", "Accounts")),
    toStatLine(
      saved("b", { ratePaise: 8_000_000, deductionAdjustmentPaise: 50_000 }),
      person("Nikhil", "Accounts"),
    ),
    toStatLine(
      saved("c", { ratePaise: 1_600_000, pfEmployeePercent: null }),
      person("Ravi", "Plant"),
    ),
    toStatLine(
      saved("d", { ratePaise: 2_800_000, earningAdjustmentPaise: 30_000 }),
      person("Leela", ""),
    ),
    toStatLine(saved("e", { ratePaise: 5_500_000 }), person("Imran", "Plant")),
  ];
}

test("processed lines balance and every total is the sum of its parts", () => {
  const all = lines();
  assert.deepEqual(reconcile(all), []);
  const totals = totalsOf(all);
  const parts = deductionBreakdown(all);
  assert.equal(
    parts.reduce((sum, part) => sum + part.paise, 0),
    totals.deductions,
  );
  assert.equal(totals.gross - totals.deductions, totals.net);
  assert.equal(totals.basic + totals.da + totals.otherEarning, totals.gross);
});

test("PF and ESI follow the engine: a percent makes them non-zero, none leaves zero", () => {
  const all = lines();
  const pf = (id: string) => all.find((line) => line.employeeId === id);
  assert.ok((pf("a")?.pfPaise ?? 0) > 0);
  assert.ok((pf("a")?.esiPaise ?? 0) > 0);
  assert.equal(pf("c")?.pfPaise, 0);
  // limited-basic: basic 20,000 is above the 15,000 cap, so PF is 12% of 15,000.
  assert.equal(pf("a")?.pfPaise, 180_000);
  // ESI is 0.75% of gross 40,000.
  assert.equal(pf("a")?.esiPaise, 30_000);
});

test("a manual adjustment is counted once, not under Other and Adjustments", () => {
  const all = lines();
  const adjusted = all.find((line) => line.employeeId === "b");
  assert.equal(adjusted?.adjustmentPaise, 50_000);
  assert.equal(adjusted?.otherDeductionPaise, 25_000);
  const parts = deductionBreakdown(all);
  const adjustment = parts.find((part) => part.key === "adjustment");
  assert.equal(adjustment?.paise, 50_000);
  assert.equal(adjustment?.people.length, 1);
  assert.deepEqual(reconcile(all), []);
});

test("the waterfall ends at net and skips deductions that are zero", () => {
  const all = lines();
  const steps = waterfall(all);
  const totals = totalsOf(all);
  assert.equal(steps[0].key, "gross");
  assert.equal(steps[0].paise, totals.gross);
  const last = steps[steps.length - 1];
  assert.equal(last.key, "net");
  assert.equal(last.paise, totals.net);
  assert.equal(steps[steps.length - 2].to, totals.net);

  const noPf = all.map((line) => ({ ...line, pfPaise: 0, esiPaise: 0 }));
  // Zeroing PF and ESI alone breaks the balance, which reconcile reports.
  assert.ok(reconcile(noPf).length > 0);
  const none = waterfall([
    toStatLine(
      saved("z", { pfEmployeePercent: null, esiEmployeePercent: null }),
      person("Z", "X"),
    ),
  ]);
  assert.equal(
    none.some((step) => step.key === "pf" || step.key === "esi"),
    false,
  );
});

test("departments add up to the totals and sort by net pay", () => {
  const all = lines();
  const rows = departmentRollup(all);
  assert.deepEqual(rows.map((row) => row.name).sort(), [
    "Accounts",
    "Plant",
    "Unassigned",
  ]);
  assert.equal(
    rows.reduce((sum, row) => sum + row.net, 0),
    totalsOf(all).net,
  );
  assert.equal(
    rows.reduce((sum, row) => sum + row.people, 0),
    all.length,
  );
  for (let index = 1; index < rows.length; index += 1) {
    assert.ok(rows[index - 1].net >= rows[index].net);
  }
  for (const row of rows) {
    assert.equal(row.averageNet, Math.round(row.net / row.people));
  }
});

test("pay bands cover every employee once, and small groups get no histogram", () => {
  const all = lines();
  const bands = payBands(all, (line) => line.netPaise);
  assert.ok(bands && bands.length >= 2);
  const placed = bands?.flatMap((band) => band.people) ?? [];
  assert.equal(placed.length, all.length);
  assert.equal(new Set(placed.map((item) => item.employeeId)).size, all.length);
  for (const band of bands ?? []) {
    for (const item of band.people) {
      assert.ok(item.paise >= band.fromPaise);
      assert.ok(item.paise < band.toPaise);
    }
  }
  assert.equal(
    payBands(all.slice(0, 3), (line) => line.netPaise),
    null,
  );
  const same = payBands(
    all.map((line) => ({ ...line, netPaise: 1_000_000 })),
    (line) => line.netPaise,
  );
  assert.equal(same?.length, 1);
  assert.equal(same?.[0].people.length, all.length);
});

test("insights state only what the figures show", () => {
  const all = lines();
  const totals = totalsOf(all);
  const insights = payrollInsights({
    lines: all,
    totals,
    parts: deductionBreakdown(all),
    departments: departmentRollup(all),
    previous: {
      period: "2026-09",
      status: "calculated",
      payable: 3,
      gross: totals.gross,
      deductions: totals.deductions,
      net: Math.round(totals.net / 2),
    },
    previousLabel: "September 2026",
    held: 2,
    activeCount: 6,
    musterCount: 5,
    monthLabel: "October 2026",
    pfConfigured: false,
    esiConfigured: true,
  });
  const text = insights.map((item) => item.text).join("\n");
  assert.match(text, /Take-home is \d+\.\d% of gross across 5 paid employees/);
  assert.match(text, /up 100% on September 2026/);
  assert.match(text, /2 employees are held/);
  assert.match(text, /PF is ₹0\.00 because no percent is set/);
  assert.match(text, /5 of 6 active employees have a muster/);

  const empty = payrollInsights({
    lines: [],
    totals: totalsOf([]),
    parts: deductionBreakdown([]),
    departments: [],
    held: 0,
    activeCount: 0,
    musterCount: null,
    monthLabel: "October 2026",
    pfConfigured: true,
    esiConfigured: true,
  });
  assert.deepEqual(empty, []);
});
