import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { menuForRoute, ROUTE_MENUS, viewablePaths } from "./access.ts";
import { addDeduction } from "./deductions.ts";
import {
  addBalance,
  addEncashment,
  LeaveRegisterError,
} from "./leaveRegister.ts";
import { addLoan, LoanError } from "./loans.ts";
import { MENUS, type Right, type Store } from "./model.ts";
import { adjustLine, processPeriod } from "./payroll.ts";
import { seedStore } from "./store.ts";
import { addUser, memberOf } from "./users.ts";

const appDir = path.join(process.cwd(), "src", "app", "app");
let counter = 0;
const newId = () => `r${++counter}`;

function walk(dir: string, name: RegExp): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, name);
    return name.test(entry.name) ? [full] : [];
  });
}

/** The URL a page or route file serves, such as /app/payroll/slips/[employeeId]. */
function routeOf(file: string): string {
  const relative = path
    .relative(path.join(process.cwd(), "src", "app"), path.dirname(file))
    .replaceAll("\\", "/");
  return `/${relative}`;
}

function rightsWithout(menu: string): Right[] {
  return seedStore().rights.map((item) =>
    item.menu === menu ? { ...item, view: false } : item,
  );
}

test("every route in the table names a real menu", () => {
  for (const [route, menu] of Object.entries(ROUTE_MENUS)) {
    assert.ok(MENUS.includes(menu), `${route} -> ${menu}`);
  }
});

test("a path takes the menu of the longest route it is under", () => {
  assert.equal(menuForRoute("/app/payroll"), "payroll");
  assert.equal(menuForRoute("/app/payroll/slips/print"), "payroll");
  assert.equal(menuForRoute("/app/payroll/slips/e1?x=1#top"), "payroll");
  assert.equal(menuForRoute("/app/employees/new"), "employees");
  assert.equal(menuForRoute("/app/leave-policy"), "leave");
  assert.equal(menuForRoute("/app/leave"), "leave");
  assert.equal(menuForRoute("/app/shifts"), "masters");
  assert.equal(menuForRoute("/app/reports/salary-register"), "reports");
  assert.equal(menuForRoute("/app/leaves"), null);
  assert.equal(menuForRoute("/app"), null);
});

test("a role without view on a menu does not get that menu's paths", () => {
  const paths = [
    "/app",
    "/app/employees",
    "/app/payroll",
    "/app/payroll/slips",
    "/app/loans",
  ];
  const shown = viewablePaths("viewer", rightsWithout("payroll"), paths);
  assert.deepEqual(shown, ["/app", "/app/employees", "/app/loans"]);
  assert.deepEqual(
    viewablePaths("viewer", seedStore().rights, paths),
    paths,
    "a role with every view right sees every path",
  );
});

test("a login with no role in the company sees only the dashboard", () => {
  const paths = ["/app", "/app/employees", "/app/payroll", "/app/control"];
  assert.deepEqual(viewablePaths(null, seedStore().rights, paths), ["/app"]);
});

