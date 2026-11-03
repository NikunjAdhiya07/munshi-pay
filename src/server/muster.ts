import type { Muster, Store } from "./model.ts";
import { isLocked, PayrollError } from "./payroll.ts";

export type MusterCounts = Pick<
  Muster,
  "paidDays" | "weekOff" | "publicHoliday" | "compOff" | "onDuty"
>;

export function recordMuster(
  store: Store,
  companyId: string,
  period: string,
  counts: (employeeId: string) => MusterCounts,
  newId: () => string,
): void {
  if (isLocked(store, companyId, period)) {
    throw new PayrollError("This period is locked.");
  }
  for (const employee of store.employees.filter(
    (item) => item.companyId === companyId,
  )) {
    const next = counts(employee.id);
    const row = store.muster.find(
      (item) => item.employeeId === employee.id && item.period === period,
    );
    if (row) Object.assign(row, next);
    else {
      store.muster.push({
        id: newId(),
        companyId,
        employeeId: employee.id,
        period,
        ...next,
      });
    }
  }
}
