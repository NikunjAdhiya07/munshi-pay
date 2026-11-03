import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

/** Import rules from DEC-015 and docs/architecture.md, checked against the source tree. */

const root = path.join(process.cwd(), "src");

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(full);
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) {
      return [];
    }
    return [full];
  });
}

type Source = { file: string; text: string; imports: string[] };

function load(): Source[] {
  return sources(root).map((full) => {
    const text = fs.readFileSync(full, "utf8");
    const imports = [...text.matchAll(/^\s*import\s[^;]*?from\s+"([^"]+)"/gm)]
      .filter((match) => !/^\s*import\s+type\s/.test(match[0]))
      .map((match) => match[1]);
    return {
      file: path.relative(root, full).replaceAll("\\", "/"),
      text,
      imports,
    };
  });
}

const all = load();
const under = (prefix: string) =>
  all.filter((item) => item.file.startsWith(prefix));

function offenders(
  files: Source[],
  bad: (specifier: string) => boolean,
): string[] {
  return files.flatMap((item) =>
    item.imports.filter(bad).map((specifier) => `${item.file} -> ${specifier}`),
  );
}

test("the source tree was found", () => {
  assert.ok(under("domain/").length > 0);
  assert.ok(under("server/").length > 0);
  assert.ok(under("app/").length > 0);
});

test("domain code imports only other domain modules", () => {
  assert.deepEqual(
    offenders(under("domain/"), (specifier) => !specifier.startsWith("./")),
    [],
  );
});

test("only server actions and auth import the web framework on the server", () => {
  const allowed = new Set(["server/actions.ts", "server/auth.ts"]);
  assert.deepEqual(
    offenders(
      under("server/").filter((item) => !allowed.has(item.file)),
      (specifier) => /^(next|react)(\/|$)/.test(specifier),
    ),
    [],
  );
});

test("server and domain code never import screens or components", () => {
  assert.deepEqual(
    offenders([...under("server/"), ...under("domain/")], (specifier) =>
      /(^|\/)(app|components)\//.test(specifier),
    ),
    [],
  );
});

test("client components import no server or store code", () => {
  const client = all.filter((item) => /^\s*["']use client["']/.test(item.text));
  assert.ok(client.length > 0);
  assert.deepEqual(
    offenders(client, (specifier) => /(^|\/)server\//.test(specifier)),
    [],
  );
});

test("screens and components write through server actions, never the store", () => {
  const writers = [...under("app/"), ...under("components/")].filter((item) =>
    /\b(updateStore|writeStore)\s*\(/.test(item.text),
  );
  assert.deepEqual(
    writers.map((item) => item.file),
    [],
  );
});

test("only the payroll use case calls the pay engine", () => {
  const callers = all
    .filter((item) =>
      item.imports.some((specifier) => /domain\/engine/.test(specifier)),
    )
    .map((item) => item.file);
  assert.deepEqual(callers, ["server/payroll.ts"]);
});

test("only the store and the import file area touch the file system", () => {
  const callers = all
    .filter((item) =>
      item.imports.some((specifier) => /^(node:)?fs(\/|$)/.test(specifier)),
    )
    .map((item) => item.file)
    .sort();
  assert.deepEqual(callers, ["server/import.ts", "server/store.ts"]);
});