test("every side menu item has a menu, except the dashboard", () => {
  const text = fs.readFileSync(
    path.join(process.cwd(), "src", "domain", "navigation.ts"),
    "utf8",
  );
  const hrefs = [...text.matchAll(/href:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(hrefs.length > 10);
  for (const href of hrefs) {
    if (href === "/app") continue;
    assert.ok(menuForRoute(href), `${href} has no menu`);
  }
});

test("every workspace page checks the view right of its own menu", () => {
  const pages = walk(appDir, /^page\.tsx$/).filter(
    (file) => routeOf(file) !== "/app",
  );
  assert.ok(pages.length >= 25, `found ${pages.length} pages`);
  for (const file of pages) {
    const route = routeOf(file);
    const menu = menuForRoute(route);
    assert.ok(menu, `${route} has no menu in ROUTE_MENUS`);
    const text = fs.readFileSync(file, "utf8");
    assert.ok(
      new RegExp(`requireView\\("${menu}"`).test(text),
      `${route} must call requireView("${menu}")`,
    );
    assert.equal(
      text.includes("await requireSession()"),
      false,
      `${route} reads data on a session that was not checked for the right`,
    );
  }
});

test("the employee form and import form need the add right", () => {
  const page = fs.readFileSync(
    path.join(appDir, "employees", "new", "page.tsx"),
    "utf8",
  );
  assert.match(page, /requireView\("employees", "add"\)/);
});

test("every route handler checks a right before it reads data", () => {
  const routes = walk(appDir, /^route\.ts$/);
  assert.ok(routes.length >= 3);
  for (const file of routes) {
    const text = fs.readFileSync(file, "utf8");
    assert.match(
      text,
      /can\(|canExport\(|canViewReport\(/,
      `${routeOf(file)} has no rights check`,
    );
    assert.match(text, /session/, `${routeOf(file)} has no session check`);
  }
});

test("the dashboard hides each section the role has no view right for", () => {
  const text = fs.readFileSync(path.join(appDir, "page.tsx"), "utf8");
  for (const menu of [
    "payroll",
    "employees",
    "muster",
    "leave",
    "masters",
    "control",
  ]) {
    assert.ok(text.includes(`allowed("${menu}")`), menu);
  }
  const gates = text.match(/<Gate show=\{(\w+)\}>/g) ?? [];
  assert.ok(gates.length >= 12, `found ${gates.length} gated sections`);
  const pay = text.match(/<Gate show=\{viewPay\}>/g) ?? [];
  assert.ok(pay.length >= 6, "pay sections are gated");
});

const actionsSource = fs.readFileSync(
  path.join(process.cwd(), "src", "server", "actions.ts"),
  "utf8",
);

function actionBodies(): Map<string, string> {
  const bodies = new Map<string, string>();
  const heads = [...actionsSource.matchAll(/export async function (\w+)\(/g)];
  heads.forEach((match, index) => {
    const end = heads[index + 1]?.index ?? actionsSource.length;
    bodies.set(match[1], actionsSource.slice(match.index, end));
  });
  return bodies;
}

const OPEN_ACTIONS = [
  "login",
  "logout",
  "switchCompany",
  "enterCompany",
  "replacePassword",
  "setPeriod",
];

test("every server action except sign-in and session ones is guarded", () => {
  const bodies = actionBodies();
  assert.ok(bodies.size > 40, `found ${bodies.size} actions`);
  for (const [name, body] of bodies) {
    if (OPEN_ACTIONS.includes(name)) {
      assert.ok(
        name === "login" ||
          name === "logout" ||
          body.includes("requireSession"),
        `${name} needs a session`,
      );
      continue;
    }
    assert.match(
      body,
      /await (guard|requireView)\(/,
      `${name} must call guard() or requireView()`,
    );
  }
});

test("every delete and unlock action needs the delete right", () => {
  const bodies = actionBodies();
  const deletes = [...bodies].filter(
    ([name]) => name.startsWith("remove") || name === "unlockMonth",
  );
  assert.ok(deletes.length >= 10, `found ${deletes.length} delete actions`);
  for (const [name, body] of deletes) {
    assert.match(body, /await guard\("[\w-]+", "delete"\)/, name);
  }
});

test("no other action holds only the edit right where it deletes", () => {
  for (const [name, body] of actionBodies()) {
    if (/\bdelete\w*\(/.test(body) && !name.startsWith("remove")) {
      assert.match(body, /"delete"/, `${name} deletes data`);
    }
  }
});

test("switching company needs membership, and so does entering one", () => {
  const bodies = actionBodies();
  assert.match(bodies.get("switchCompany") ?? "", /memberOf\(/);
  assert.match(bodies.get("enterCompany") ?? "", /memberOf\(/);
});

function twoCompanyStore(): Store {
  const store = seedStore();
  const user = addUser(store, {
    id: "u-only-c1",
    username: "northwind-only",
    password: "long-enough-1",
    memberships: [{ companyId: "c1", role: "viewer" }],
  });
  assert.equal(user.memberships.length, 1);
  return store;
}

test("membership covers only the companies the login belongs to", () => {
  const store = twoCompanyStore();
  assert.equal(memberOf(store, "u-only-c1", "c1"), true);
  assert.equal(memberOf(store, "u-only-c1", "c2"), false);
  assert.equal(memberOf(store, "u-only-c1", "no-such-company"), false);
  assert.equal(memberOf(store, "no-such-user", "c1"), false);
  const owner = store.users.find((item) => item.accountOwner);
  if (owner) {
    assert.equal(memberOf(store, owner.id, "c2"), true);
  }
});

/** An employee of company c2 added to the demo store, which has none. */
function withForeignEmployee(): { store: Store; foreignId: string } {
  const store = seedStore();
  const base = store.employees[0];
  assert.ok(base);
  store.employees.push({
    ...base,
    id: "e-foreign",
    code: "F001",
    companyId: "c2",
  });
  return { store, foreignId: "e-foreign" };
}

test("a loan for an employee of another company is refused", () => {
  const { store, foreignId } = withForeignEmployee();
  const loans = store.loans.length;
  assert.throws(
    () =>
      addLoan(
        store,
        "c1",
        "tester",
        {
          employeeId: foreignId,
          date: "2026-10-01",
          amount: "1000",
          installment: "100",
          received: "0",
        },
        newId,
      ),
    LoanError,
  );
  assert.equal(store.loans.length, loans);
});

test("a deduction for an employee of another company is refused", () => {
  const { store, foreignId } = withForeignEmployee();
  const deductions = store.deductions.length;
  assert.throws(
    () =>
      addDeduction(
        store,
        "c1",
        "2026-10",
        "tester",
        { employeeId: foreignId, type: "Adv", amount: "100" },
        newId,
      ),
    /employee/i,
  );
  assert.equal(store.deductions.length, deductions);
});

test("a leave balance for an employee of another company is refused", () => {
  const { store, foreignId } = withForeignEmployee();
  const rows = store.leaveBalances.length;
  assert.throws(
    () =>
      addBalance(
        store,
        "c1",
        "tester",
        {
          employeeId: foreignId,
          year: "2026",
          leaveName: "Casual",
          broughtForward: "0",
          yearCount: "0",
          balance: "0",
        },
        newId,
      ),
    LeaveRegisterError,
  );
  assert.equal(store.leaveBalances.length, rows);
});

test("an encashment for an employee of another company is refused", () => {
  const { store, foreignId } = withForeignEmployee();
  const rows = store.encashments.length;
  const audits = store.audit.length;
  assert.throws(
    () =>
      addEncashment(
        store,
        "c1",
        "tester",
        {
          employeeId: foreignId,
          year: "2026",
          leaveName: "Earned",
          amountPaise: 100,
          used: "0",
          cashed: "0",
        },
        newId,
      ),
    /Choose an employee/,
  );
  assert.equal(store.encashments.length, rows);
  assert.equal(store.audit.length, audits);
});

test("an encashment is checked and audited with the code and no amount", () => {
  const store = seedStore();
  const mine = store.employees.find((item) => item.companyId === "c1");
  assert.ok(mine);
  const input = {
    employeeId: mine.id,
    year: "2026",
    leaveName: "Earned",
    amountPaise: 123456,
    used: "2",
    cashed: "1.5",
  };
  const refused: Array<[Partial<typeof input>, RegExp]> = [
    [{ year: "26" }, /four digits/],
    [{ leaveName: "  " }, /leave name/],
    [{ amountPaise: -1 }, /negative/],
    [{ amountPaise: 1.5 }, /negative/],
    [{ used: "abc" }, /used/],
    [{ cashed: "" }, /cashed/],
  ];
  for (const [patch, message] of refused) {
    assert.throws(
      () => addEncashment(store, "c1", "tester", { ...input, ...patch }, newId),
      (error) =>
        error instanceof LeaveRegisterError && message.test(error.message),
      JSON.stringify(patch),
    );
  }
  assert.equal(store.encashments.length, 0);
  const row = addEncashment(store, "c1", "tester", input, newId);
  assert.equal(row.companyId, "c1");
  assert.equal(row.amountPaise, 123456);
  assert.equal(row.cashed, 1.5);
  const entry = store.audit[0];
  assert.equal(
    entry?.action,
    `Added encashment Earned for ${mine.code} in 2026`,
  );
  assert.equal(entry?.companyId, "c1");
  assert.equal(JSON.stringify(entry).includes("123456"), false);
});

test("a line adjustment never reaches an employee of another company", () => {
  const { store, foreignId } = withForeignEmployee();
  processPeriod(store, "c1", "2026-10", "tester");
  assert.throws(
    () => adjustLine(store, "c1", "2026-10", foreignId, 1000, 0),
    /Employee not found/,
  );
});
