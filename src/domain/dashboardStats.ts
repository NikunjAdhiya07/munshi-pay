import { changeLabel, changePercent, compactInr } from "./format.ts";
import { formatInr } from "./money.ts";

/**
 * Figures behind the dashboard charts. Everything here reads processed payroll
 * lines and adds them up; nothing is estimated and nothing is invented. Money
 * stays in integer paise, so the parts of a total always add back to it.
 */

/** One payable line with the person it belongs to. */
export type StatLine = {
  employeeId: string;
  name: string;
  code: string;
  department: string;
  grossPaise: number;
  basicPaise: number;
  daPaise: number;
  otherEarningPaise: number;
  pfPaise: number;
  esiPaise: number;
  ptPaise: number;
  loanPaise: number;
  /** Other deductions without the manual adjustment, which is listed apart. */
  otherDeductionPaise: number;
  adjustmentPaise: number;
  deductionPaise: number;
  netPaise: number;
};

/** The shape of a saved payroll line, as far as the dashboard needs it. */
export type SourceLine = {
  employeeId: string;
  grossPaise: number;
  basicPaise: number;
  daPaise: number;
  otherEarningPaise: number;
  pfPaise: number;
  esiPaise: number;
  ptPaise: number;
  loanPaise: number;
  /** Includes the deduction adjustment, as the payroll engine stores it. */
  otherDeductionPaise: number;
  deductionAdjustmentPaise: number;
  deductionPaise: number;
  netPaise: number;
};

export function toStatLine(
  line: SourceLine,
  person: { name: string; code: string; department: string } | undefined,
): StatLine {
  return {
    employeeId: line.employeeId,
    name: person?.name ?? line.employeeId,
    code: person?.code ?? "",
    department: person?.department || "Unassigned",
    grossPaise: line.grossPaise,
    basicPaise: line.basicPaise,
    daPaise: line.daPaise,
    otherEarningPaise: line.otherEarningPaise,
    pfPaise: line.pfPaise,
    esiPaise: line.esiPaise,
    ptPaise: line.ptPaise,
    loanPaise: line.loanPaise,
    // The engine folds the adjustment into other deductions. Taking it back out
    // keeps "Other" and "Adjustments" from counting the same rupees twice.
    otherDeductionPaise:
      line.otherDeductionPaise - line.deductionAdjustmentPaise,
    adjustmentPaise: line.deductionAdjustmentPaise,
    deductionPaise: line.deductionPaise,
    netPaise: line.netPaise,
  };
}

export type Totals = {
  people: number;
  gross: number;
  deductions: number;
  net: number;
  basic: number;
  da: number;
  otherEarning: number;
};

export function totalsOf(lines: StatLine[]): Totals {
  const sum = (pick: (line: StatLine) => number) =>
    lines.reduce((total, line) => total + pick(line), 0);
  return {
    people: lines.length,
    gross: sum((line) => line.grossPaise),
    deductions: sum((line) => line.deductionPaise),
    net: sum((line) => line.netPaise),
    basic: sum((line) => line.basicPaise),
    da: sum((line) => line.daPaise),
    otherEarning: sum((line) => line.otherEarningPaise),
  };
}

export const DEDUCTION_PARTS = [
  { key: "pf", name: "PF", pick: (l: StatLine) => l.pfPaise },
  { key: "esi", name: "ESI", pick: (l: StatLine) => l.esiPaise },
  { key: "pt", name: "Professional tax", pick: (l: StatLine) => l.ptPaise },
  { key: "loan", name: "Loans", pick: (l: StatLine) => l.loanPaise },
  {
    key: "other",
    name: "Other deductions",
    pick: (l: StatLine) => l.otherDeductionPaise,
  },
  {
    key: "adjustment",
    name: "Adjustments",
    pick: (l: StatLine) => l.adjustmentPaise,
  },
] as const;

export type DeductionKey = (typeof DEDUCTION_PARTS)[number]["key"];

export type Contribution = {
  employeeId: string;
  name: string;
  code: string;
  paise: number;
};

export type DeductionPart = {
  key: DeductionKey;
  name: string;
  paise: number;
  /** Who pays into this part, largest first. Empty when the part is zero. */
  people: Contribution[];
};

