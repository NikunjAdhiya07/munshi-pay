import assert from "node:assert/strict";
import test from "node:test";
import { calculatePayroll, type EngineInput } from "./engine.ts";

const base = (): EngineInput => ({
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
  esiEmployeePercent: null,
  esiExceptionLimitPaise: 2_100_000,
  ptPaise: 20_000,
  otherDeductionPaise: 0,
  loanPaise: 100_000,
  earningAdjustmentPaise: 0,
  deductionAdjustmentPaise: 0,
});

test("monthly gross splits by category percents and stays in balance", () => {
  const result = calculatePayroll(base());
  assert.equal(result.basicPaise, 2_000_000);
  assert.equal(result.daPaise, 800_000);
  assert.equal(result.otherEarningPaise, 1_200_000);
  assert.equal(
    result.basicPaise + result.daPaise + result.otherEarningPaise,
    result.grossPaise,
  );
  assert.equal(result.pfPaise, 180_000);
  assert.equal(result.esiPaise, 0);
  assert.equal(result.netPaise, 4_000_000 - 180_000 - 20_000 - 100_000);
  assert.equal(result.payable, true);
  assert.deepEqual(
    result.exceptions.map((item) => item.code),
    ["esi-above-limit"],
  );
});

test("limited PF uses the cap when one is configured", () => {
  const result = calculatePayroll({
    ...base(),
    epfMode: "limited-basic",
    pfLimitPaise: 1_500_000,
  });
  assert.equal(result.pfPaise, 180_000);
});

test("limited PF does not invent a cap", () => {
  const result = calculatePayroll({
    ...base(),
    epfMode: "limited-basic",
    pfLimitPaise: null,
    esiDeduct: false,
  });
  assert.equal(result.pfPaise, 240_000);
  assert.equal(result.exceptions.length, 0);
});

test("per-day gross is the stored rate times paid days", () => {
  const result = calculatePayroll({
    ...base(),
    salaryBase: "per-day",
    ratePaise: 80_000,
    paidDays: 20,
    basicPercent: 100,
    daPercent: 0,
    pfDeduct: false,
    esiDeduct: false,
    ptPaise: 0,
    loanPaise: 0,
  });
  assert.equal(result.grossPaise, 1_600_000);
  assert.equal(result.netPaise, 1_600_000);
});

test("missing rate and missing category block pay", () => {
  const result = calculatePayroll({
    ...base(),
    categoryPresent: false,
    ratePaise: null,
  });
  assert.equal(result.payable, false);
  assert.equal(result.netPaise, 0);
  assert.ok(result.exceptions.some((item) => item.code === "empty-category"));
  assert.ok(result.exceptions.some((item) => item.code === "empty-rate"));
});

test("a left employee is excluded from payable lines", () => {
  const result = calculatePayroll({ ...base(), leftDuringPeriod: true });
  assert.equal(result.payable, false);
  assert.equal(result.exceptions[0]?.code, "left-employee");
});

test("an earning adjustment changes net by the same amount", () => {
  const original = calculatePayroll({ ...base(), esiDeduct: false });
  const adjusted = calculatePayroll({
    ...base(),
    esiDeduct: false,
    earningAdjustmentPaise: 50_000,
  });
  assert.equal(adjusted.netPaise - original.netPaise, 50_000);
});
