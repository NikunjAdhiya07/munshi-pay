export const EVENT_WINDOW_DAYS = 30;

export const PENDING_FIELDS = [
  { id: "aadhaar", label: "Aadhaar" },
  { id: "uan", label: "UAN" },
  { id: "pan", label: "PAN" },
  { id: "mobile", label: "Mobile" },
  { id: "birth-date", label: "Birth date" },
  { id: "join-date", label: "Join date" },
  { id: "pf-bank", label: "PF bank" },
  { id: "salary-bank", label: "Salary bank" },
] as const;

export const EVENT_KINDS = [
  { id: "birthday-today", label: "Birthdays today" },
  { id: "birthday-upcoming", label: "Upcoming birthdays" },
  { id: "joining", label: "New joinings" },
  { id: "left", label: "Leavers" },
] as const;

export type PendingField = (typeof PENDING_FIELDS)[number]["id"];
export type EventKind = (typeof EVENT_KINDS)[number]["id"];

export type DashboardPerson = {
  id: string;
  companyId: string;
  birthDate: string;
  joinDate: string;
  leftDate: string;
  mobile: string;
  pan: string;
  aadhaar: string;
  uan: string;
  bankName: string;
  ifsc: string;
  account: string;
  pfBankName?: string;
  pfIfsc?: string;
  pfAccount?: string;
};

const DAY = 86_400_000;

function blank(value: string | undefined): boolean {
  return (value ?? "").trim() === "";
}

function bankMissing(
  name: string | undefined,
  ifsc: string | undefined,
  account: string | undefined,
): boolean {
  return blank(name) || blank(ifsc) || blank(account);
}

export function todayInKolkata(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function pendingField(value: string | undefined): PendingField | null {
  return PENDING_FIELDS.find((field) => field.id === value)?.id ?? null;
}

export function eventKind(value: string | undefined): EventKind | null {
  return EVENT_KINDS.find((kind) => kind.id === value)?.id ?? null;
}

export function pendingLabel(field: PendingField): string {
  return PENDING_FIELDS.find((item) => item.id === field)?.label ?? field;
}

export function eventLabel(kind: EventKind): string {
  return EVENT_KINDS.find((item) => item.id === kind)?.label ?? kind;
}

export function isActive(person: { leftDate: string }, today: string): boolean {
  return blank(person.leftDate) || person.leftDate > today;
}

export function isMissing(
  person: DashboardPerson,
  field: PendingField,
): boolean {
  switch (field) {
    case "aadhaar":
      return blank(person.aadhaar);
    case "uan":
      return blank(person.uan);
    case "pan":
      return blank(person.pan);
    case "mobile":
      return blank(person.mobile);
    case "birth-date":
      return blank(person.birthDate);
    case "join-date":
      return blank(person.joinDate);
    case "pf-bank":
      return bankMissing(person.pfBankName, person.pfIfsc, person.pfAccount);
    case "salary-bank":
      return bankMissing(person.bankName, person.ifsc, person.account);
  }
}

function parseDay(iso: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = Date.UTC(year, month - 1, day);
  const check = new Date(utc);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return utc;
}

function formatDay(utc: number): string {
  const date = new Date(utc);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysAfter(from: string, to: string): number | null {
  const start = parseDay(from);
  const end = parseDay(to);
  if (start == null || end == null) return null;
  return Math.round((end - start) / DAY);
}

function observedBirthday(
  year: number,
  monthIndex: number,
  day: number,
): number {
  const utc = Date.UTC(year, monthIndex, day);
  const date = new Date(utc);
  if (date.getUTCMonth() === monthIndex) return utc;
  return Date.UTC(year, 1, 28);
}

function nextBirthday(birthDate: string, today: string): string | null {
  const birth = parseDay(birthDate);
  const now = parseDay(today);
  if (birth == null || now == null) return null;
  const born = new Date(birth);
  const month = born.getUTCMonth();
  const day = born.getUTCDate();
  const year = new Date(now).getUTCFullYear();
  let candidate = observedBirthday(year, month, day);
  if (candidate < now) candidate = observedBirthday(year + 1, month, day);
  return formatDay(candidate);
}

export function matchesEvent(
  person: DashboardPerson,
  kind: EventKind,
  today: string,
): boolean {
  if (kind === "birthday-today" || kind === "birthday-upcoming") {
    if (!isActive(person, today)) return false;
    const next = nextBirthday(person.birthDate, today);
    if (!next) return false;
    const delta = daysAfter(today, next);
    if (delta == null || delta < 0) return false;
    if (kind === "birthday-today") return delta === 0;
    return delta > 0 && delta <= EVENT_WINDOW_DAYS;
  }
  if (kind === "joining") {
    const delta = daysAfter(person.joinDate, today);
    return delta != null && delta >= 0 && delta <= EVENT_WINDOW_DAYS;
  }
  const delta = daysAfter(person.leftDate, today);
  return delta != null && delta >= 0 && delta <= EVENT_WINDOW_DAYS;
}

export function filterDashboardPeople<T extends DashboardPerson>(
  people: T[],
  companyId: string,
  today: string,
  selection: { missing?: PendingField | null; event?: EventKind | null },
): T[] {
  return people.filter((person) => {
    if (person.companyId !== companyId) return false;
    if (
      selection.missing &&
      !(isActive(person, today) && isMissing(person, selection.missing))
    ) {
      return false;
    }
    if (selection.event && !matchesEvent(person, selection.event, today)) {
      return false;
    }
    return true;
  });
}

export function pendingCounts(
  people: DashboardPerson[],
  companyId: string,
  today: string,
): { id: PendingField; label: string; count: number }[] {
  return PENDING_FIELDS.map((field) => ({
    id: field.id,
    label: field.label,
    count: filterDashboardPeople(people, companyId, today, {
      missing: field.id,
    }).length,
  }));
}

export function eventCounts(
  people: DashboardPerson[],
  companyId: string,
  today: string,
): { id: EventKind; label: string; count: number }[] {
  return EVENT_KINDS.map((kind) => ({
    id: kind.id,
    label: kind.label,
    count: filterDashboardPeople(people, companyId, today, {
      event: kind.id,
    }).length,
  }));
}
