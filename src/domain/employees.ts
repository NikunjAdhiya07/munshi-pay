import { type DashboardPerson, isActive } from "./dashboard.ts";

export const PAGE_SIZES = [10, 25, 50, 100, 500] as const;

export const SORT_KEYS = [
  "code",
  "name",
  "department",
  "designation",
  "birthDate",
  "joinDate",
  "leftDate",
  "uan",
  "pfNumber",
  "esiNumber",
] as const;

export type PageSize = (typeof PAGE_SIZES)[number];
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDir = "asc" | "desc";
export type Employment = "all" | "active" | "left";

export type ListedEmployee = DashboardPerson & {
  code: string;
  name: string;
  department: string;
  designation: string;
  pfNumber: string;
  esiNumber: string;
};

export function pageSize(value: string | undefined): PageSize {
  const size = Number(value);
  return PAGE_SIZES.find((item) => item === size) ?? 10;
}

export function sortKey(value: string | undefined): SortKey {
  return SORT_KEYS.find((item) => item === value) ?? "code";
}

export function sortDir(value: string | undefined): SortDir {
  return value === "desc" ? "desc" : "asc";
}

export function employment(value: string | undefined): Employment {
  if (value === "active" || value === "left") return value;
  return "all";
}

export function matchesEmployment(
  person: { leftDate: string },
  status: Employment,
  today: string,
): boolean {
  if (status === "all") return true;
  const active = isActive(person, today);
  return status === "active" ? active : !active;
}

export function sortEmployees<T extends ListedEmployee>(
  people: T[],
  key: SortKey,
  dir: SortDir,
): T[] {
  const sign = dir === "desc" ? -1 : 1;
  return [...people].sort((a, b) => {
    const compared = a[key].localeCompare(b[key]);
    if (compared !== 0) return compared * sign;
    return a.code.localeCompare(b.code);
  });
}

export function pageOf<T>(people: T[], page: number, size: PageSize): T[] {
  const index = Math.max(1, page);
  return people.slice((index - 1) * size, index * size);
}

/** Parts of a name joined with single spaces. Blank parts are left out. */
export function fullName(first: string, middle: string, last: string): string {
  return [first, middle, last]
    .map((part) => part.trim().replace(/\s+/g, " "))
    .filter((part) => part !== "")
    .join(" ");
}

/**
 * The next employee code for a company: the highest trailing number among its
 * codes plus one, keeping that code's prefix and zero padding. A company with
 * no numbered codes starts at 1.
 */
export function nextEmployeeCode(codes: string[]): string {
  let best: { prefix: string; value: number; width: number } | null = null;
  for (const code of codes) {
    const match = /^(.*?)(\d+)$/.exec(code.trim());
    if (!match) continue;
    const value = Number(match[2]);
    if (!Number.isSafeInteger(value)) continue;
    if (!best || value > best.value) {
      best = { prefix: match[1], value, width: match[2].length };
    }
  }
  if (!best) return "1";
  return best.prefix + String(best.value + 1).padStart(best.width, "0");
}

/** Codes are the same when they differ only by case or surrounding space. */
export function sameCode(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * A government or bank identifier for the screen: the last few characters stay
 * visible, the rest become X, and the length is kept. Short values show less.
 */
export function maskSecret(value: string): string {
  const text = value.trim();
  if (!text) return "";
  const visible = text.length >= 8 ? 4 : Math.floor(text.length / 3);
  return "X".repeat(text.length - visible) + text.slice(text.length - visible);
}

/**
 * What to store for a masked field. A form shows the masked value, so a
 * submission equal to that mask means "unchanged" and keeps the saved value.
 * Anything else, including blank, is the new value.
 */
export function keepIfMasked(submitted: string, current: string): string {
  const text = submitted.trim();
  return current !== "" && text === maskSecret(current) ? current : text;
}
