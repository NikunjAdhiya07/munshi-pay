import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("lint, format, typecheck, and unit test scripts are present and lint passes", () => {
  const pkg = JSON.parse(
    fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  assert.equal(pkg.scripts.lint, "biome check .");
  assert.equal(pkg.scripts.format, "biome format --write .");
  assert.equal(pkg.scripts.typecheck, "tsc --noEmit");
  assert.match(pkg.scripts.test, /node --experimental-strip-types --test/);

  const config = fs.readFileSync(
    new URL("../biome.json", import.meta.url),
    "utf8",
  );
  assert.match(config, /"preset": "recommended"/);

  const lint = spawnSync("npx", ["biome", "check", "."], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    shell: true,
    encoding: "utf8",
  });
  assert.equal(lint.status, 0, lint.stdout + lint.stderr);
});
