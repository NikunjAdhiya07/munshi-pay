import ExcelJS from "exceljs";
import { plainRupees } from "../domain/money.ts";
import type { ExportTable } from "./exports.ts";

const { Workbook } = ExcelJS;

export type SheetRow = { number: number; cells: string[] };

function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof value === "object" && "richText" in value) {
    const parts = (value as { richText?: { text?: string }[] }).richText ?? [];
    return parts
      .map((part) => part.text ?? "")
      .join("")
      .trim();
  }
  if (typeof value === "object" && "text" in value) {
    return String((value as { text?: string }).text ?? "").trim();
  }
  return String(value).trim();
}

export async function readSheet(bytes: Buffer): Promise<SheetRow[]> {
  const workbook = new Workbook();
  await workbook.xlsx.load(bytes as never);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const rows: SheetRow[] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const last = Math.max(sheet.columnCount, row.cellCount);
    const cells: string[] = [];
    for (let index = 1; index <= last; index += 1) {
      cells.push(cellText(row.getCell(index).value));
    }
    while (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();
    rows.push({ number: row.number, cells });
  });
  return rows.filter((row, index) => index === 0 || row.cells.length > 0);
}

export async function sampleSheet(headers: string[]): Promise<Buffer> {
  return buildSheet([headers]);
}

/**
 * One sheet with a bold header. Money columns hold paise and are written as
 * rupee numbers with two decimals, so a spreadsheet can total them. Text is
 * written as text, so a cell starting with "=" is not run as a formula.
 */
export async function buildTableSheet(table: ExportTable): Promise<Buffer> {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet(sheetName(table.title));
  sheet.columns = table.columns.map((column) => ({
    header: column.label,
    key: column.key,
    width: Math.max(10, column.label.length + 2),
    style: column.money ? { numFmt: "0.00" } : {},
  }));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  for (const row of table.rows) {
    sheet.addRow(
      row.map((cell, index) =>
        table.columns[index]?.money && typeof cell === "number"
          ? Number(plainRupees(cell))
          : String(cell),
      ),
    );
  }
  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out);
}

/** Excel refuses sheet names over 31 characters or with []:*?/\ in them. */
function sheetName(title: string): string {
  return title.replace(/[[\]:*?/\\]/g, " ").slice(0, 31) || "Export";
}

export async function buildSheet(rows: string[][]): Promise<Buffer> {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet("Import");
  for (const row of rows) sheet.addRow(row);
  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out);
}
