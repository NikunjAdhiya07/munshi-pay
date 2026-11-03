import { plainRupees } from "../domain/money.ts";
import { type ReportSlug, reportBySlug } from "../domain/reports.ts";
import type { Employee, PayrollRun, Store } from "./model.ts";

/**
 * Report rows for one company and month. The page and the CSV download both
 * read these rows, so a download always matches what the screen shows.
 * Money cells are integer paise. Nothing here calculates pay: every figure is
 * read from the saved payroll run, muster, leave, or employee record.
 */

export type ReportColumn = {
  label: string;
  /** text is escaped in a file. money is paise. count is a plain number. */
  kind: "text" | "money" | "count";
};

export type ReportRow = {
  employeeId: string | null;
  cells: (string | number)[];
};

export type ReportTable = {
  slug: ReportSlug;
  name: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  /** Why the report has no rows to show, when that is not just an empty month. */
  note: string | null;
};

const text = (label: string): ReportColumn => ({ label, kind: "text" });
const money = (label: string): ReportColumn => ({ label, kind: "money" });
const count = (label: string): ReportColumn => ({ label, kind: "count" });

const WHO = [text("Code"), text("Name")];

function runFor(
  store: Store,
  companyId: string,
  period: string,
): PayrollRun | undefined {
  return store.runs.find(
    (item) => item.companyId === companyId && item.period === period,
  );
}

/** Saved status of the month's run, or null when the month was not processed. */
export function runStatusFor(
  store: Store,
  companyId: string,
  period: string,
): PayrollRun["status"] | null {
  return runFor(store, companyId, period)?.status ?? null;
}

export function buildReport(
  store: Store,
  companyId: string,
  period: string,
  slug: ReportSlug,
): ReportTable {
  const def = reportBySlug(slug);
  if (!def) throw new Error(`Unknown report ${slug}`);
  const people = store.employees.filter((item) => item.companyId === companyId);
  const who = (employeeId: string): Employee | undefined =>
    people.find((item) => item.id === employeeId);
  const lines = (runFor(store, companyId, period)?.lines ?? []).filter(
    (line) => line.payable,
  );
  const table = (
    columns: ReportColumn[],
    rows: ReportRow[],
    note: string | null = null,
  ): ReportTable => ({ slug, name: def.name, columns, rows, note });
  const payrollRows = (
    pick: (
      line: (typeof lines)[number],
      person?: Employee,
    ) => (string | number)[],
  ): ReportRow[] =>
    lines.map((line) => {
      const person = who(line.employeeId);
      return {
        employeeId: line.employeeId,
        cells: [person?.code ?? "", person?.name ?? "", ...pick(line, person)],
      };
    });

  switch (slug) {
    case "salary-register":
      return table(
        [
          ...WHO,
          money("Basic"),
          money("DA"),
          money("Gross"),
          money("PF"),
          money("ESI"),
          money("PT"),
          money("Deductions"),
          money("Net"),
        ],
        payrollRows((line) => [
          line.basicPaise,
          line.daPaise,
          line.grossPaise,
          line.pfPaise,
          line.esiPaise,
          line.ptPaise,
          line.deductionPaise,
          line.netPaise,
        ]),
      );
    case "salary-slip":
      return table(
        [...WHO, money("Gross"), money("Deductions"), money("Net")],
        payrollRows((line) => [
          line.grossPaise,
          line.deductionPaise,
          line.netPaise,
        ]),
      );
    case "payment":
      return table(
        [...WHO, text("Paid by"), money("Net pay")],
        payrollRows((line, person) => [person?.paymentBy ?? "", line.netPaise]),
      );
    case "pf-register":
      return table(
        [...WHO, money("Gross"), money("PF")],
        payrollRows((line) => [line.grossPaise, line.pfPaise]),
      );
    case "esi-register":
      return table(
        [...WHO, money("Gross"), money("ESI")],
        payrollRows((line) => [line.grossPaise, line.esiPaise]),
      );
    case "pt-summary":
      return table(
        [...WHO, money("Gross"), money("PT")],
        payrollRows((line) => [line.grossPaise, line.ptPaise]),
      );
    case "attendance":
      return table(
        [
          ...WHO,
          count("Paid days"),
          count("Week off"),
          count("Public holiday"),
          count("Comp off"),
          count("On duty"),
        ],
        store.muster
          .filter((row) => row.companyId === companyId && row.period === period)
          .map((row) => {
            const person = who(row.employeeId);
            return {
              employeeId: row.employeeId,
              cells: [
                person?.code ?? "",
                person?.name ?? "",
                row.paidDays,
                row.weekOff,
                row.publicHoliday,
                row.compOff,
                row.onDuty,
              ],
            };
          }),
      );
    case "leave":
      return table(
        [
          ...WHO,
          text("Year"),
          text("Leave"),
          count("Brought forward"),
          count("This year"),
          count("Balance"),
        ],
        store.leaveBalances
          .filter((row) => row.companyId === companyId)
          .map((row) => {
            const person = who(row.employeeId);
            return {
              employeeId: row.employeeId,
              cells: [
                person?.code ?? "",
                person?.name ?? "",
                row.year,
                row.leaveName,
                row.broughtForward,
                row.yearCount,
                row.balance,
              ],
            };
          }),
      );
    case "full-final":
      return table(
        [...WHO, text("Left date"), text("Reason")],
        people
          .filter((person) => person.leftDate)
          .map((person) => ({
            employeeId: person.id,
            cells: [
              person.code,
              person.name,
              person.leftDate,
              person.leftReason,
            ],
          })),
      );
    case "it-declaration":
      return table(
        [],
        [],
        "The reference IT Master page was missing. No declaration records are stored, so there is nothing to list or download. Income-tax amounts stay zero until a rule is configured.",
      );
  }
}

/** A cell a spreadsheet would run as a formula is stored as plain text. */
function safeText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function quote(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

/** CSV of exactly the rows the report shows. Money is plain rupees. */
export function reportCsv(report: ReportTable): string {
  const header = report.columns.map((column) => quote(column.label)).join(",");
  const rows = report.rows.map((row) =>
    row.cells
      .map((cell, index) => {
        const kind = report.columns[index]?.kind;
        if (kind === "money") return plainRupees(Number(cell));
        if (kind === "count") return String(cell);
        return quote(safeText(String(cell)));
      })
      .join(","),
  );
  return `${[header, ...rows].join("\r\n")}\r\n`;
}
