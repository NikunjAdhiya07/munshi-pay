import assert from "node:assert/strict";
import test from "node:test";
import {
  changeLabel,
  changePercent,
  compactInr,
  initials,
  shiftPeriod,
} from "./format.ts";

test("compactInr shortens integer paise into rupee, thousand, lakh and crore labels", () => {
  assert.equal(compactInr(0), "₹0");
  assert.equal(compactInr(45_000), "₹450");
  assert.equal(compactInr(190_000), "₹1.9K");
  assert.equal(compactInr(9_600_000), "₹96K");
  assert.equal(compactInr(13_600_000), "₹1.4L");
  assert.equal(compactInr(15_000_000), "₹1.5L");
  assert.equal(compactInr(25_000_000_00), "₹2.5Cr");
  assert.equal(compactInr(-15_000_000), "-₹1.5L");
});

test("changePercent gives no comparison when there is no earlier figure", () => {
  assert.equal(changePercent(120, null), null);
  assert.equal(changePercent(120, undefined), null);
  assert.equal(changePercent(120, 0), null);
  assert.equal(changePercent(104, 100), 4);
  assert.equal(changePercent(88, 100), -12);
  assert.equal(changePercent(100, 100), 0);
});

test("changeLabel states direction and says no change for zero", () => {
  assert.equal(changeLabel(4), "+4%");
  assert.equal(changeLabel(-12), "-12%");
  assert.equal(changeLabel(0), "No change");
});

test("initials use two letters from a name or a username", () => {
  assert.equal(initials("Asha Rao"), "AR");
  assert.equal(initials("asha.rao"), "AR");
  assert.equal(initials("owner"), "OW");
  assert.equal(initials("  "), "?");
});

test("shiftPeriod moves whole months across year ends and rejects bad input", () => {
  assert.equal(shiftPeriod("2026-10", 1), "2026-11");
  assert.equal(shiftPeriod("2026-12", 1), "2027-01");
  assert.equal(shiftPeriod("2026-01", -1), "2025-12");
  assert.equal(shiftPeriod("2026-10", -12), "2025-10");
  assert.equal(shiftPeriod("2026-1", 1), null);
  assert.equal(shiftPeriod("nonsense", 1), null);
});
