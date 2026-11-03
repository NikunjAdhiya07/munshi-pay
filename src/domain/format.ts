/** Display helpers for charts and cards. They never take part in a calculation. */

/**
 * A short rupee label for chart axes and tight cards, built from integer
 * paise: ₹4,50,000 becomes "₹4.5L" and ₹2.5 crore becomes "₹2.5Cr". It is
 * rounded for display only, so exact figures always use `formatInr`.
 */
export function compactInr(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const rupees = Math.abs(paise) / 100;
  const trim = (value: number) =>
    value >= 100
      ? String(Math.round(value))
      : String(Math.round(value * 10) / 10);
  if (rupees >= 10_000_000) return `${sign}₹${trim(rupees / 10_000_000)}Cr`;
  if (rupees >= 100_000) return `${sign}₹${trim(rupees / 100_000)}L`;
  if (rupees >= 1_000) return `${sign}₹${trim(rupees / 1_000)}K`;
  return `${sign}₹${Math.round(rupees)}`;
}

/**
 * The change from `previous` to `current` as a whole percent, or null when
 * there is nothing to compare with (no earlier month, or an earlier total of
 * zero). A null result is shown as no comparison, never as zero.
 */
export function changePercent(
  current: number,
  previous: number | null | undefined,
): number | null {
  if (previous == null || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** "+4%", "-12%", or "No change" for a whole-percent change. */
export function changeLabel(percent: number): string {
  if (percent === 0) return "No change";
  return `${percent > 0 ? "+" : "-"}${Math.abs(percent)}%`;
}

/** Up to two letters for an avatar, from a name or a username. */
export function initials(text: string): string {
  const words = text
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** Month as "YYYY-MM" shifted by a whole number of months. */
export function shiftPeriod(period: string, months: number): string | null {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return null;
  const index = Number(match[1]) * 12 + (Number(match[2]) - 1) + months;
  if (index < 0) return null;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}
