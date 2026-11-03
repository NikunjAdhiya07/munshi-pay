/**
 * The report catalog. Groups follow the reference report list. Only the ten
 * reports below are built. The reference lists about 80, and their layouts and
 * file formats were not captured (T-020), so none is invented here.
 */

export const reportGroups = [
  "Salary",
  "Provident fund",
  "ESI",
  "Professional tax and income tax",
  "General",
  "Attendance, bonus, gratuity",
] as const;

export type ReportGroup = (typeof reportGroups)[number];

/** Where a report reads its rows from. */
export type ReportSource = "payroll" | "muster" | "leave" | "leavers" | "none";

export const reports = [
  {
    slug: "salary-register",
    group: "Salary",
    name: "Salary register",
    source: "payroll",
  },
  {
    slug: "salary-slip",
    group: "Salary",
    name: "Salary slip",
    source: "payroll",
  },
  {
    slug: "payment",
    group: "Salary",
    name: "Payment report",
    source: "payroll",
  },
  {
    slug: "pf-register",
    group: "Provident fund",
    name: "PF register",
    source: "payroll",
  },
  {
    slug: "esi-register",
    group: "ESI",
    name: "ESI register",
    source: "payroll",
  },
  {
    slug: "pt-summary",
    group: "Professional tax and income tax",
    name: "PT summary",
    source: "payroll",
  },
  {
    slug: "it-declaration",
    group: "Professional tax and income tax",
    name: "IT declaration",
    source: "none",
  },
  {
    slug: "leave",
    group: "General",
    name: "Leave detail",
    source: "leave",
  },
  {
    slug: "full-final",
    group: "General",
    name: "Full and final",
    source: "leavers",
  },
  {
    slug: "attendance",
    group: "Attendance, bonus, gratuity",
    name: "Attendance summary",
    source: "muster",
  },
] as const satisfies readonly {
  slug: string;
  group: ReportGroup;
  name: string;
  source: ReportSource;
}[];

export type ReportSlug = (typeof reports)[number]["slug"];
export type ReportDef = (typeof reports)[number];

export function reportBySlug(slug: string): ReportDef | undefined {
  return reports.find((item) => item.slug === slug);
}

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isPeriod(value: string | undefined): value is string {
  return value !== undefined && PERIOD.test(value);
}

export { isIsoDate } from "./dates.ts";
