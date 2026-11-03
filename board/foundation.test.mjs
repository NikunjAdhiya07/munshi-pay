import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("environment example has names only", () => {
  const example = fs.readFileSync(
    new URL("../.env.example", import.meta.url),
    "utf8",
  );
  assert.match(example, /^DATABASE_URL=$/m);
  assert.match(example, /^AUTH_SECRET=$/m);
  assert.match(example, /^AUTH_USERNAME=$/m);
  assert.match(example, /^AUTH_PASSWORD=$/m);
  assert.doesNotMatch(example, /postgres:\/\/\w+:\w+@/);
  assert.doesNotMatch(example, /sk-[A-Za-z0-9]/);
});

test("sign-in page does not embed credentials or payroll figures", () => {
  const page = fs.readFileSync(
    new URL("../src/app/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /Sign in/);
  assert.doesNotMatch(page, /ADMIN/);
  assert.doesNotMatch(page, /₹|\bINR\b|\b[0-9]{2,},[0-9]{3}\b/);
});
