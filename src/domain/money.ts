/** Money is integer paise. Display formatting is not part of calculation. */

/** A percent from 0 to 100 with at most two decimals, as hundredths of a percent. */
function hundredths(percent: number): number {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new RangeError(`Percent must be from 0 to 100, not ${percent}.`);
  }
  const points = Math.round(percent * 100);
  if (Math.abs(points - percent * 100) > 1e-6) {
    throw new RangeError(`Percent ${percent} has more than two decimals.`);
  }
  return points;
}

/**
 * The percent of an amount, rounded half away from zero to the nearest paisa
 * (DEC-016). Integer arithmetic only, so 12.1 percent does not drift.
 */
export function percentOf(amountPaise: number, percent: number): number {
  if (!Number.isSafeInteger(amountPaise)) {
    throw new RangeError(`Amount must be whole paise, not ${amountPaise}.`);
  }
  const product = Math.abs(amountPaise) * hundredths(percent);
  if (!Number.isSafeInteger(product)) {
    throw new RangeError("Amount is too large to take a percent of.");
  }
  const rest = product % 10_000;
  const whole = (product - rest) / 10_000 + (rest >= 5_000 ? 1 : 0);
  return amountPaise < 0 && whole > 0 ? -whole : whole;
}

/**
 * Parses a percent typed by a person, such as "12" or "0.75". Returns null for
 * anything that is not 0 to 100 with at most two decimals.
 */
export function parsePercentText(raw: string): number | null {
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(raw.trim());
  if (!match) return null;
  const points =
    Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (points > 10_000) return null;
  return points / 100;
}

/**
 * Parses rupees typed by a person, such as "1,250.5", into paise without going
 * through a float. Returns null for anything that is not a non-negative amount
 * with at most two decimals.
 */
export function parseRupeeText(raw: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(raw.trim().replaceAll(",", ""));
  if (!match) return null;
  const paise =
    Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(paise) ? paise : null;
}

/**
 * Exact rupees text for files, such as "1250.05" or "-0.50". Built from integer
 * paise with no float and no currency symbol or grouping, so a spreadsheet
 * reads it as a number.
 */
export function plainRupees(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const absolute = Math.abs(Math.trunc(paise));
  const rupees = Math.floor(absolute / 100);
  const rest = String(absolute % 100).padStart(2, "0");
  return `${sign}${rupees}.${rest}`;
}

export function formatInr(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(paise / 100);
}
