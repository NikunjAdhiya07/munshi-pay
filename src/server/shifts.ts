import type { Shift, Store } from "./model.ts";

export class ShiftError extends Error {}

export type ShiftInput = {
  name: string;
  inTime: string;
  outTime: string;
  inTime2: string;
  outTime2: string;
  hours: string;
  presentHours: string;
  halfDayHours: string;
  nightOffShift: string;
  nightDutyPunch: string;
};

export const SHIFT_FIELDS = [
  "name",
  "inTime",
  "outTime",
  "inTime2",
  "outTime2",
  "hours",
  "presentHours",
  "halfDayHours",
  "nightOffShift",
  "nightDutyPunch",
] as const satisfies readonly (keyof ShiftInput)[];

const NAME_LIMIT = 40;
const NOTE_LIMIT = 30;

function same(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** A 24-hour clock time such as 09:30. Blank means not set. */
function parseTime(raw: string, label: string): string {
  const value = raw.trim();
  if (value === "") return "";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new ShiftError(`${label} must be a time such as 09:30.`);
  }
  return value;
}

/** Hours between 0 and 24 with at most two decimals. Blank means not set. */
function parseHours(raw: string, label: string): string {
  const value = raw.trim();
  if (value === "") return "";
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    throw new ShiftError(
      `${label} must be a number of hours with at most two decimals.`,
    );
  }
  const hours = Number(value);
  if (hours > 24) throw new ShiftError(`${label} cannot be above 24.`);
  return String(hours);
}

function parseNote(raw: string, label: string): string {
  const value = raw.trim();
  if (value.length > NOTE_LIMIT) {
    throw new ShiftError(`${label} must be ${NOTE_LIMIT} characters or fewer.`);
  }
  return value;
}

function validate(
  store: Store,
  companyId: string,
  input: ShiftInput,
  selfId: string | null,
): Omit<Shift, "id" | "companyId"> {
  const name = input.name.trim();
  if (!name) throw new ShiftError("Enter a shift name.");
  if (name.length > NAME_LIMIT) {
    throw new ShiftError(
      `Shift name must be ${NAME_LIMIT} characters or fewer.`,
    );
  }
  const clash = store.shifts.some(
    (item) =>
      item.companyId === companyId &&
      item.id !== selfId &&
      same(item.name, name),
  );
  if (clash) throw new ShiftError(`A shift named ${name} already exists.`);

  const inTime = parseTime(input.inTime, "In time");
  const outTime = parseTime(input.outTime, "Out time");
  const inTime2 = parseTime(input.inTime2, "In time 2");
  const outTime2 = parseTime(input.outTime2, "Out time 2");
  // A shift may end after midnight, so an out time earlier than the in time is
  // allowed. Each clock pair is either complete or empty.
  if (Boolean(inTime) !== Boolean(outTime)) {
    throw new ShiftError(
      "Enter both the in time and the out time, or neither.",
    );
  }
  if (Boolean(inTime2) !== Boolean(outTime2)) {
    throw new ShiftError(
      "Enter both the second in time and out time, or neither.",
    );
  }
  if (inTime2 && !inTime) {
    throw new ShiftError("Enter the first in and out times before the second.");
  }
  return {
    name,
    inTime,
    outTime,
    inTime2,
    outTime2,
    hours: parseHours(input.hours, "Total hours"),
    presentHours: parseHours(input.presentHours, "Present hours"),
    halfDayHours: parseHours(input.halfDayHours, "Half-day hours"),
    nightOffShift: parseNote(input.nightOffShift, "Night-off shift"),
    nightDutyPunch: parseNote(input.nightDutyPunch, "Night-duty punch"),
  };
}

function owned(store: Store, companyId: string, id: string): Shift {
  const shift = store.shifts.find(
    (item) => item.id === id && item.companyId === companyId,
  );
  if (!shift) throw new ShiftError("Shift not found.");
  return shift;
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

/** Number of employees in this company whose shift carries this name. */
export function employeesOnShift(
  store: Store,
  companyId: string,
  name: string,
): number {
  return store.employees.filter(
    (employee) =>
      employee.companyId === companyId && same(employee.shift ?? "", name),
  ).length;
}

export function addShift(
  store: Store,
  companyId: string,
  actor: string,
  input: ShiftInput,
  newId: () => string,
): Shift {
  const checked = validate(store, companyId, input, null);
  const shift: Shift = { id: newId(), companyId, ...checked };
  store.shifts.push(shift);
  record(store, companyId, actor, `Added shift ${shift.name}`, newId);
  return shift;
}

/**
 * Employees keep the name of their shift as text, so a rename moves every
 * employee in the company who carried the old name.
 */
export function updateShift(
  store: Store,
  companyId: string,
  actor: string,
  id: string,
  input: ShiftInput,
  newId: () => string,
): Shift {
  const shift = owned(store, companyId, id);
  const checked = validate(store, companyId, input, id);
  const previous = shift.name;
  let moved = 0;
  if (previous !== checked.name) {
    for (const employee of store.employees) {
      if (
        employee.companyId === companyId &&
        same(employee.shift ?? "", previous)
      ) {
        employee.shift = checked.name;
        moved += 1;
      }
    }
  }
  Object.assign(shift, checked);
  record(
    store,
    companyId,
    actor,
    previous === checked.name
      ? `Edited shift ${shift.name}`
      : `Renamed shift ${previous} to ${shift.name} (${moved} ${moved === 1 ? "employee" : "employees"})`,
    newId,
  );
  return shift;
}

export function deleteShift(
  store: Store,
  companyId: string,
  actor: string,
  id: string,
  newId: () => string,
): void {
  const shift = owned(store, companyId, id);
  const used = employeesOnShift(store, companyId, shift.name);
  if (used > 0) {
    throw new ShiftError(
      `${shift.name} is used by ${used} ${used === 1 ? "employee" : "employees"}. Change those employees first.`,
    );
  }
  store.shifts = store.shifts.filter((item) => item.id !== id);
  record(store, companyId, actor, `Deleted shift ${shift.name}`, newId);
}

/**
 * The employee form takes a shift from the list. An employee that already
 * holds older free text keeps it until it is changed.
 */
export function assertShiftListed(
  store: Store,
  companyId: string,
  value: string,
  current: string,
): void {
  const text = value.trim();
  if (!text || same(text, current)) return;
  const listed = store.shifts.some(
    (item) => item.companyId === companyId && same(item.name, text),
  );
  if (!listed) {
    throw new ShiftError(
      `Shift ${text} is not in the list. Add it under Shift master first.`,
    );
  }
}
