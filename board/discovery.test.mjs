import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("MunshiPay analysis records observed modules and omits live secrets", () => {
  const doc = fs.readFileSync(
    new URL("../docs/munshipay-analysis.md", import.meta.url),
    "utf8",
  );

  for (const heading of [
    "## Authentication",
    "## Navigation",
    "## Dashboard",
    "## Masters",
    "## Time Management",
    "## Transaction",
    "## Leave",
    "## Reports",
    "## Screen inventory",
    "## Workflow inventory",
    "## Traceability",
    "REQUIRES VALIDATION",
  ]) {
    assert.ok(doc.includes(heading), `missing ${heading}`);
  }

  assert.match(doc, /Process Salary/);
  assert.match(doc, /Monthly Muster/);
  assert.match(doc, /Select Company/);
  assert.doesNotMatch(doc, /ADMIN/);
  assert.doesNotMatch(doc, /GJAHD1684981000/);
  assert.doesNotMatch(doc, /37001116520001001/);
  assert.doesNotMatch(doc, /SHIVANG/);
});
