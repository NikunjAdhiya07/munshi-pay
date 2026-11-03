import { percentOf } from "./money.ts";

export type EpfMode =
  | "full-basic"
  | "limited-basic"
  | "full-gross"
  | "limited-gross";

export type ExceptionCode =
  | "empty-rate"
  | "empty-category"
  | "left-employee"
  | "esi-above-limit";

export type PayrollException = {
  code: ExceptionCode;
  severity: "critical" | "warning";
  reason: string;
};

export type EngineInput = {
  salaryBase: "salary" | "per-day";
  categoryPresent: boolean;
  /** Monthly gross, or the daily rate, in paise. Null when no rate is stored. */
  ratePaise: number | null;
  paidDays: number;
  basicPercent: number;
  daPercent: number;
  leftDuringPeriod: boolean;
  pfDeduct: boolean;
  epfMode: EpfMode;
  /** Null means no cap is configured. Limited modes then use the full base. */
  pfLimitPaise: number | null;
  /** Null means no employee PF percent is configured. The amount stays 0. */
  pfEmployeePercent: number | null;
  esiDeduct: boolean;
  esiEmployeePercent: number | null;
  esiExceptionLimitPaise: number;
  ptPaise: number;
  otherDeductionPaise: number;
  loanPaise: number;
  earningAdjustmentPaise: number;
  deductionAdjustmentPaise: number;
};

export type EngineResult = {
  basicPaise: number;
  daPaise: number;
  otherEarningPaise: number;
  grossPaise: number;
  pfPaise: number;
  esiPaise: number;
  ptPaise: number;
  otherDeductionPaise: number;
  loanPaise: number;
  deductionPaise: number;
  netPaise: number;
  exceptions: PayrollException[];
  payable: boolean;
};

const empty = (exceptions: PayrollException[]): EngineResult => ({
  basicPaise: 0,
  daPaise: 0,
  otherEarningPaise: 0,
  grossPaise: 0,
  pfPaise: 0,
  esiPaise: 0,
  ptPaise: 0,
  otherDeductionPaise: 0,
  loanPaise: 0,
  deductionPaise: 0,
  netPaise: 0,
  exceptions,
  payable: false,
});

function pfBase(
  mode: EpfMode,
  basicPaise: number,
  grossPaise: number,
  limitPaise: number | null,
): number {
  const raw =
    mode === "full-basic" || mode === "limited-basic" ? basicPaise : grossPaise;
  const limited = mode === "limited-basic" || mode === "limited-gross";
  if (limited && limitPaise != null) return Math.min(raw, limitPaise);
  return raw;
}

/**
 * Category percents split a stored gross. Components are filled in order and
 * cannot exceed that gross, so basic + DA + other always equals gross.
 * PF and ESI amounts are zero unless a percent is supplied. This is not a
 * statutory rate table.
 */
export function calculatePayroll(input: EngineInput): EngineResult {
  const exceptions: PayrollException[] = [];
  if (!input.categoryPresent) {
    exceptions.push({
      code: "empty-category",
      severity: "critical",
      reason: "No salary category is set.",
    });
  }
  if (input.ratePaise == null || input.ratePaise <= 0) {
    exceptions.push({
      code: "empty-rate",
      severity: "critical",
      reason: "No salary rate is stored.",
    });
  }
  if (input.leftDuringPeriod) {
    exceptions.push({
      code: "left-employee",
      severity: "warning",
      reason: "The employee left on or before this period.",
    });
  }

  const critical = exceptions.some((item) => item.severity === "critical");
  if (critical || input.leftDuringPeriod) return empty(exceptions);

  const rate = input.ratePaise ?? 0;
  const structureGross =
    input.salaryBase === "per-day" ? rate * input.paidDays : rate;
  let basic = percentOf(structureGross, input.basicPercent);
  if (basic > structureGross) basic = structureGross;
  let da = percentOf(structureGross, input.daPercent);
  if (basic + da > structureGross) da = structureGross - basic;
  const other = structureGross - basic - da + input.earningAdjustmentPaise;
  const gross = basic + da + other;

  const base = pfBase(input.epfMode, basic, gross, input.pfLimitPaise);
  const pf =
    input.pfDeduct && input.pfEmployeePercent != null
      ? percentOf(base, input.pfEmployeePercent)
      : 0;
  const esi =
    input.esiDeduct && input.esiEmployeePercent != null
      ? percentOf(gross, input.esiEmployeePercent)
      : 0;
  if (input.esiDeduct && gross > input.esiExceptionLimitPaise) {
    exceptions.push({
      code: "esi-above-limit",
      severity: "warning",
      reason: "ESI wage base is above the configured limit.",
    });
  }

  const otherDeduction =
    input.otherDeductionPaise + input.deductionAdjustmentPaise;
  const deduction = pf + esi + input.ptPaise + otherDeduction + input.loanPaise;
  return {
    basicPaise: basic,
    daPaise: da,
    otherEarningPaise: other,
    grossPaise: gross,
    pfPaise: pf,
    esiPaise: esi,
    ptPaise: input.ptPaise,
    otherDeductionPaise: otherDeduction,
    loanPaise: input.loanPaise,
    deductionPaise: deduction,
    netPaise: gross - deduction,
    exceptions,
    payable: true,
  };
}
