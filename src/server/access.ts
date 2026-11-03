import type { ReportGroup } from "../domain/reports.ts";
import type { Menu, Right, Role } from "./model.ts";

export type Action = "view" | "add" | "edit" | "delete";

export function can(
  role: Role | null,
  rights: Right[],
  menu: string,
  action: Action,
): boolean {
  if (!role) return false;
  const match = rights.find(
    (right) => right.role === role && right.menu === menu,
  );
  if (!match) return false;
  return match[action];
}

export const MENU_LABELS: Record<Menu, string> = {
  company: "Company",
  employees: "Employees",
  masters: "Masters",
  muster: "Monthly muster",
  loans: "Loans",
  deductions: "Deductions",
  leave: "Leave",
  payroll: "Payroll",
  reports: "Reports",
  control: "Locks and access",
  import: "Import",
  export: "Export",
  users: "Users and roles",
  "reports-salary": "Reports: salary",
  "reports-pf": "Reports: provident fund",
  "reports-esi": "Reports: ESI",
  "reports-tax": "Reports: professional tax and income tax",
  "reports-general": "Reports: general",
  "reports-attendance": "Reports: attendance, bonus, gratuity",
};

/**
 * The menu whose view right opens each workspace route. A page under a route
 * uses its parent's menu. The dashboard is not listed: every member of the
 * company may open it, and it hides the sections they have no view right for.
 */
export const ROUTE_MENUS: Record<string, Menu> = {
  "/app/company": "company",
  "/app/employees": "employees",
  "/app/import": "import",
  "/app/exports": "export",
  "/app/masters": "masters",
  "/app/percentages": "masters",
  "/app/misc": "masters",
  "/app/holidays": "masters",
  "/app/shifts": "masters",
  "/app/muster": "muster",
  "/app/payroll": "payroll",
  "/app/loans": "loans",
  "/app/deductions": "deductions",
  "/app/leave-policy": "leave",
  "/app/leave": "leave",
  "/app/reports": "reports",
  "/app/control": "control",
};

/** The menu for a path: the longest listed route that the path is, or is under. */
export function menuForRoute(path: string): Menu | null {
  const clean = path.split("?")[0].split("#")[0];
  const match = Object.keys(ROUTE_MENUS)
    .filter((route) => clean === route || clean.startsWith(`${route}/`))
    .sort((a, b) => b.length - a.length)[0];
  return match ? ROUTE_MENUS[match] : null;
}

/** The paths the role may open. A path with no listed menu is always kept. */
export function viewablePaths(
  role: Role | null,
  rights: Right[],
  paths: string[],
): string[] {
  return paths.filter((path) => {
    const menu = menuForRoute(path);
    return menu === null || can(role, rights, menu, "view");
  });
}

/**
 * The page a company or month change may return to. Only a listed menu page
 * the role may open is accepted, so a forged value cannot send anyone to a page
 * with a record id, a download route, or a page the role has no right to view.
 * Anything else returns null and the caller uses the dashboard.
 */
export function safeReturnPath(
  from: string,
  role: Role | null,
  rights: Right[],
  pages: string[],
): string | null {
  const clean = from.split("?")[0].split("#")[0];
  if (!pages.includes(clean)) return null;
  return viewablePaths(role, rights, [clean]).length === 1 ? clean : null;
}

/** Each report group has its own menu so a role can see salary reports without PF or ESI (DEC-017). */
export const REPORT_MENUS: Record<ReportGroup, Menu> = {
  Salary: "reports-salary",
  "Provident fund": "reports-pf",
  ESI: "reports-esi",
  "Professional tax and income tax": "reports-tax",
  General: "reports-general",
  "Attendance, bonus, gratuity": "reports-attendance",
};

/** Opening a report needs view on reports and on the report's group. */
export function canViewReport(
  role: Role | null,
  rights: Right[],
  group: ReportGroup,
): boolean {
  return (
    can(role, rights, "reports", "view") &&
    can(role, rights, REPORT_MENUS[group], "view")
  );
}

/** A download needs view on export and on the menu whose screen shows the same data. */
export function canExport(
  role: Role | null,
  rights: Right[],
  menu: string,
): boolean {
  return can(role, rights, "export", "view") && can(role, rights, menu, "view");
}