/** Every deduction part, including the ones that are zero. */
export function deductionBreakdown(lines: StatLine[]): DeductionPart[] {
  return DEDUCTION_PARTS.map((part) => {
    const people = lines
      .map((line) => ({
        employeeId: line.employeeId,
        name: line.name,
        code: line.code,
        paise: part.pick(line),
      }))
      .filter((item) => item.paise !== 0)
      .sort((a, b) => b.paise - a.paise || a.name.localeCompare(b.name));
    return {
      key: part.key,
      name: part.name,
      paise: people.reduce((total, item) => total + item.paise, 0),
      people,
    };
  });
}

export type WaterfallStep = {
  key: string;
  name: string;
  /** Signed effect on the running amount. Totals carry their full amount. */
  paise: number;
  kind: "total" | "minus" | "plus";
  /** The running amount before and after this step. */
  from: number;
  to: number;
};

/**
 * Gross, then each non-zero deduction taking pay away, then net. The last
 * running amount equals net because every line has gross minus deductions
 * equal to net.
 */
export function waterfall(lines: StatLine[]): WaterfallStep[] {
  const totals = totalsOf(lines);
  const steps: WaterfallStep[] = [
    {
      key: "gross",
      name: "Gross",
      paise: totals.gross,
      kind: "total",
      from: 0,
      to: totals.gross,
    },
  ];
  let running = totals.gross;
  for (const part of deductionBreakdown(lines)) {
    if (part.paise === 0) continue;
    const next = running - part.paise;
    steps.push({
      key: part.key,
      name: part.name,
      paise: -part.paise,
      kind: part.paise > 0 ? "minus" : "plus",
      from: running,
      to: next,
    });
    running = next;
  }
  steps.push({
    key: "net",
    name: "Net",
    paise: running,
    kind: "total",
    from: 0,
    to: running,
  });
  return steps;
}

export type DepartmentRow = {
  name: string;
  people: number;
  gross: number;
  deductions: number;
  net: number;
  averageNet: number;
};

export function departmentRollup(lines: StatLine[]): DepartmentRow[] {
  const map = new Map<string, StatLine[]>();
  for (const line of lines) {
    map.set(line.department, [...(map.get(line.department) ?? []), line]);
  }
  return [...map.entries()]
    .map(([name, group]) => {
      const totals = totalsOf(group);
      return {
        name,
        people: group.length,
        gross: totals.gross,
        deductions: totals.deductions,
        net: totals.net,
        averageNet: Math.round(totals.net / group.length),
      };
    })
    .sort((a, b) => b.net - a.net || a.name.localeCompare(b.name));
}

export type PayBand = {
  fromPaise: number;
  /** Exclusive, except for the last band, which includes its top. */
  toPaise: number;
  label: string;
  people: { employeeId: string; name: string; paise: number }[];
};

/** A round step of 1, 2, 2.5, 5, or 10 times a power of ten. */
function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  const step =
    unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10;
  return step * power;
}

/**
 * Groups employees by pay into round bands. With fewer than `minPeople` lines a
 * histogram says nothing a ranked list does not, so this returns null and the
 * caller shows the ranked list instead.
 */
export function payBands(
  lines: StatLine[],
  pick: (line: StatLine) => number,
  options: { maxBands?: number; minPeople?: number } = {},
): PayBand[] | null {
  const maxBands = options.maxBands ?? 6;
  const minPeople = options.minPeople ?? 5;
  if (lines.length < minPeople) return null;
  const values = lines.map(pick);
  const low = Math.min(...values);
  const high = Math.max(...values);
  // Whole thousands of rupees keep the band edges readable.
  const step = Math.max(
    100_000,
    niceStep((high - low || high || 1) / maxBands),
  );
  const start = Math.floor(low / step) * step;
  const count = Math.max(1, Math.ceil((high - start + 1) / step));
  const bands: PayBand[] = Array.from({ length: count }, (_, index) => ({
    fromPaise: start + index * step,
    toPaise: start + (index + 1) * step,
    label: `${compactInr(start + index * step)} – ${compactInr(start + (index + 1) * step)}`,
    people: [],
  }));
  for (const line of lines) {
    const value = pick(line);
    const index = Math.min(count - 1, Math.floor((value - start) / step));
    bands[index].people.push({
      employeeId: line.employeeId,
      name: line.name,
      paise: value,
    });
  }
  return bands;
}

export type MonthFigures = {
  period: string;
  status: string;
  payable: number;
  gross: number;
  deductions: number;
  net: number;
};

export type Insight = {
  tone: "positive" | "info" | "attention";
  text: string;
  href?: string;
};

