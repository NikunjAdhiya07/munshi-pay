import assert from "node:assert/strict";
import test from "node:test";
import {
  formatInr,
  parsePercentText,
  parseRupeeText,
  percentOf,
  plainRupees,
} from "./money.ts";

test("percent of paise rounds half a paisa away from zero", () => {
  const cases: [number, number, number][] = [
    [0, 50, 0],
    [100, 0, 0],
    [100, 100, 100],
    [1, 50, 1],
    [3, 50, 2],
    [1, 49, 0],
    [100, 12.5, 13],
    [100, 12.4, 12],
    [10_000, 12.1, 1_210],
    // Float Math.round(3000 * 1.15 / 100) is 34. Integer hundredths give 35.
    [3_000, 1.15, 35],
    [-1, 50, -1],
    [-3, 50, -2],
    [-3_000, 1.15, -35],
  ];
  for (const [amount, percent, expected] of cases) {
    assert.equal(
      percentOf(amount, percent),
      expected,
      `${percent}% of ${amount}`,
    );
  }
  assert.equal(Math.round((3_000 * 1.15) / 100), 34);
  // A negative amount that rounds to nothing stays 0, not -0.
  assert.equal(Object.is(percentOf(-1, 49), 0), true);
});

test("percentOf refuses a percent or amount outside the rounding rule", () => {
  const refused = [
    -1,
    100.01,
    101,
    12.345,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ];
  for (const percent of refused) {
    assert.throws(() => percentOf(1_000, percent), RangeError, String(percent));
  }
  assert.throws(() => percentOf(1.5, 50), RangeError);
  assert.throws(() => percentOf(Number.MAX_SAFE_INTEGER, 100), RangeError);
});

test("typed percents stay between 0 and 100 with at most two decimals", () => {
  const accepted: [string, number][] = [
    ["0", 0],
    ["100", 100],
    ["100.00", 100],
    ["0.75", 0.75],
    ["12.5", 12.5],
    ["12.10", 12.1],
    [" 33.33 ", 33.33],
  ];
  for (const [raw, expected] of accepted) {
    assert.equal(parsePercentText(raw), expected, raw);
  }
  for (const raw of [
    "",
    "-1",
    "abc",
    "1e2",
    "12.345",
    "101",
    "100.01",
    ".5",
    "12.",
  ]) {
    assert.equal(parsePercentText(raw), null, raw);
  }
});

test("typed rupees become paise without a floating-point multiply", () => {
  const accepted: [string, number][] = [
    ["0", 0],
    ["1", 100],
    ["1.5", 150],
    ["1.50", 150],
    ["1,250.05", 125_005],
    ["  19.99 ", 1_999],
  ];
  for (const [raw, expected] of accepted) {
    assert.equal(parseRupeeText(raw), expected, raw);
  }
  for (const raw of [
    "",
    "-1",
    "abc",
    "1e2",
    "1.005",
    "12.",
    "900719925474099",
  ]) {
    assert.equal(parseRupeeText(raw), null, raw);
  }
  // 1.005 * 100 is 100.49999999999999, so a float round would store 100 paise.
  assert.equal(Math.round(1.005 * 100), 100);
});

test("plain rupees and display text are built from integer paise", () => {
  assert.equal(plainRupees(0), "0.00");
  assert.equal(plainRupees(125_005), "1250.05");
  assert.equal(plainRupees(50), "0.50");
  assert.equal(plainRupees(-50), "-0.50");
  assert.equal(plainRupees(-1), "-0.01");
  assert.equal(parseRupeeText(plainRupees(125_005)), 125_005);
  assert.equal(parseRupeeText(plainRupees(1)), 1);
  assert.match(formatInr(125_005), /₹1,250\.05/);
});
