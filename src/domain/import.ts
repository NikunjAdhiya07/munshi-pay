export const FILE_LIMIT_BYTES = 1_048_576;
export const ROW_LIMIT = 1000;

export type ImportColumn = {
  key: string;
  label: string;
  required: boolean;
  sensitive?: boolean;
};

export type ImportDefinition = {
  id: string;
  title: string;
  unique: string[];
  columns: ImportColumn[];
};

export const imports: ImportDefinition[] = [
  {
    id: "employees",
    title: "Employees",
    unique: ["code"],
    columns: [
      { key: "code", label: "Code", required: true },
      { key: "name", label: "Name", required: true },
      { key: "joinDate", label: "Join date", required: true },
    ],
  },
  {
    id: "salary-rates",
    title: "Salary rates",
    unique: ["code", "asOn"],
    columns: [
      { key: "code", label: "Code", required: true },
      { key: "asOn", label: "As on", required: true },
      { key: "gross", label: "Gross", required: true },
    ],
  },
  {
    id: "nominees",
    title: "Nominees",
    unique: ["code", "nominee"],
    columns: [
      { key: "code", label: "Code", required: true },
      { key: "nominee", label: "Nominee name", required: true },
      { key: "relation", label: "Relation", required: true },
    ],
  },
  {
    id: "deductions",
    title: "Monthly deductions",
    unique: ["code", "period", "type"],
    columns: [
      { key: "code", label: "Code", required: true },
      { key: "period", label: "Period", required: true },
      { key: "type", label: "Type", required: true },
      { key: "amount", label: "Amount", required: true },
    ],
  },
  {
    id: "leave-opening",
    title: "Leave opening balances",
    unique: ["code", "year", "leave"],
    columns: [
      { key: "code", label: "Code", required: true },
      { key: "year", label: "Year", required: true },
      { key: "leave", label: "Leave", required: true },
      { key: "balance", label: "Balance", required: true },
    ],
  },
  {
    id: "attendance",
    title: "Monthly attendance",
    unique: ["code", "period"],
    columns: [
      { key: "code", label: "Code", required: true },
      { key: "period", label: "Period", required: true },
      { key: "paidDays", label: "Paid days", required: true },
    ],
  },
  {
    id: "attendance-summary",
    title: "Attendance summary with deduction",
    unique: ["code", "period"],
    columns: [
      { key: "code", label: "Code", required: true },
      { key: "period", label: "Period", required: true },
      { key: "paidDays", label: "Paid days", required: true },
      { key: "deduction", label: "Deduction", required: true },
    ],
  },
];

export type SheetRow = { number: number; cells: string[] };

export type ReviewedRow = {
  number: number;
  values: Record<string, string>;
  status: "accepted" | "rejected";
  reason: string;
};

export type Review =
  | { state: "file"; message: string }
  | { state: "rows"; rows: ReviewedRow[] };

export function findImport(id: string): ImportDefinition | null {
  return imports.find((item) => item.id === id) ?? null;
}

export function fileProblem(name: string, size: number): string | null {
  if (!name.toLowerCase().endsWith(".xlsx")) return "Upload an .xlsx file.";
  if (size <= 0) return "The file is empty.";
  if (size > FILE_LIMIT_BYTES) return "The file is over the 1 MB limit.";
  return null;
}

export function displayCell(value: string, sensitive: boolean): string {
  if (!sensitive || value.trim() === "") return value;
  return "Hidden";
}

function headerKey(label: string): string {
  return label.trim().toLowerCase();
}

export function reviewSheet(
  definition: ImportDefinition,
  rows: SheetRow[],
): Review {
  if (rows.length === 0)
    return { state: "file", message: "The file has no header row." };
  const header = rows[0].cells.map((cell) => cell.trim());
  if (header.some((cell) => cell === "")) {
    return { state: "file", message: "The header row has an empty column." };
  }
  const expected = new Map(
    definition.columns.map((column) => [headerKey(column.label), column]),
  );
  if (header.length !== definition.columns.length) {
    return {
      state: "file",
      message: `Use the sample columns: ${definition.columns.map((column) => column.label).join(", ")}.`,
    };
  }
  const mapped: ImportColumn[] = [];
  const seen = new Set<string>();
  for (const label of header) {
    const column = expected.get(headerKey(label));
    if (!column || seen.has(column.key)) {
      return {
        state: "file",
        message: `Use the sample columns: ${definition.columns.map((item) => item.label).join(", ")}.`,
      };
    }
    seen.add(column.key);
    mapped.push(column);
  }
  const data = rows
    .slice(1)
    .filter((row) => row.cells.some((cell) => cell.trim() !== ""));
  if (data.length === 0)
    return { state: "file", message: "The file has no data rows." };
  if (data.length > ROW_LIMIT) {
    return {
      state: "file",
      message: `The file has more than ${ROW_LIMIT} rows.`,
    };
  }
  const reviewed: ReviewedRow[] = data.map((row) => {
    const values: Record<string, string> = {};
    mapped.forEach((column, index) => {
      values[column.key] = (row.cells[index] ?? "").trim();
    });
    const missing = mapped.find(
      (column) => column.required && values[column.key] === "",
    );
    if (missing) {
      return {
        number: row.number,
        values,
        status: "rejected" as const,
        reason: `${missing.label} is required.`,
      };
    }
    return {
      number: row.number,
      values,
      status: "accepted" as const,
      reason: "",
    };
  });
  const seenKeys = new Set<string>();
  for (const row of reviewed) {
    if (row.status !== "accepted") continue;
    const identity = definition.unique
      .map((key) => row.values[key] ?? "")
      .join("\u0000");
    if (seenKeys.has(identity)) {
      row.status = "rejected";
      row.reason = "This row repeats one already in the file.";
    } else {
      seenKeys.add(identity);
    }
  }
  return { state: "rows", rows: reviewed };
}

export function acceptedRows(review: Review): Record<string, string>[] {
  if (review.state !== "rows") return [];
  return review.rows
    .filter((row) => row.status === "accepted")
    .map((row) => row.values);
}

export function canCommit(review: Review): boolean {
  return (
    review.state === "rows" &&
    review.rows.length > 0 &&
    review.rows.every((row) => row.status === "accepted")
  );
}
