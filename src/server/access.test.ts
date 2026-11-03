import assert from "node:assert/strict";
import test from "node:test";
import { reportGroups } from "../domain/reports.ts";
import {
  can,
  canExport,
  canViewReport,
  MENU_LABELS,
  menuForRoute,
  REPORT_MENUS,
  safeReturnPath,
  viewablePaths,
} from "./access.ts";
import { MENUS, type Right } from "./model.ts";
import { seedStore } from "./store.ts";

const right = (menu: string, view: boolean, rest = false): Right => ({
  role: "viewer",
  menu,
  view,
  add: rest,
  edit: rest,
  delete: rest,
});

test("every menu has a label and every report group has its own menu", () => {
  for (const menu of MENUS) assert.ok(MENU_LABELS[menu], menu);
  const groupMenus = reportGroups.map((group) => REPORT_MENUS[group]);
  assert.equal(new Set(groupMenus).size, reportGroups.length);
  for (const menu of groupMenus) assert.ok(MENUS.includes(menu), menu);
  for (const menu of ["export", "users", "import"]) {
    assert.ok((MENUS as readonly string[]).includes(menu), menu);
  }
});

test("the seed gives owner every right and viewer only view on every menu", () => {
  const { rights } = seedStore();
  for (const menu of MENUS) {
    for (const action of ["view", "add", "edit", "delete"] as const) {
      assert.equal(can("owner", rights, menu, action), true, `owner ${menu}`);
      assert.equal(
        can("viewer", rights, menu, action),
        action === "view",
        `viewer ${action} ${menu}`,
      );
    }
  }
});

test("a menu without a right row is closed", () => {
  assert.equal(can("owner", [], "payroll", "view"), false);
  assert.equal(can("owner", seedStore().rights, "no-such-menu", "view"), false);
});

test("a report needs view on reports and on its group", () => {
  const both = [right("reports", true), right("reports-salary", true)];
  assert.equal(canViewReport("viewer", both, "Salary"), true);
  assert.equal(canViewReport("viewer", both, "Provident fund"), false);
  const groupOnly = [right("reports", false), right("reports-salary", true)];
  assert.equal(canViewReport("viewer", groupOnly, "Salary"), false);
});

test("an export needs view on export and on the screen that shows the data", () => {
  const rights = [right("export", true), right("payroll", true)];
  assert.equal(canExport("viewer", rights, "payroll"), true);
  assert.equal(canExport("viewer", rights, "employees"), false);
  const noExport = [right("export", false), right("payroll", true, true)];
  assert.equal(canExport("viewer", noExport, "payroll"), false);
});

test("unlock needs a right the seeded viewer does not hold", () => {
  const { rights } = seedStore();
  assert.equal(can("viewer", rights, "control", "delete"), false);
  assert.equal(can("owner", rights, "control", "delete"), true);
});

test("a route uses its own menu, and a page under it uses the parent", () => {
  assert.equal(menuForRoute("/app"), null);
  assert.equal(menuForRoute("/app/payroll/entry"), "payroll");
  assert.equal(menuForRoute("/app/company/profile"), "company");
  assert.equal(menuForRoute("/app/leave-policy"), "leave");
  const { rights } = seedStore();
  const paths = ["/app", "/app/company", "/app/payroll", "/app/employees"];
  assert.deepEqual(viewablePaths("owner", rights, paths), paths);
  const closed = rights.map((right) =>
    right.role === "viewer" && right.menu === "company"
      ? { ...right, view: false }
      : right,
  );
  assert.deepEqual(viewablePaths("viewer", closed, paths), [
    "/app",
    "/app/payroll",
    "/app/employees",
  ]);
  assert.deepEqual(viewablePaths(null, rights, paths), ["/app"]);
});

test("every remove action asks for the delete right", async () => {
  const fs = await import("node:fs");
  const source = fs.readFileSync(
    new URL("./actions.ts", import.meta.url),
    "utf8",
  );
  const names = [...source.matchAll(/export async function (remove\w+)/g)].map(
    (match) => match[1],
  );
  assert.ok(names.includes("removeEmployee"));
  assert.ok(names.includes("removeLoan"));
  assert.ok(names.includes("removeBalance"));
  for (const name of names) {
    const start = source.indexOf(`export async function ${name}`);
    const body = source.slice(start, start + 500);
    assert.match(body, /"delete"/, name);
  }
});

test("an older store gains rows for menus added since it was saved", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const { readStore, resetStoreCache } = await import("./store.ts");
  const file = path.join(os.tmpdir(), `munshi-access-${Date.now()}.json`);
  const legacy = seedStore();
  legacy.rights = legacy.rights.filter(
    (item) => item.menu !== "export" && !item.menu.startsWith("reports-"),
  );
  const custom = legacy.rights.find(
    (item) => item.role === "viewer" && item.menu === "payroll",
  );
  if (custom) custom.view = false;
  fs.writeFileSync(file, JSON.stringify(legacy));
  process.env.STORE_PATH = file;
  resetStoreCache();
  try {
    const { rights } = readStore();
    assert.equal(can("owner", rights, "export", "view"), true);
    assert.equal(can("viewer", rights, "reports-pf", "view"), true);
    assert.equal(can("viewer", rights, "reports-pf", "add"), false);
    assert.equal(
      can("viewer", rights, "payroll", "view"),
      false,
      "an existing row is kept",
    );
  } finally {
    fs.rmSync(file, { force: true });
    delete process.env.STORE_PATH;
    resetStoreCache();
  }
});

test("a company or month change returns only to a listed page the role may view", () => {
  const { rights } = seedStore();
  const pages = ["/app", "/app/employees", "/app/payroll", "/app/company"];
  assert.equal(
    safeReturnPath("/app/employees?page=2#top", "owner", rights, pages),
    "/app/employees",
  );
  assert.equal(safeReturnPath("/app", "viewer", rights, pages), "/app");
  assert.equal(
    safeReturnPath("/app/employees/e1", "owner", rights, pages),
    null,
  );
  assert.equal(safeReturnPath("/app/export", "owner", rights, pages), null);
  assert.equal(safeReturnPath("//evil.example", "owner", rights, pages), null);
  assert.equal(
    safeReturnPath("https://evil.example/app", "owner", rights, pages),
    null,
  );
  assert.equal(safeReturnPath("", "owner", rights, pages), null);
  const closed = rights.map((item) =>
    item.role === "viewer" && item.menu === "company"
      ? { ...item, view: false }
      : item,
  );
  assert.equal(safeReturnPath("/app/company", "viewer", closed, pages), null);
  assert.equal(
    safeReturnPath("/app/payroll", "viewer", closed, pages),
    "/app/payroll",
  );
});
