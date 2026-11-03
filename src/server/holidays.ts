import type { Holiday, Store } from "./model.ts";

export class HolidayError extends Error {}

export type HolidayInput = { date: string; year: string; description: string };

const DESCRIPTION_LIMIT = 60;

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function record(
  store: Store,
  companyId: string,
  actor: string,
  action: string,
  newId: () => string,
): void {
  store.audit.unshift({
    id: `audit-${newId()}`,
    at: new Date().toISOString(),
    actor,
    action,
    companyId,
  });
}

/**
 * The year is stored as typed. Whether it is the calendar year or the
 * financial year of the date was not shown in the reference, so the two are
 * not cross-checked.
 */
export function addHoliday(
  store: Store,
  companyId: string,
  actor: string,
  input: HolidayInput,
  newId: () => string,
): Holiday {
  const date = input.date.trim();
  if (!validDate(date)) throw new HolidayError("Enter the holiday date.");
  const year = input.year.trim();
  if (!/^\d{4}$/.test(year)) {
    throw new HolidayError("Enter the year as four digits.");
  }
  const description = input.description.trim();
  if (description.length > DESCRIPTION_LIMIT) {
    throw new HolidayError(
      `Description must be ${DESCRIPTION_LIMIT} characters or fewer.`,
    );
  }
  if (
    store.holidays.some(
      (item) => item.companyId === companyId && item.date === date,
    )
  ) {
    throw new HolidayError(`${date} is already a holiday for this company.`);
  }
  const holiday: Holiday = { id: newId(), companyId, date, year, description };
  store.holidays.push(holiday);
  record(store, companyId, actor, `Added holiday ${date}`, newId);
  return holiday;
}

export function deleteHoliday(
  store: Store,
  companyId: string,
  actor: string,
  id: string,
  newId: () => string,
): void {
  const holiday = store.holidays.find(
    (item) => item.id === id && item.companyId === companyId,
  );
  if (!holiday) throw new HolidayError("Holiday not found.");
  store.holidays = store.holidays.filter((item) => item.id !== id);
  record(store, companyId, actor, `Deleted holiday ${holiday.date}`, newId);
}

/** Holidays for the company, by date, filtered by year and by text in the date or description. */
export function searchHolidays(
  store: Store,
  companyId: string,
  filter: { year?: string; text?: string },
): Holiday[] {
  const text = (filter.text ?? "").trim().toLowerCase();
  return store.holidays
    .filter(
      (item) =>
        item.companyId === companyId &&
        (!filter.year || item.year === filter.year) &&
        (!text ||
          item.date.includes(text) ||
          item.description.toLowerCase().includes(text)),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function holidayYears(store: Store, companyId: string): string[] {
  return [
    ...new Set(
      store.holidays
        .filter((item) => item.companyId === companyId)
        .map((item) => item.year),
    ),
  ].sort((a, b) => b.localeCompare(a));
}

/** Number of listed holiday dates inside a YYYY-MM period. */
export function holidaysInPeriod(
  store: Store,
  companyId: string,
  period: string,
): number {
  return store.holidays.filter(
    (item) =>
      item.companyId === companyId && item.date.startsWith(`${period}-`),
  ).length;
}
