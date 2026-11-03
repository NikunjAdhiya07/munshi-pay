/** The side menu as data, so the server can decide which items a role may see. */
export const navGroups = [
  {
    label: "Overview",
    items: [{ href: "/app", label: "Dashboard", icon: "dashboard" }],
  },
  {
    label: "Master",
    items: [
      { href: "/app/company", label: "Company", icon: "company" },
      { href: "/app/employees", label: "Employees", icon: "users" },
      { href: "/app/import", label: "Import Excel", icon: "upload" },
      { href: "/app/exports", label: "Export Excel", icon: "download" },
      { href: "/app/masters", label: "Lists and rules", icon: "list" },
      { href: "/app/percentages", label: "Set percentage", icon: "percent" },
      { href: "/app/misc", label: "Misc. entry", icon: "tag" },
      { href: "/app/holidays", label: "Holiday entry", icon: "calendar" },
    ],
  },
  {
    label: "Time",
    items: [
      { href: "/app/shifts", label: "Shift master", icon: "clock" },
      {
        href: "/app/muster",
        label: "Monthly muster",
        icon: "calendar-check",
      },
    ],
  },
  {
    label: "Payroll",
    items: [
      { href: "/app/payroll", label: "Process salary", icon: "wallet" },
      { href: "/app/payroll/entry", label: "Salary entry", icon: "edit" },
      {
        href: "/app/payroll/summary",
        label: "Salary summary",
        icon: "summary",
      },
      {
        href: "/app/payroll/register",
        label: "Salary register",
        icon: "table",
      },
      { href: "/app/payroll/slips", label: "Salary slips", icon: "receipt" },
    ],
  },
  {
    label: "Deductions",
    items: [
      { href: "/app/loans", label: "Loans", icon: "loan" },
      { href: "/app/deductions", label: "Deduction entry", icon: "minus" },
    ],
  },
  {
    label: "Leave",
    items: [
      { href: "/app/leave-policy", label: "Leave policy", icon: "book" },
      { href: "/app/leave", label: "Leave register", icon: "leave" },
    ],
  },
  {
    label: "Reports",
    items: [{ href: "/app/reports", label: "Reports", icon: "file" }],
  },
  {
    label: "Control",
    items: [
      { href: "/app/control", label: "Locks and access", icon: "shield" },
    ],
  },
];

export const navPaths: string[] = navGroups.flatMap((group) =>
  group.items.map((item) => item.href),
);

/** The nav item that matches a path most closely, so a parent is not also current. */
export function currentNavItem(pathname: string) {
  const matches = navGroups
    .flatMap((group) =>
      group.items.map((item) => ({ ...item, group: group.label })),
    )
    .filter((item) =>
      item.href === "/app"
        ? pathname === "/app"
        : pathname === item.href || pathname.startsWith(`${item.href}/`),
    );
  return matches.sort((a, b) => b.href.length - a.href.length)[0] ?? null;
}