/**
 * Plain statements that follow from the figures on the page. Each one is
 * computed from the processed lines; a statement with nothing behind it is
 * left out rather than guessed.
 */
export function payrollInsights(input: {
  lines: StatLine[];
  totals: Totals;
  parts: DeductionPart[];
  departments: DepartmentRow[];
  previous?: MonthFigures;
  previousLabel?: string;
  held: number;
  activeCount: number;
  musterCount: number | null;
  monthLabel: string;
  pfConfigured: boolean;
  esiConfigured: boolean;
}): Insight[] {
  const { totals, parts, departments, previous } = input;
  const out: Insight[] = [];
  if (totals.people === 0) return out;

  if (totals.gross > 0) {
    const ratio = ((totals.net / totals.gross) * 100).toFixed(1);
    out.push({
      tone: "info",
      text: `Take-home is ${ratio}% of gross across ${totals.people} paid ${totals.people === 1 ? "employee" : "employees"}. Average net pay is ${formatInr(Math.round(totals.net / totals.people))}.`,
    });
  }

  const biggest = [...parts].sort((a, b) => b.paise - a.paise)[0];
  if (biggest && biggest.paise > 0 && totals.deductions > 0) {
    const share = Math.round((biggest.paise / totals.deductions) * 100);
    out.push({
      tone: "info",
      text: `${biggest.name} is the largest deduction at ${formatInr(biggest.paise)}, ${share}% of all deductions.`,
    });
  }

  if (departments.length >= 2) {
    const top = [...departments].sort(
      (a, b) => b.averageNet - a.averageNet || a.name.localeCompare(b.name),
    )[0];
    const lead = departments[0];
    out.push({
      tone: "info",
      text: `${lead.name} carries the most net pay, ${formatInr(lead.net)} (${Math.round((lead.net / Math.max(totals.net, 1)) * 100)}%). ${top.name} has the highest average, ${formatInr(top.averageNet)}.`,
    });
  }

  if (previous && input.previousLabel) {
    const change = changePercent(totals.net, previous.net);
    if (change !== null) {
      out.push({
        tone: change < 0 ? "attention" : "positive",
        text:
          change === 0
            ? `Net pay is unchanged from ${input.previousLabel}.`
            : `Net pay is ${changeLabel(change).replace("-", "down ").replace("+", "up ")} on ${input.previousLabel}, ${formatInr(previous.net)} to ${formatInr(totals.net)}.`,
      });
    }
  }

  if (input.held > 0) {
    out.push({
      tone: "attention",
      text: `${input.held} ${input.held === 1 ? "employee is" : "employees are"} held for exceptions and not in these totals.`,
      href: "/app/payroll",
    });
  }

  if (!input.pfConfigured || !input.esiConfigured) {
    const missing = [
      input.pfConfigured ? "" : "PF",
      input.esiConfigured ? "" : "ESI",
    ].filter(Boolean);
    out.push({
      tone: "attention",
      text: `${missing.join(" and ")} ${missing.length === 1 ? "is" : "are"} ${formatInr(0)} because no percent is set. Set it under Company to include ${missing.length === 1 ? "it" : "them"}.`,
      href: "/app/company/profile",
    });
  }

  if (input.musterCount !== null && input.activeCount > 0) {
    out.push({
      tone: input.musterCount >= input.activeCount ? "positive" : "info",
      text: `${input.musterCount} of ${input.activeCount} active employees have a muster for ${input.monthLabel}.`,
      href: "/app/muster",
    });
  }
  return out;
}

/**
 * Checks that every line balances and that the parts of each total add back
 * to it. Returns what does not, so a test or a log can name it.
 */
export function reconcile(lines: StatLine[]): string[] {
  const problems: string[] = [];
  for (const line of lines) {
    const parts =
      line.pfPaise +
      line.esiPaise +
      line.ptPaise +
      line.loanPaise +
      line.otherDeductionPaise +
      line.adjustmentPaise;
    if (parts !== line.deductionPaise) {
      problems.push(`${line.name}: deduction parts differ from the total`);
    }
    if (line.grossPaise - line.deductionPaise !== line.netPaise) {
      problems.push(`${line.name}: gross less deductions is not net`);
    }
    if (
      line.basicPaise + line.daPaise + line.otherEarningPaise !==
      line.grossPaise
    ) {
      problems.push(`${line.name}: earnings parts differ from gross`);
    }
  }
  return problems;
}
