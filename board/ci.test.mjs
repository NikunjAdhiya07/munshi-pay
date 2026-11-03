import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("ci runs lint, typecheck, tests, the board check, and the build", () => {
  const file = fs.readFileSync(
    new URL("../.github/workflows/check.yml", import.meta.url),
    "utf8",
  );
  assert.match(file, /^on:\s*$/m);
  assert.match(file, /^\s+push:\s*$/m);
  assert.match(file, /^\s+pull_request:\s*$/m);
  for (const command of [
    "npm ci",
    "npm run lint",
    "npm run typecheck",
    "npm test",
    "npm run board:check",
    "npm run build",
  ]) {
    assert.match(file, new RegExp(command.replaceAll(" ", "\\s+")));
  }
});
